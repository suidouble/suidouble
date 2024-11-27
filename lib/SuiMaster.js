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
import { requestSuiFromFaucetV0, getFaucetHost } from '@mysten/sui/faucet';
import { Transaction, Commands } from '@mysten/sui/transactions';
import { decodeSuiPrivateKey  } from '@mysten/sui/cryptography';



/**
 * @typedef {import("@mysten/sui/client").SuiClient} SuiClient
 */

export default class SuiMaster extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);
        
        // quick value to differenciate instances (if there're few) in logs
        SuiMaster.instancesCount++;
        this._instanceN = SuiMaster.instancesCount;

        this._signer = null;
        this._keypair = null;

        this._address = null;

        if (params.signer) {
            this._signer = params.signer;
            if (this._signer && this._signer.connectedAddress) {
                this._address = this._signer.connectedAddress;
            }
        } else if (params.keypair) {
            this._keypair = params.keypair;
        } else if (params.privateKey) {
            const parsed = decodeSuiPrivateKey(params.privateKey);
            if (parsed && parsed.schema) {
                if (parsed.schema === 'ED25519') {
                    this._keypair = Ed25519Keypair.fromSecretKey(parsed.secretKey);
                } else if (parsed.schema == 'Secp256k1') {
                    this._keypair = Secp256k1Keypair.fromSecretKey(parsed.secretKey);
                } else if (parsed.schema == 'Secp256r1') {
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
                // default is Ed25519{
                // default is Ed25519

                if (!params.accountIndex) {
                    this._keypair = Ed25519Keypair.deriveKeypair(params.phrase);
                } else {
                    // remember you can generate many addresses with same seed?
                    const derivePath = `m/44'/784'/${params.accountIndex}'/0'/0'`;
                    this._keypair = Ed25519Keypair.deriveKeypair(params.phrase, derivePath);
                }
            }

            this.log('goint to use keypair of', this._keypair.getPublicKey().toSuiAddress());
        } else if (params.as) {
            // generate pseudo-random keypair
            this._keypair = SuiPseudoRandomAddress.stringToKeyPair(params.as);

            this.log('goint to use keypair of', this._keypair.getPublicKey().toSuiAddress());
        }


        /** @type {SuiClient} */
        this._client = SuiUtils.normalizeClient(params.client);
        this._providerName = this._client ? this._client.providerName : null;

        if (!this._client) {
            throw new Error('Can not do anything without SuiClient. Set params.client at least to `local`');
        }

        // we are differient single instances of object storage by provider name (so we can separate like devnet-testnet entities if needed)
        /** @type {SuiMemoryObjectStorage} */
        this._objectStorage = SuiMemoryObjectStorage.instanceOf(this._providerName, {
            debug: this._debug,
            suiMaster: this,
        });

        this._initialized = false;

        this._packages = {};

        /** @type {SuiCoins} */
        this._suiCoins = new SuiCoins({
            suiMaster: this,
            debug: this._debug,
        });
    }

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

    get MIST_PER_SUI() {
        return BigInt(MIST_PER_SUI);
    }

    get Transaction() {
        return Transaction;
    }

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

    /**
     * Storage storing all objects interacted by this suiMaster
     * 
     * @type {SuiMemoryObjectStorage}
     */
    get objectStorage() {
        return this._objectStorage;
    }

    get instanceN() {
        return this._instanceN;
    }

    static instancesCount = 0;

    get client() {
        return this._client;
    }

    get connectedChain() {
        return this._providerName;
    }

    /**
     * determine if this suiMaster is connected to mainnet or not
     * @returns {boolean} is on mainnet
     */
    get onMainnet() {
        const provider = this._providerName.split('sui:').join('').toLowerCase();
        if (provider === 'mainnet') {
            return true;
        }

        return false;
    }

    get address() {
        return this._address;
    }

    get signer() {
        return this._signer;
    }

    package(params = {}) {
        return this.addPackage(params);
    }

    addPackage(params = {}) {
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

    async getClient() {
        await this.initialize();
        return this._client;
    }

    async initialize() {
        if (this._initialized) {
            return true;
        }

        this.log('initializing...');

        this._initialized = true;

        // this._keypair = sui.Ed25519Keypair.deriveKeypair(this._phrase);
        if (!this._signer && this._keypair) { // we may optionally go without signer, to work in read-only mode
            this._signer = this._keypair;//
        }

        // const publicKey = this._keypair.getPublicKey();
        // this._address = publicKey.toSuiAddress();
        if (this._signer) {
            if (this._signer.toSuiAddress) {
                this._address = this._signer.toSuiAddress();    // after Sui's refactor Keypair's method
            } else if (this._signer.connectedAddress) {
                this._address = this._signer.connectedAddress;
            } else {
                this._address = await this._signer.getAddress(); // old method
            }

            this.log('initialized. connected as', this._address);
        } else {
            this.log('initialized in read-only mode.');
        }


        return true;
    }

    /**
     * Return the first resolved name for the connected wallet if there's any, null otherwise
     * 
     * @param {Object} params parameters
     * @param {'at' | 'dot' | undefined} params.format
     * 
     * @returns {string | null}
     */
    async resolveNameServiceName(params = {}) {
        const resolvedNames = await this.resolveNameServiceNames(params);
        if (resolvedNames && resolvedNames.length) {
            return resolvedNames[0];
        }
        return null;
    }

    /**
     * Return the resolved names for the connected wallet, if multiple names are resolved, the first one is the primary name.
     * Currently returns array with only the first name
     * @param {Object} params parameters
     * @param {'at' | 'dot' | undefined} params.format
     * 
     * @returns {Array.<string>}
     */
    async resolveNameServiceNames(params = {}) {
        if (!this._address) {
            return [];
        }

        try {
            const resp = await this._client.resolveNameServiceNames({
                    address: this.address,
                    format: params.format,
                });
            if (resp && resp.data) {
                return resp.data;
            }
        } catch (e) {
            return [];
        }
    }

    async signAndExecuteTransaction(params) {
        let txResults = null;
        if (this._keypair) {
            params.signer = this._keypair;
            txResults = await this._client.signAndExecuteTransaction(params);
        } else if (this._signer) {
            txResults = await this._signer.signAndExecuteTransaction(params);
        }

        try {
            if (params && params.requestType && params.requestType == 'WaitForLocalExecution') {
                const detailedResults =  await this.client.waitForTransaction({
                    digest: txResults.digest,
                    options: (params.options || {}),
                });
    
                return detailedResults;
            }
        } catch (e) {
            this.log(e);
        }

        return txResults;
    }

    async requestSuiFromFaucet() {
        await this.initialize();
        let amount = BigInt(0);
        const provider = this._providerName.split('sui:').join('');

        if (provider === "mainnet") {
            this.log(`no faucet on ${provider}`);
        } else {
            const faucetHost = getFaucetHost(provider);
            this.log(`requesting sui from faucet... ${faucetHost}`);
            const requested = await requestSuiFromFaucetV0({
                host: faucetHost,
                recipient: this._address,
            });

            let objectsCount = 0;

            if (requested && requested.transferredGasObjects) {
                for (let transferredGasObject of requested.transferredGasObjects) {
                    amount += BigInt(transferredGasObject.amount);
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
     * @param {String} coinType 
     * @param {String|null} owner 
     * @returns BigInt
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

    async fetchEvents(params = {}) {
        let query = params.query;

        const queryParams = {
            descending_order: params.descending_order || false,
            query: query,
            limit: params.limit || 50,
        };

        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this,
            params: queryParams,
            method: 'queryEvents',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return paginatedResponse;
    }

    async fetchTransactions(params = {}) {
        let filter = {};
        if (params.fromAddress) {
            filter.FromAddress = params.fromAddress;
        }
        if (params.filter) {
            filter = params.filter;
        }

        const queryParams = {
            descending_order: false,
            filter: filter,
            options: {
                // showInput: true,
                showEffects: true,
                // showEvents: true,
                // showObjectChanges: true,
                // showBalanceChanges: true,
                // showType: true,
                // showContent: true,
                // showOwner: true,
                // showDisplay: true,
            },
            limit: params.limit || 50,
        };
        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this,
            params: queryParams,
            method: 'queryTransactionBlocks',
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
