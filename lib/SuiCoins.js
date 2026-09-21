import SuiCoin from './SuiCoin.js';
import SuiCommonMethods from './SuiCommonMethods.js';
import { normalizeStructTag } from "@mysten/sui/utils";
import coinMetas from './data/coinMetas.js';

/**
 * @typedef {import("./SuiCoin.js").CoinMeta} CoinMeta
 * @typedef {import("./SuiCoin.js").SuidoubleCoinBalance} SuidoubleCoinBalance
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
     * @param {boolean} [params.debug]
     */
    constructor(params) {
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
            this.setCoinMetas(coinMetas);
        }
    }

    /**
     * @type {SuiMaster}
     */
    get suiMaster() {
        return this._suiMaster;
    }

    /** @returns {Object.<string, SuiCoin>} map of coinType → SuiCoin instance */
    get coins() {
        return this._coins;
    }

    /**
     * Set predefined coin metas so they will not need to be fetched from RPC.
     *
     * @param {Object.<string, CoinMeta> | Array.<CoinMeta>} coinMetas - keyed map by coin type, or an array of CoinMeta with `type` field
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
     * Get all CoinBalance[] for the specific address or connected address.
     *
     * @param {Object} [params]
     * @param {?string} [params.owner] - owner address; if omitted, uses the connected SuiMaster address
     * @returns {Promise<Array<SuidoubleCoinBalance>>}
     */
    async getAllBalances(params = {}) {
        let owner = params.owner;
        if (!owner) {
            owner = this._suiMaster.address;
        }

        /** @type {Array.<SuidoubleCoinBalance>} */
        const ret = [];

        let cursor = null;
        do {
            const response = await this._suiMaster.client.listBalances({ owner, cursor });
            for (const responseItem of (response?.balances ?? [])) {
                /** @type {SuidoubleCoinBalance} */
                ret.push({
                    coin: this.get(responseItem.coinType),
                    coinType: responseItem.coinType,
                    balance: responseItem.balance,
                    coinBalance: responseItem.balance,
                    addressBalance: responseItem.addressBalance,
                    totalBalance: BigInt(responseItem.balance),
                });
            }
            cursor = response?.hasNextPage ? response.cursor : null;
        } while (cursor);

        return ret;
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
     * Return instance of SuiCoin of specific type. The result is cached per normalized coin type,
     * so repeated calls with equivalent inputs return the same instance.
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
    static getSingleton(params) {
        const suiMaster = params.suiMaster;
        const connectedChain = suiMaster.connectedChain;

        if (SuiCoins._singleInstances[connectedChain]) {
            return SuiCoins._singleInstances[connectedChain];
        }

        SuiCoins._singleInstances[connectedChain] = new SuiCoins(params);
        return SuiCoins._singleInstances[connectedChain];
    }

};