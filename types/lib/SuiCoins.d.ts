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
    static _singleInstances: {};
    /**
     * Return singleton instance of the SuiCoins object for the specific chain
     *
     * @param {Object} params - parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @returns {SuiCoins}
     */
    static getSingleton(params: {
        suiMaster: SuiMaster;
    }): SuiCoins;
    /**
     * SuiCoins constructor
     * @param {Object} params - Initialization parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {boolean} [params.debug]
     */
    constructor(params: {
        suiMaster: SuiMaster;
        debug?: boolean;
    });
    /** @type {SuiMaster} */
    _suiMaster: SuiMaster;
    /** @type {Object.<string, SuiCoin>} */
    _coins: {
        [x: string]: SuiCoin;
    };
    /**
     * @type {SuiMaster}
     */
    get suiMaster(): SuiMaster;
    /** @returns {Object.<string, SuiCoin>} map of coinType → SuiCoin instance */
    get coins(): {
        [x: string]: SuiCoin;
    };
    /**
     * Set predefined coin metas so they will not need to be fetched from RPC.
     *
     * @param {Object.<string, CoinMeta> | Array.<CoinMeta>} coinMetas - keyed map by coin type, or an array of CoinMeta with `type` field
     * @returns {number} count of processed items
     */
    setCoinMetas(coinMetas: {
        [x: string]: CoinMeta;
    } | Array<CoinMeta>): number;
    /**
     * Get all CoinBalance[] for the specific address or connected address.
     *
     * @param {Object} [params]
     * @param {?string} [params.owner] - owner address; if omitted, uses the connected SuiMaster address
     * @returns {Promise<Array<SuidoubleCoinBalance>>}
     */
    getAllBalances(params?: {
        owner?: string | null;
    }): Promise<Array<SuidoubleCoinBalance>>;
    /**
     * normalize coinType string to sui's coin type. As extra, may take 'sui' or 'SUI' as the type and return type for it
     * @param {string} coinType
     * @returns {string} normalized coin type
     */
    normalizeCoinType(coinType: string): string;
    /**
     * Return instance of SuiCoin of specific type. The result is cached per normalized coin type,
     * so repeated calls with equivalent inputs return the same instance.
     *
     * @param {string} coinType - MoveType, or 'SUI' as helper
     * @returns {SuiCoin}
     */
    get(coinType: string): SuiCoin;
}
export type CoinMeta = import("./SuiCoin.js").CoinMeta;
export type SuidoubleCoinBalance = import("./SuiCoin.js").SuidoubleCoinBalance;
export type SuiMaster = import("./SuiMaster.js").default;
import SuiCommonMethods from './SuiCommonMethods.js';
import SuiCoin from './SuiCoin.js';
