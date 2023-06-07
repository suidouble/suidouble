const sui = require('@mysten/sui.js');
const SuiCommonMethods = require('./SuiCommonMethods.js');
const SuiPackage = require('./SuiPackage.js');
const SuiPseudoRandomAddress = require('./SuiPseudoRandomAddress.js');
const SuiMemoryObjectStorage = require('./SuiMemoryObjectStorage.js');

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
        } else if (params.phrase) {
            this._keypair = sui.Ed25519Keypair.deriveKeypair(params.phrase);

            this.log('goint to use keypair of', this._keypair.getPublicKey().toSuiAddress());
        } else if (params.as) {
            // generate pseudo-random keypair
            this._keypair = SuiPseudoRandomAddress.stringToKeyPair(params.as);

            this.log('goint to use keypair of', this._keypair.getPublicKey().toSuiAddress());
        }

        this._provider = null;
        this._providerName = null;
        if (params.provider) {
            if (params.provider == 'local' || (params.provider.constructor && params.provider.constructor.name && params.provider.constructor.name == 'SuiLocalTestValidator')) {
                if (params.provider == 'local') {
                    this._provider = new sui.JsonRpcProvider(sui.localnetConnection);
                    this._providerName = 'sui:localnet'; 
                } else {
                    // SuiLocalTestValidator
                    this._providerName = params.provider.providerName;
                    this._provider = params.provider.provider;
                }
                // this._provider = new sui.JsonRpcProvider(sui.localnetConnection);
                // this._providerName = 'sui:localnet'; 
            } else if (params.provider == 'test' || params.provider == 'testnet') {
                this._provider = new sui.JsonRpcProvider(sui.testnetConnection);
                this._providerName = 'sui:testnet';
            } else if (params.provider == 'dev' || params.provider == 'devnet') {
                this._provider = new sui.JsonRpcProvider(sui.devnetConnection);
                this._providerName = 'sui:devnet';
            } else if (params.provider == 'main' || params.provider == 'mainnet') {
                this._provider = new sui.JsonRpcProvider(sui.mainnetConnection);
                this._providerName = 'sui:mainnet';

                this.log('we are on the mainnet, working with real money, be careful');
            } else {
                if (params.provider && params.provider.connection && params.provider.connection.fullnode) {
                    this._provider = params.provider;

                    if (params.provider.connection.fullnode.indexOf('devnet') !== -1) {
                        this._providerName = 'sui:devnet';
                    } else if (params.provider.connection.fullnode.indexOf('testnet') !== -1) {
                        this._providerName = 'sui:testnet';
                    } else if (params.provider.connection.fullnode.indexOf('mainnet') !== -1) {
                        this._providerName = 'sui:mainnet';
                    } else if (params.provider.connection.fullnode.indexOf('127.0.0.1') !== -1) {
                        this._providerName = 'sui:localnet';
                    } else {
                        // just keep provider name as unique to fullnode URL to keep separate ObjectStorage instances
                        this._providerName = params.provider.connection.fullnode;
                    }
                }
            }
        }

        if (!this._provider) {
            throw new Error('Can not do anything without provider. Set params.provider at least to `local`');
        }

        // we are differient single instances of object storage by provider name (so we can separate like devnet-testnet entities if needed)
        this._objectStorage = SuiMemoryObjectStorage.instanceOf(this._providerName, {
            debug: this._debug,
        });

        this._initialized = false;

        this._packages = {};
    }

    get objectStorage() {
        return this._objectStorage;
    }

    get instanceN() {
        return this._instanceN;
    }

    static instancesCount = 0;

    get provider() {
        return this._provider;
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

    async getProvider() {
        await this.initialize();
        return this._provider;
    }

    async initialize() {
        if (this._initialized) {
            return true;
        }

        this.log('initializing...');

        this._initialized = true;

        // this._keypair = sui.Ed25519Keypair.deriveKeypair(this._phrase);
        if (!this._signer && this._keypair) { // we may optionally go without signer, to work in read-only mode
            this._signer = new sui.RawSigner(this._keypair, this._provider);
        }

        // const publicKey = this._keypair.getPublicKey();
        // this._address = publicKey.toSuiAddress();
        if (this._signer) {
            this._address = await this._signer.getAddress();
            // console.log(this._signer);
            // console.log(this._providerName);
            this.log('initialized. connected as', this._address);
        } else {
            this.log('initialized in read-only mode.');
        }


        return true;
    }

    async requestSuiFromFaucet() {
        await this.initialize();

        this.log('requesting sui from faucet...');

        let res = null;
        try {
            res = await this._provider.requestSuiFromFaucet(this._address);
        } catch (e) {
            this.log('error', e);
            res = null;
        }

        let amount = BigInt(0);
        let objectsCount = 0;

        if (res && res.transferredGasObjects) {
            for (let transferredGasObject of res.transferredGasObjects) {
                amount += BigInt(transferredGasObject.amount);
                objectsCount++;
            }
        }

        this.log('got from faucet', amount, 'MIST in', objectsCount, 'objects');

        return amount;
    }

    async getBalance(coinType = '0x2::sui::SUI') {
        await this.initialize();

        this.log('requesting balance of coin', coinType, '...');

        let res = null;
        try {
            res = await this._provider.getBalance({owner: this._address, coinType});
        } catch (e) {
            this.log('error', e);
            res = null;
        }

        let ret = BigInt(0);
        if (res && res.totalBalance) {
            ret = BigInt(res.totalBalance);
        }

        this.log('balance of', coinType, 'is', ret);
        return ret;
    }
};



module.exports = SuiMaster;