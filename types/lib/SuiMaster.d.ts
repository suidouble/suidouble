/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 *
 * @typedef {import("@mysten/sui/grpc").SuiGrpcClient} SuiGrpcClient
 * @typedef {import("@mysten/sui/graphql").SuiGraphQLClient} SuiGraphQLClient
 * @typedef {import("@mysten/sui/cryptography").Signer} SuiSigner
 * @typedef {import("@mysten/sui/cryptography").Keypair} SuiKeypair
 * @typedef {import("./SuiInBrowser.js").default} SuiInBrowser
 */
declare class SuiMaster extends SuiCommonMethods {
    static instancesCount: number;
    /**
     * gRPC `ListOwnedObjects.objectType` only accepts a full struct type. A bare package address or
     * `package::module` string needs the GraphQL path.
     * @param {?string} type
     * @returns {boolean}
     */
    static _typeNeedsGraphqlOwned(type: string | null): boolean;
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
    constructor(params: {
        signer?: SuiSigner | SuiInBrowser;
        keypair?: SuiKeypair;
        privateKey?: string;
        debug?: boolean;
        phrase?: string;
        keypairAlgo?: string;
        accountIndex?: number;
        as?: string;
        client?: SuiGrpcClient | string;
    });
    _instanceN: number;
    /** @type {SuiSigner|SuiInBrowser|null} */
    _signer: SuiSigner | SuiInBrowser | null;
    /** @type {SuiKeypair} */
    _keypair: SuiKeypair;
    /** @type {string} */
    _address: string;
    /** @type {SuiGrpcClient} */
    _client: SuiGrpcClient;
    /**
     * Lazy — do not read directly, use the `graphqlClient` getter so it's built on first access.
     * @type {?SuiGraphQLClient}
     */
    _graphqlClient: SuiGraphQLClient | null;
    /** @type {string} */
    _providerName: string;
    /** @type {SuiMemoryObjectStorage} */
    _objectStorage: SuiMemoryObjectStorage;
    /** @type {boolean} */
    _initialized: boolean;
    /** @type {Object.<string, SuiPackage>} */
    _packages: {
        [x: string]: SuiPackage;
    };
    /** @type {SuiCoins} */
    _suiCoins: SuiCoins;
    /** @returns {typeof SuiUtils} static SuiUtils helper class */
    get utils(): typeof SuiUtils;
    /**
     * Instance of SuiCoins class connected to this SuiMaster
     *
     * @type {SuiCoins}
     */
    get suiCoins(): SuiCoins;
    /** @returns {bigint} `1_000_000_000n` — number of MIST per SUI */
    get MIST_PER_SUI(): bigint;
    /** @returns {typeof Transaction} SDK `Transaction` class, exposed to avoid extra imports at call sites */
    get Transaction(): typeof Transaction;
    /** @returns {typeof Commands} SDK `TransactionCommands` class, exposed to avoid extra imports at call sites */
    get Commands(): typeof Commands;
    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiObject contructor if you have instance of SuiMaster
     */
    get SuiObject(): typeof SuiObject;
    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiTransaction contructor if you have instance of SuiMaster
     */
    get SuiTransaction(): typeof SuiTransaction;
    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiEvent contructor if you have instance of SuiMaster
     */
    get SuiEvent(): typeof SuiEvent;
    /**
     * Referencing it here to get rid of circullar dependency. So you can always call SuiPaginatedResponse contructor if you have instance of SuiMaster
     */
    get SuiPaginatedResponse(): typeof SuiPaginatedResponse;
    /**
     * Storage storing all objects interacted by this suiMaster
     *
     * @type {SuiMemoryObjectStorage}
     */
    get objectStorage(): SuiMemoryObjectStorage;
    /** @returns {number} monotonically increasing instance counter, useful for differentiating logs */
    get instanceN(): number;
    /** @returns {SuiGrpcClient} gRPC client for the connected chain */
    get client(): SuiGrpcClient;
    /**
     * Lazily-built SuiGraphQLClient that reuses the network of this suiMaster's gRPC client.
     * @returns {SuiGraphQLClient}
     */
    get graphqlClient(): SuiGraphQLClient;
    /** @returns {string} connected chain identifier, e.g. `'mainnet'` or `'localnet'` */
    get connectedChain(): string;
    /**
     * determine if this suiMaster is connected to mainnet or not
     * @returns {boolean} is on mainnet
     */
    get onMainnet(): boolean;
    /** @returns {?string} connected Sui address, or null in read-only mode before `initialize()` */
    get address(): string | null;
    /** @returns {SuiSigner|SuiInBrowser|null} active signer/keypair, or null in read-only mode */
    get signer(): SuiSigner | SuiInBrowser | null;
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
    package(params?: {
        path?: string | null;
        id?: string | null;
        modules?: (Array<string> | string) | null;
    }): SuiPackage;
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
    addPackage(params: {
        path?: string | null;
        id?: string | null;
        modules?: (Array<string> | string) | null;
    }): SuiPackage;
    /**
     * Ensure `initialize()` has run, then return the gRPC client.
     * @returns {Promise<SuiGrpcClient>}
     */
    getClient(): Promise<SuiGrpcClient>;
    /**
     * Resolve the connected address from the signer/keypair (if any) and mark the instance as
     * ready. Idempotent — subsequent calls return immediately.
     * @returns {Promise<boolean>}
     */
    initialize(): Promise<boolean>;
    /**
     * Return the primary Name Service name for the connected wallet address, or null if none.
     * Uses `client.core.defaultNameServiceName` (v2 gRPC).
     * @returns {Promise<string | null>}
     */
    defaultNameServiceName(): Promise<string | null>;
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
    getObjects(idsOrSuiObjects: Array<string | SuiObject>, include?: SuiClientTypes.ObjectInclude): Promise<SuiObject[]>;
    /**
     * Fetch a single on-chain object and return it wrapped in a SuiObject.
     *
     * @param {string | SuiObject} idOrSuiObject - object id, or a SuiObject instance whose `.address` will be used
     * @param {SuiClientTypes.ObjectInclude} [include] - fields to include; defaults to content/json/display
     * @returns {Promise<?SuiObject>} SuiObject populated from the api, or null if not found
     */
    getObject(idOrSuiObject: string | SuiObject, include?: SuiClientTypes.ObjectInclude): Promise<SuiObject | null>;
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
    getOwnedObjects(input: SuiClientTypes.ListOwnedObjectsOptions<SuiClientTypes.ObjectInclude>, extra?: {
        order?: string;
    }): Promise<SuiPaginatedResponse<SuiObject>>;
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
    signAndExecuteTransaction(params: {
        transaction: Transaction;
        include?: SuiClientTypes.TransactionInclude;
        requestType?: string;
    }): Promise<SuiTransaction>;
    /**
     * Request SUI tokens from the faucet for the connected address.
     * Only works on localnet, devnet, and testnet.
     * @returns {Promise<bigint>} total MIST received across all coin objects
     */
    requestSuiFromFaucet(): Promise<bigint>;
    /**
     * Query the balance of specific coinType for an owner. If owner == null, returns balance of connected address owner
     *
     * @param {string} [coinType='0x2::sui::SUI']
     * @param {?string} [owner] - defaults to the connected address
     * @returns {Promise<bigint>}
     */
    getBalance(coinType?: string, owner?: string | null): Promise<bigint>;
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
    fetchEvents(params?: {
        filter?: any;
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<SuiEvent>>;
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
    fetchTransactions(params?: {
        filter?: any;
        fromAddress?: string | null;
        affectedAddress?: string | null;
        affectedObject?: string | null;
        function?: string | null;
        atCheckpoint?: number | null;
        afterCheckpoint?: number | null;
        beforeCheckpoint?: number | null;
        kind?: string | null;
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<SuiTransaction>>;
}
declare namespace SuiMaster {
    export let MIST_PER_SUI: bigint;
    export { Transaction };
    export { Commands };
    export { SuiUtils };
}
export default SuiMaster;
export type SuiGrpcClient = import("@mysten/sui/grpc").SuiGrpcClient;
export type SuiGraphQLClient = import("@mysten/sui/graphql").SuiGraphQLClient;
export type SuiSigner = import("@mysten/sui/cryptography").Signer;
export type SuiKeypair = import("@mysten/sui/cryptography").Keypair;
export type SuiInBrowser = import("./SuiInBrowser.js").default;
import SuiCommonMethods from './SuiCommonMethods.js';
import SuiMemoryObjectStorage from './SuiMemoryObjectStorage.js';
import SuiPackage from './SuiPackage.js';
import SuiCoins from './SuiCoins.js';
import SuiUtils from './SuiUtils.js';
import { Transaction } from '@mysten/sui/transactions';
import { TransactionCommands as Commands } from '@mysten/sui/transactions';
import SuiObject from './SuiObject.js';
import SuiTransaction from './SuiTransaction.js';
import SuiEvent from './SuiEvent.js';
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
import type { SuiClientTypes } from "@mysten/sui/client";
