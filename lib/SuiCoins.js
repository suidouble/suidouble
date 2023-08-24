const SuiCoin = require('./SuiCoin.js');
const SuiCommonMethods = require('./SuiCommonMethods.js');

class SuiCoins extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);
        
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is required');
        }
        this._coins = {};

        this._isInitialized = false;
    }

    get suiMaster() {
        return this._suiMaster;
    }

    get coins() {
        return this._coins;
    }

    /**
     * Optional common initialized to get a list and metadata of all safe coins defined in SuiCoin.js
     */
    async init() {
        if (this._isInitialized) {
            return true;
        }

        const safeList = SuiCoin.safeList(this._suiMaster.connectedChain);
        const metadataPromises = [];
        for (const coinType in safeList) {
            const normalizedCoinType = this.normalizeCoinType(coinType);
            if (!this._coins[normalizedCoinType]) {
                const suiCoin = new SuiCoin({
                    coinType: normalizedCoinType,
                    suiCoins: this,
                });
                console.log('adding coin with type', normalizedCoinType);
                this._coins[normalizedCoinType] = suiCoin;

                const metadataPromise = new Promise(async(res)=>{
                    try {
                        await suiCoin.getMetadata();
                    } catch (e) {
                        console.error(e);
                    }

                    res();
                });
                metadataPromises.push(metadataPromise);
            }
        }

        await Promise.all(metadataPromises);

        this._isInitialized = true;
    }

    normalizeCoinType(coinType) {
        if (coinType.indexOf('::') == -1) {
            if (coinType.toLowerCase() == 'sui') {
                return '0x2::sui::SUI';
            } else {
                for (const key in this._coins) {
                    if (key == coinType) {
                        return this._coins[key].coinType;
                    }
                }

                const safeList = SuiCoin.safeList(this._suiMaster.connectedChain);
                for (const key in safeList) {
                    if (safeList[key] == coinType) {
                        return key;
                    }
                }
            }

            if (coinType.indexOf('0x') == -1) {
                return '0x'+coinType+'::coin::COIN';
            } else {
                return ''+coinType+'::coin::COIN';
            }
        }

        if (coinType.indexOf('0x') == -1) {
            coinType = '0x'+coinType;
        }

        if (coinType == '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI') {
            return '0x2::sui::SUI';
        }

        return coinType;
    }

    get(coinType) {
        const normalizedCoinType = this.normalizeCoinType(coinType); 
        let suiCoin = this._coins[normalizedCoinType];
        if (suiCoin) {
            return suiCoin;
        }

        suiCoin = new SuiCoin({
            coinType: normalizedCoinType,
            suiCoins: this,
        });

        this._coins[normalizedCoinType] = suiCoin;

        return suiCoin;
    }

    static _singleInstances = {};
    static getSingleton(params = {}) {
        const suiMaster = params.suiMaster;
        const connectedChain = suiMaster.connectedChain;

        if (SuiCoins._singleInstances[connectedChain]) {
            return SuiCoins._singleInstances[connectedChain];
        }

        SuiCoins._singleInstances[connectedChain] = new SuiCoins(params);
        return SuiCoins._singleInstances[connectedChain];
    }

};

module.exports = SuiCoins;