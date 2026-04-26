import SuiCommonMethods from './SuiCommonMethods.js';
import SuiPackage from './SuiPackage.js';
import SuiPseudoRandomAddress from './SuiPseudoRandomAddress.js';
import SuiMemoryObjectStorage from './SuiMemoryObjectStorage.js';
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
import SuiObject from './SuiObject.js';
import SuiCoins from './SuiCoins.js';
import SuiUtils from './SuiUtils.js';
import SuiEvent from './SuiEvent.js';
import SuiTransaction from './SuiTransaction.js';

import { MIST_PER_SUI } from '@mysten/sui/utils';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { Secp256k1Keypair } from '@mysten/sui/keypairs/secp256k1';
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1';
import { requestSuiFromFaucetV2, getFaucetHost } from '@mysten/sui/faucet';
import { Transaction, TransactionCommands as Commands } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey  } from '@mysten/sui/cryptography';



/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 * 
 * @typedef {import("@mysten/sui/grpc").SuiGrpcClient} SuiGrpcClient
 * @typedef {import("@mysten/sui/graphql").SuiGraphQLClient} SuiGraphQLClient
 * @typedef {import("@mysten/sui/cryptography").Signer} SuiSigner
 * @typedef {import("@mysten/sui/cryptography").Keypair} SuiKeypair
 * @typedef {import("./SuiInBrowser.js").default} SuiInBrowser
 */

export default class SuiMaster extends SuiCommonMethods {
    /**
     * SuiMaster constructor
     * @param {Object} params - Initialization parameters
     * @param {SuiSigner|SuiInBrowser} [params.signer] - instance of Sui SDK Signer (like Keypair) or SuiInBrowser for browser wallet signing
     * @param {SuiKeypair} [params.keypair] - instance of Sui SDK Keypair
     * @param {string} [params.privateKey] - private key in Sui format, starting with "suiprivkey1"
     * @param {boolean} [params.debug] - enable debug mode
     * @param {string} [params.phrase] - mnemonic phrase to derive keypair from
     * @param {string} [params.keypairAlgo] - keypair algorithm to use with mnemonic phrase. One of 'ed25519' (default), 'secp256k1', 'secp256r1'
     * @param {number} [params.accountIndex] - index of account to derive from mnemonic phrase. Default is 0
     * @param {string} [params.as] - pseudo-random address generation seed string
     * @param {SuiGrpcClient|string} [params.client] - instance of SuiGrpcClient or chain name to make SuiGrpcClient connected to it (like 'local', 'devnet', 'testnet', 'mainnet')
     */
    constructor(params) {
        super(params);
        
        // quick value to differenciate instances (if there're few) in logs
        SuiMaster.instancesCount++;
        this._instanceN = SuiMaster.instancesCount;

        /** @type {SuiSigner|SuiInBrowser|null} */
        this._signer = null;
        /** @type {SuiKeypair} */
        this._keypair = null;

        /** @type {string} */
        this._address = null;

        if (params.signer) {
            this._signer = params.signer;
            if (this._signer && /** @type {any} */ (this._signer).connectedAddress) {
                this._address = /** @type {any} */ (this._signer).connectedAddress;
            }
        } else if (params.keypair) {
            this._keypair = params.keypair;
        } else if (params.privateKey) {
            const parsed = decodeSuiPrivateKey(params.privateKey);
            if (parsed && parsed.scheme) {
                if (parsed.scheme === 'ED25519') {
                    this._keypair = Ed25519Keypair.fromSecretKey(parsed.secretKey);
                } else if (parsed.scheme == 'Secp256k1') {
                    this._keypair = Secp256k1Keypair.fromSecretKey(parsed.secretKey);
                } else if (parsed.scheme == 'Secp256r1') {
                    this._keypair = Secp256r1Keypair.fromSecretKey(parsed.secretKey);                    
                }
            }
        } else if (params.phrase) {
            if (params.keypairAlgo && (''+params.keypairAlgo).toLowerCase() == 'secp256r1') {
                if (!params.accountIndex) {
                    this._keypair = Secp256r1Keypair.deriveKeypair(params.phrase);
                } else {
                    // remember you can generate many addresses with same seed?
                    const derivePath = `m/74'/784'/${params.accountIndex}'/0/0`;
                    this._keypair = Secp256r1Keypair.deriveKeypair(params.phrase, derivePath);
                }
            } else if (params.keypairAlgo && (''+params.keypairAlgo).toLowerCase() == 'secp256k1') {
                if (!params.accountIndex) {
                    this._keypair = Secp256k1Keypair.deriveKeypair(params.phrase);
                } else {
                    // remember you can generate many addresses with same seed?
                    const derivePath = `m/54'/784'/${params.accountIndex}'/0/0`;
                    this._keypair = Secp256k1Keypair.deriveKeypair(params.phrase, derivePath);
                }
            } else {
                // default is Ed25519

                if (!params.accountIndex) {
                    this._keypair = Ed25519Keypair.deriveKeypair(params.phrase);
                } else {
                    // remember you can generate many addresses with same seed?
                    const derivePath = `m/44'/784'/${params.accountIndex}'/0'/0'`;
                    this._keypair = Ed25519Keypair.deriveKeypair(params.phrase, derivePath);
                }
            }

            this.log('going to use keypair of', this._keypair.getPublicKey().toSuiAddress());
        } else if (params.as) {
            // generate pseudo-random keypair
            this._keypair = SuiPseudoRandomAddress.stringToKeyPair(params.as);

            this.log('going to use keypair of', this._keypair.getPublicKey().toSuiAddress());
        }


        /** @type {SuiGrpcClient} */
        this._client = SuiUtils.normalizeClient(params.client);
        /**
         * Lazy — do not read directly, use the `graphqlClient` getter so it's built on first access.
         * @type {?SuiGraphQLClient}
         */
        this._graphqlClient = null;
        /** @type {string} */
        this._providerName = this._client.network;

        if (!this._client) {
            throw new Error('Can not do anything without Sui client. Set params.client at least to `local`, so we can make default one for the chain');
        }

        // we are differient single instances of object storage by provider name (so we can separate like devnet-testnet entities if needed)
        /** @type {SuiMemoryObjectStorage} */
        this._objectStorage = SuiMemoryObjectStorage.instanceOf(this._providerName, {
            debug: this._debug,
            suiMaster: this,
        });

        /** @type {boolean} */
        this._initialized = false;

        /** @type {Object.<string, SuiPackage>} */
        this._packages = {};

        /** @type {SuiCoins} */
        this._suiCoins = new SuiCoins({
            suiMaster: this,
            debug: this._debug,
        });
    }

    /** @returns {typeof SuiUtils} static SuiUtils helper class */
    get utils() {
        return SuiUtils;
    }

    /**
     * Instance of SuiCoins class connected to this SuiMaster
     * 
     * @type {SuiCoins}
     */
    get suiCoins() {
        return this._suiCoins;
    }

    /** @returns {bigint} `1_000_000_000n` — number of MIST per SUI */
    get MIST_PER_SUI() {
        return BigInt(MIST_PER_SUI);
    }

    /** @returns {typeof Transaction} SDK `Transaction` class, exposed to avoid extra imports at call sites */
    get Transaction() {
        return Transaction;
    }

    /** @returns {typeof Commands} SDK `TransactionCommands` class, exposed to avoid extra imports at call sites */
    get Commands() {
        return Commands;
    }

    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiObject contructor if you have instance of SuiMaster
     */
    get SuiObject() {
        return SuiObject;
    }
    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiTransaction contructor if you have instance of SuiMaster
     */
    get SuiTransaction() {
        return SuiTransaction;
    }
    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiEvent contructor if you have instance of SuiMaster
     */
    get SuiEvent() {
        return SuiEvent;
    }
    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiPaginatedResponse contructor if you have instance of SuiMaster
     */
    get SuiPaginatedResponse() {
        return SuiPaginatedResponse;
    }
    /**
     * Storage storing all objects interacted by this suiMaster
     *
     * @type {SuiMemoryObjectStorage}
     */
    get objectStorage() {
        return this._objectStorage;
    }

    /** @returns {number} monotonically increasing instance counter, useful for differentiating logs */
    get instanceN() {
        return this._instanceN;
    }

    static instancesCount = 0;

    /** @returns {SuiGrpcClient} gRPC client for the connected chain */
    get client() {
        return this._client;
    }

    /**
     * Lazily-built SuiGraphQLClient that reuses the network of this suiMaster's gRPC client.
     * @returns {SuiGraphQLClient}
     */
    get graphqlClient() {
        if (!this._graphqlClient) {
            this._graphqlClient = SuiUtils.suiGraphQLClientFromGrpc(this._client);
        }
        return this._graphqlClient;
    }

    /** @returns {string} connected chain identifier, e.g. `'mainnet'` or `'localnet'` */
    get connectedChain() {
        return this._providerName;
    }

    /**
     * determine if this suiMaster is connected to mainnet or not
     * @returns {boolean} is on mainnet
     */
    get onMainnet() {
        // @todo: 
        const provider = this._providerName.split('sui:').join('').toLowerCase();
        if (provider === 'mainnet') {
            return true;
        }

        return false;
    }

    /** @returns {?string} connected Sui address, or null in read-only mode before `initialize()` */
    get address() {
        return this._address;
    }

    /** @returns {SuiSigner|SuiInBrowser|null} active signer/keypair, or null in read-only mode */
    get signer() {
        return this._signer;
    }

    /**
     * Attach a smart contract package to this SuiMaster instance.
     * 
     * @param {Object} params - Configuration parameters
     * @param {?string} [params.path] - Local filesystem path to the Move package source code
     * @param {?string} [params.id] - ID or address of the Move package on the Sui blockchain
     * @param {?Array.<string>|string} [params.modules] - List of modules in the package to look on chain in the UpgradeCap owned by current address
     * 
     * @returns {SuiPackage}
     */
    package(params = {}) {
        return this.addPackage(params);
    }

    /**
     * Attach a smart contract package to this SuiMaster instance.
     * 
     * @param {Object} params - Configuration parameters
     * @param {?string} [params.path] - Local filesystem path to the Move package source code
     * @param {?string} [params.id] - ID or address of the Move package on the Sui blockchain
     * @param {?Array.<string>|string} [params.modules] - List of modules in the package to look on chain in the UpgradeCap owned by current address
     * 
     * @returns {SuiPackage}
     */
    addPackage(params) {
        if (params.id && this._packages[params.id]) {
            return this._packages[params.id];
        }
        const suiPackage = new SuiPackage({
            ...params,
            debug: this._debug,
            suiMaster: this,
        });

        if (params.id) {
            this._packages[params.id] = suiPackage;
        }

        return suiPackage;
    }

    /**
     * Ensure `initialize()` has run, then return the gRPC client.
     * @returns {Promise<SuiGrpcClient>}
     */
    async getClient() {
        await this.initialize();
        return this._client;
    }

    /**
     * Resolve the connected address from the signer/keypair (if any) and mark the instance as
     * ready. Idempotent — subsequent calls return immediately.
     * @returns {Promise<boolean>}
     */
    async initialize() {
        if (this._initialized) {
            return true;
        }

        this.log('initializing...');

        this._initialized = true;

        if (!this._signer && this._keypair) { // we may optionally go without signer, to work in read-only mode
            this._signer = this._keypair;//
        }

        if (this._signer) {
            const s = /** @type {any} */ (this._signer);
            if (s.toSuiAddress) {
                this._address = s.toSuiAddress();    // after Sui's refactor Keypair's method
            } else if (s.connectedAddress) {
                this._address = s.connectedAddress;
            } else {
                this._address = await s.getAddress(); // old method
            }

            this.log('initialized. connected as', this._address);
        } else {
            this.log('initialized in read-only mode.');
        }


        return true;
    }

    /**
     * Return the primary Name Service name for the connected wallet address, or null if none.
     * Uses `client.core.defaultNameServiceName` (v2 gRPC).
     * @returns {Promise<string | null>}
     */
    async defaultNameServiceName() {
        if (!this._address) {
            return null;
        }

        try {
            const resp = await this._client.core.defaultNameServiceName({
                address: this._address,
            });
            return resp?.data?.name ?? null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Fetch many on-chain objects. The v2 client batches internally (50 per request).
     *
     * Per-item behavior:
     *   - if a `SuiObject` is passed in, it is updated in place via `replaceWithSuiObjectIfNeeded`
     *     and returned at its original index in the output array (same instance reference).
     *   - if a string id is passed in, a freshly-constructed `SuiObject` is returned at that index.
     *   - if an item couldn't be matched in the response, the original (or a new bare) SuiObject is
     *     still placed at that index — no nulls, no skipped slots.
     *
     * Errors-in-results entries from the client are skipped silently. Returns `[]` for empty input.
     *
     * @param {Array<string | SuiObject>} idsOrSuiObjects - mix of object ids and/or SuiObject instances
     * @param {SuiClientTypes.ObjectInclude} [include] - fields to include; defaults to content/json/display
     * @returns {Promise<SuiObject[]>} array aligned with input order
     */
    async getObjects(idsOrSuiObjects, include) {
        if (!Array.isArray(idsOrSuiObjects) || idsOrSuiObjects.length === 0) {
            return [];
        }

        const slots = idsOrSuiObjects.map((item) => {
            const a = /** @type {any} */ (item);
            if (a && a.address) {
                return { id: a.address, obj: /** @type {SuiObject} */ (a) };
            }
            const id = '' + a;
            return {
                id,
                obj: new SuiObject({ suiMaster: this, debug: this._debug, id }),
            };
        });

        const uniqueIds = [];
        for (const s of slots) {
            if (s.id && uniqueIds.indexOf(s.id) === -1) uniqueIds.push(s.id);
        }

        let raws = [];
        try {
            const { objects } = await this._client.getObjects({
                objectIds: uniqueIds,
                include: include || { content: true, json: true, display: true },
            });
            raws = (objects || []).filter((entry) => entry && !(entry instanceof Error) && entry.objectId);
        } catch (e) {
            console.error(e);
        }

        for (const slot of slots) {
            const raw = raws.find((r) => slot.obj.idEquals(r.objectId));
            if (!raw) continue;
            const fresh = new SuiObject({ suiMaster: this, debug: this._debug, raw });
            slot.obj.replaceWithSuiObjectIfNeeded(fresh);
        }

        return slots.map((s) => s.obj);
    }

    /**
     * Fetch a single on-chain object and return it wrapped in a SuiObject.
     *
     * @param {string | SuiObject} idOrSuiObject - object id, or a SuiObject instance whose `.address` will be used
     * @param {SuiClientTypes.ObjectInclude} [include] - fields to include; defaults to content/json/display
     * @returns {Promise<?SuiObject>} SuiObject populated from the api, or null if not found
     */
    async getObject(idOrSuiObject, include) {
        const a = /** @type {any} */ (idOrSuiObject);
        const objectId = (a && a.address) ? a.address : a;

        const { object } = await this._client.getObject({
            objectId,
            include: include || { content: true, json: true, display: true },
        });

        if (!object) return null;

        return new SuiObject({
            suiMaster: this,
            debug: this._debug,
            raw: object,
        });
    }

    /**
     * List objects owned by an address. Picks the right backend based on `input.type`:
     *
     *   - no type / full struct type (`pkg::mod::Struct[<...>]`) → gRPC `listOwnedObjects` (fast path)
     *   - package (`pkg`) or module (`pkg::mod`) filter → GraphQL `address.objects` (gRPC can't parse those)
     *
     * @param {SuiClientTypes.ListOwnedObjectsOptions<SuiClientTypes.ObjectInclude>} input
     * @param {Object} [extra]
     * @param {string} [extra.order]
     * @returns {Promise<SuiPaginatedResponse<SuiObject>>}
     */
    async getOwnedObjects(input, extra = {}) {
        const useGraphql = SuiMaster._typeNeedsGraphqlOwned(input && input.type);

        /** @type {SuiPaginatedResponse<SuiObject>} */
        const paginatedResponse = new SuiPaginatedResponse({
            suiMaster: this,
            method: useGraphql ? 'graphqlOwnedObjects' : 'listOwnedObjects',
            params: input,
            order: extra.order,
        });
        await paginatedResponse.fetch();
        return paginatedResponse;
    }

    /**
     * gRPC `ListOwnedObjects.objectType` only accepts a full struct type. A bare package address or
     * `package::module` string needs the GraphQL path.
     * @param {?string} type
     * @returns {boolean}
     */
    static _typeNeedsGraphqlOwned(type) {
        if (!type) return false;
        // Strip generic type params (content inside the outermost `<…>`) before counting `::` segments.
        const bare = type.split('<')[0];
        const segments = bare.split('::');
        return segments.length < 3;
    }

    /**
     * Sign and execute a transaction on the Sui blockchain.
     * Uses the connected keypair or signer or browser extension wallet adapter to sign the transaction before submitting it.
     *
     * Throws on two failure paths, both with a normalised `executionError` + `digest` shape:
     *
     *  1. **`SimulationError`** (SDK, pre-submission) — thrown during `tx.build()` / gas selection
     *     when the SDK simulates the transaction and detects an abort before even submitting.
     *     `executionError` is set by the SDK; `digest` is `null` (no submission happened).
     *
     *  2. **`FailedTransaction`** (on-chain) — the transaction was submitted and executed but aborted.
     *     Both `executionError` and `digest` are set.
     *
     * In both cases the error has:
     *   - `message` — human-readable failure reason
     *   - `executionError` — `SuiClientTypes.ExecutionError`:
     *       `{ message, command?, MoveAbort?, SizeError?, CommandArgumentError?, TypeArgumentError?, ... }`
     *   - `digest` — transaction digest, or `null` for pre-submission failures
     *
     * @param {{ transaction: Transaction, include?: SuiClientTypes.TransactionInclude, requestType?: string }} params
     * @returns {Promise<SuiTransaction>}
     * @throws {Error & { executionError: SuiClientTypes.ExecutionError, digest: ?string }} if the transaction fails on-chain
     */
    async signAndExecuteTransaction(params) {
        let signAndExecuteTransactionResponse;
        try {
            const tx = /** @type {Transaction} */ (params.transaction);

            tx.setSenderIfNotSet(this.address);

            const signerAny = /** @type {any} */ (this._signer);

            /** @type {?Uint8Array} */
            let transactionBytes = null;
            /** @type {?string} */
            let signature = null;

            if (signerAny.activeAdapter) {
                // We are using browser adapter — build first to resolve intents, 
                // then sign
                const signer = /** @type {SuiInBrowser} */ (signerAny);

                transactionBytes = await tx.build({
                    client: this._client,
                });

                // Sign TX with browser extension
                ({ signature } = await signer.signTransaction({
                    ...params,
                }));
            } else {
                const signer = /** @type {SuiSigner} */ (signerAny);

                transactionBytes = await tx.build({
                    client: this._client,
                });

                ({ signature } = await signer.signTransaction(transactionBytes));
            }

            signAndExecuteTransactionResponse = await this._client.executeTransaction({
                transaction: transactionBytes,
                signatures: [signature],
                include: params.include ? params.include : {},
            });
        } catch (e) {
            // SimulationError — SDK aborted during pre-submission simulation (tx.build / gas selection).
            // Already has executionError; add digest = null for a consistent error shape.
            if (e && e.executionError !== undefined) {
                e.digest = e.digest ?? null;
            }
            throw e;
        }

        if (signAndExecuteTransactionResponse.$kind === 'FailedTransaction') {
            const executionError = signAndExecuteTransactionResponse.FailedTransaction?.status?.error;
            const err = /** @type {Error & { executionError: any, digest: any }} */ (new Error(executionError?.message ?? 'Transaction failed'));
            err.executionError = executionError ?? null;  // full SuiClientTypes.ExecutionError: { message, command?, MoveAbort?, ... }
            err.digest = signAndExecuteTransactionResponse.FailedTransaction?.digest ?? null;
            throw err;
        }

        const suiTransaction = new SuiTransaction({
            suiMaster: this,
            data: signAndExecuteTransactionResponse.Transaction,
        });

        if (params.requestType && params.requestType == 'WaitForLocalExecution') {
            await suiTransaction.waitForTransaction(
                /** @type {SuiClientTypes.WaitForTransactionOptions<{}>} */ (
                    params.include ? { include: params.include } : {}
                )
            );
        }

        return suiTransaction;
    }

    /**
     * Request SUI tokens from the faucet for the connected address.
     * Only works on localnet, devnet, and testnet.
     * @returns {Promise<bigint>} total MIST received across all coin objects
     */
    async requestSuiFromFaucet() {
        await this.initialize();
        let amount = BigInt(0);
        const provider = this._providerName.split('sui:').join('');

        if (provider === "mainnet") {
            this.log(`no faucet on ${provider}`);
        } else {
            const faucetHost = getFaucetHost(/** @type {any} */ (provider));
            this.log(`requesting sui from faucet... ${faucetHost}`);
            const requested = await requestSuiFromFaucetV2({
                host: faucetHost,
                recipient: this._address,
            });

            let objectsCount = 0;

            if (requested && requested.coins_sent) {
                for (const transferred of requested.coins_sent) {
                    amount += BigInt(transferred.amount);
                    objectsCount++;
                }
            }

            this.log('got from faucet', amount, 'MIST in', objectsCount, 'objects');
        }

        return amount;
    }

    /**
     * Query the balance of specific coinType for an owner. If owner == null, returns balance of connected address owner
     * 
     * @param {string} [coinType='0x2::sui::SUI']
     * @param {?string} [owner] - defaults to the connected address
     * @returns {Promise<bigint>}
     */
    async getBalance(coinType = '0x2::sui::SUI', owner = null) {
        await this.initialize();

        let queryingBalanceOf = owner;
        if (!queryingBalanceOf && this.address) {
            queryingBalanceOf = this.address;
        }

        const suiCoin = this._suiCoins.get(coinType);
        return await (suiCoin.getBalance(queryingBalanceOf));
    }

    /**
     * Fetch events via the GraphQL `events` query. Lowest-level entry point —
     * `SuiPackage.fetchEvents` and `SuiPackageModule.fetchEvents` both delegate here.
     *
     * The filter is a GraphQL `EventFilter`:
     *   - `module` : "<package>" or "<package>::<module>"
     *   - `type`   : "<package>::<module>::<EventName>" (or a prefix thereof)
     *   - `sender` : SuiAddress
     *   - `atCheckpoint` / `afterCheckpoint` / `beforeCheckpoint` : UInt53
     *
     * @param {Object} [params]
     * @param {Object} [params.filter] - GraphQL EventFilter
     * @param {number} [params.limit=50]
     * @param {string} [params.order] - Passed through to the underlying paginated response
     * @returns {Promise<SuiPaginatedResponse<SuiEvent>>}
     */
    async fetchEvents(params = {}) {
        const queryParams = {
            filter: params.filter || {},
            limit: params.limit || 50,
        };

        /** @type {SuiPaginatedResponse<SuiEvent>} */
        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this,
            params: queryParams,
            method: 'graphqlEvents',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return paginatedResponse;
    }

    /**
     * Fetch transactions via the GraphQL root `transactions(filter: TransactionFilter)` query.
     *
     * Accepts either a direct `params.filter` (GraphQL `TransactionFilter` shape) or the legacy
     * convenience fields (`fromAddress`, `affectedAddress`, `affectedObject`, `function`, `atCheckpoint`,
     * `afterCheckpoint`, `beforeCheckpoint`, `kind`) which get translated to the corresponding
     * `TransactionFilter` fields.
     *
     * @param {Object} [params]
     * @param {Object} [params.filter] - raw TransactionFilter; overrides the convenience fields if set
     * @param {?string} [params.fromAddress]
     * @param {?string} [params.affectedAddress]
     * @param {?string} [params.affectedObject]
     * @param {?string} [params.function]
     * @param {?number} [params.atCheckpoint]
     * @param {?number} [params.afterCheckpoint]
     * @param {?number} [params.beforeCheckpoint]
     * @param {?string} [params.kind]
     * @param {number} [params.limit=50]
     * @param {string} [params.order]
     * @returns {Promise<SuiPaginatedResponse<SuiTransaction>>}
     */
    async fetchTransactions(params = {}) {
        let filter = params.filter;
        if (!filter) {
            filter = {};
            if (params.fromAddress) filter.sentAddress = params.fromAddress;
            if (params.affectedAddress) filter.affectedAddress = params.affectedAddress;
            if (params.affectedObject) filter.affectedObject = params.affectedObject;
            if (params.function) filter.function = params.function;
            if (params.atCheckpoint !== undefined) filter.atCheckpoint = params.atCheckpoint;
            if (params.afterCheckpoint !== undefined) filter.afterCheckpoint = params.afterCheckpoint;
            if (params.beforeCheckpoint !== undefined) filter.beforeCheckpoint = params.beforeCheckpoint;
            if (params.kind) filter.kind = params.kind;
        }

        /** @type {SuiPaginatedResponse<SuiTransaction>} */
        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this,
            params: { filter, limit: params.limit || 50 },
            method: 'graphqlTransactions',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return paginatedResponse;
    }
};

SuiMaster.MIST_PER_SUI = BigInt(MIST_PER_SUI);
SuiMaster.Transaction = Transaction;
SuiMaster.Commands = Commands;
SuiMaster.SuiUtils = SuiUtils;
