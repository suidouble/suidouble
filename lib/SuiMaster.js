const SuiCommonMethods = require('./SuiCommonMethods.js');
const SuiPackage = require('./SuiPackage.js');
const SuiPseudoRandomAddress = require('./SuiPseudoRandomAddress.js');
const SuiMemoryObjectStorage = require('./SuiMemoryObjectStorage.js');
const SuiPaginatedResponse = require('./SuiPaginatedResponse.js');
const SuiObject = require('./SuiObject.js');
const SuiTransaction = require('./SuiTransaction.js');
const SuiEvent = require('./SuiEvent.js');
const SuiCoins = require('./SuiCoins.js');
const SuiUtils = require('./SuiUtils.js');
const { MIST_PER_SUI } = require('@mysten/sui/utils');
const { Ed25519Keypair } = require('@mysten/sui/keypairs/ed25519');
const { Secp256r1Keypair } = require('@mysten/sui/keypairs/secp256r1');
const { Secp256k1Keypair } = require('@mysten/sui/keypairs/secp256k1');
const { requestSuiFromFaucetV0, getFaucetHost } = require('@mysten/sui/faucet');
const { Transaction, Commands } = require('@mysten/sui/transactions');
const { decodeSuiPrivateKey } = require('@mysten/sui/cryptography');


class SuiMaster extends SuiCommonMethods {
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


        this._client = SuiUtils.normalizeClient(params.client);
        this._providerName = this._client ? this._client.providerName : null;

        if (!this._client) {
            throw new Error('Can not do anything without SuiClient. Set params.client at least to `local`');
        }

        // we are differient single instances of object storage by provider name (so we can separate like devnet-testnet entities if needed)
        this._objectStorage = SuiMemoryObjectStorage.instanceOf(this._providerName, {
            debug: this._debug,
            suiMaster: this,
        });

        this._initialized = false;

        this._packages = {};

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

    async signAndExecuteTransaction(params) {
        if (this._keypair) {
            params.signer = this._keypair;
            return this._client.signAndExecuteTransaction(params);
        } else if (this._signer) {
            return this._signer.signAndExecuteTransaction(params);
        }
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
    
    // export type TransactionFilter =
	// | { FromOrToAddress: { addr: string } }
	// | { Checkpoint: string }
	// | { FromAndToAddress: { from: string; to: string } }
	// | { TransactionKind: string }
	// | {
	// 		MoveFunction: {
	// 			package: ObjectId;
	// 			module: string | null;
	// 			function: string | null;
	// 		};
	//   }
	// | { InputObject: ObjectId }
	// | { ChangedObject: ObjectId }
	// | { FromAddress: SuiAddress }
	// | { ToAddress: SuiAddress };


	// /* Whether to show transaction input data. Default to be false. */
	// showInput: optional(boolean()),
	// /* Whether to show transaction effects. Default to be false. */
	// showEffects: optional(boolean()),
	// /* Whether to show transaction events. Default to be false. */
	// showEvents: optional(boolean()),
	// /* Whether to show object changes. Default to be false. */
	// showObjectChanges: optional(boolean()),
	// /* Whether to show coin balance changes. Default to be false. */
	// showBalanceChanges: optional(boolean()),
    async fetchTransactions(params = {}) {
        const filter = {};
        if (params.fromAddress) {
            filter.FromAddress = params.fromAddress;
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

module.exports = SuiMaster;
