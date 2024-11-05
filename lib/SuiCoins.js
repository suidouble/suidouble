import SuiCoin from './SuiCoin.js';
import SuiCommonMethods from './SuiCommonMethods.js';
import { allCoinMetas } from '@polymedia/coinmeta';
import { normalizeStructTag } from "@mysten/sui/utils";

/**
 * @typedef {import("./SuiCoin.js").CoinMeta} CoinMeta
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 */

/**
 * Common class to work with Coins and Coin objects. Expected to have single instance per SuiMaster instance
 * @class
 * @constructor
 * @public
 */
export default class SuiCoins extends SuiCommonMethods {

    /**
     * SuiCoins constructor
     * @param {Object} params - Initialization parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     */
    constructor(params = {}) {
        super(params);
        
        /** @type {SuiMaster} */
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is required');
        }

        /** @type {Object.<string, SuiCoin>} */
        this._coins = {};

        if (this._suiMaster.onMainnet) {
            // pre-cached coins metadata
            this.setCoinMetas(allCoinMetas);
        }
    }

    get suiMaster() {
        return this._suiMaster;
    }

    get coins() {
        return this._coins;
    }

    /**
     * set predefined coin metas so they will not be fetched from RPC
     * @param {(Object.<string, CoinMeta> | Array.<CoinMeta>)}
     * @returns {number} count of processed items
     */
    setCoinMetas(coinMetas) {
        let processedCount = 0;
        if (Array.isArray(coinMetas)) {
            // [CoinMeta, CoinMeta]
            for (const coinMeta of coinMetas) {
                if (coinMeta.type) {
                    const suiCoin = this.get(coinMeta.type);
                    const ok = suiCoin.setMetadata(coinMeta);
                    if (ok) {
                        processedCount++;
                    }
                }
            }
        } else {
            // {type: CoinMeta, type: CoinMeta}
            for (const coinType in coinMetas) {
                const suiCoin = this.get(coinType);
                const ok = suiCoin.setMetadata(coinMetas[coinType]);
                if (ok) {
                    processedCount++;
                }
            }
        }

        return processedCount;
    }

    /**
     * normalize coinType string to sui's coin type. As extra, may take 'sui' or 'SUI' as the type and return type for it
     * @param {string} coinType
     * @returns {string} normalized coin type
     */
    normalizeCoinType(coinType) {
        let nCoinType = (''+coinType);

        if (nCoinType.indexOf('::') == -1) {
            if (nCoinType.toLowerCase() == 'sui') {
                nCoinType = '0x2::sui::SUI';
            }
        }

        if (nCoinType.indexOf('0x') == -1) {
            nCoinType = '0x'+nCoinType;
        }

        nCoinType = normalizeStructTag(nCoinType);

        return nCoinType;
    }

    /**
     * Return instance of SuiCoin of specific type
     * 
     * @param {string} coinType - MoveType, or 'SUI' as helper
     * @returns {SuiCoin}
     */
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

    /**
     * Return singleton instance of the SuiCoins object for the specific chain
     * 
     * @param {Object} params - parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @returns {SuiCoins}
     */
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