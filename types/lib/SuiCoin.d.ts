/**
 * @typedef {import("@mysten/sui/transactions").TransactionObjectArgument} TransactionObjectArgument
 *
 * @import { SuiClientTypes } from "@mysten/sui/client"
 *
 * @typedef CoinMeta
 * @type {object}
 * @property {number} decimals - Number of decimal places the coin uses.
 * @property {string} description - Description of the token
 * @property {string} iconUrl - URL for the token logo
 * @property {string} name - Name for the token
 * @property {string} symbol - Symbol for the token
 * @property {string} [id] - Meta id
 * @property {string} [type] - Coin type string
 *
 *
 * @typedef {SuiClientTypes.Balance & { coin: SuiCoin, totalBalance: bigint }} SuidoubleCoinBalance
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 * @typedef {import("./SuiCoins.js").default} SuiCoins
 */
/**
 * Handle for a single coin type (e.g. `0x2::sui::SUI`). Caches metadata, formats amounts
 * via decimals, and builds `Coin<T>` arguments for transactions.
 */
export default class SuiCoin {
    /**
     * Returns true if the object looks like a usable CoinMeta (has positive `decimals`, `name`, `symbol`).
     * @param {CoinMeta} meta
     * @returns {boolean}
     */
    static isValidMetadata(meta: CoinMeta): boolean;
    /**
     * SuiCoin constructor
     * @param {Object} params - Initialization parameters
     * @param {string} params.coinType - sui object type for a coin, without Coin<...>, only the inside type
     * @param {SuiCoins} params.suiCoins - instance of SuiCoins
     */
    constructor(params: {
        coinType: string;
        suiCoins: SuiCoins;
    });
    _coinType: string;
    _suiCoins: import("./SuiCoins.js").default;
    _exists: boolean;
    _metadata: CoinMeta | SuiClientTypes.CoinMetadata;
    /**
     * Normalize amount based on .decimals. Pass a string with a dot ('5.22', '0.0005') to convert it to units
     * always use a dot, event for '1.0' or '100.0'.
     * @param {String|Number|BigInt} amount
     * @returns {BigInt}
     */
    normalizeAmount(amount: string | number | bigint): bigint;
    /**
     * Normalize amount based on .decimals. Pass a string with a dot ('5.22', '0.0005') to convert it to units. No worries about loading metadata first.
     * @param {String|Number|bigint} amount
     * @returns {Promise.<bigint>}
     */
    lazyNormalizeAmount(amount: string | number | bigint): Promise<bigint>;
    /**
     * Get readable representation of a raw amount (bigint-native, NOT a pre-formatted "1.99" string),
     * based on coin decimals metadata (requires metadata to be loaded or set).
     *
     * @param {bigint|number|string} amount - raw amount in the coin's base units
     * @param {Object} [options] - format options
     * @param {boolean} [options.withAbbr] - append K/M/B/T for large amounts (Suiet-style)
     * @param {boolean|string} [options.separateThousands] - separate thousands by `,` (true) or by a custom delimiter
     * @returns {string}
     */
    amountToString(amount: bigint | number | string, options?: {
        withAbbr?: boolean;
        separateThousands?: boolean | string;
    }): string;
    /**
     * Format large amounts.
     *
     * thanks @bruceeewong and @suiet
     *
     * @param {bigint} amount
     * @param {bigint} measureUnit - divisor for the unit (1_000n for K, 1_000_000n for M, …)
     * @param {string} abbrSymbol - suffix to append (K, M, B, T)
     * @param {boolean|string} [separateThousands=false] - separate thousands by `,` (true) or by a custom delimiter
     * @returns {string}
     */
    formatWithAbbr(amount: bigint, measureUnit: bigint, abbrSymbol: string, separateThousands?: boolean | string): string;
    /**
     * @type {SuiMaster}
     */
    get suiMaster(): SuiMaster;
    /** @returns {string} coin type string, always prefixed with `0x` */
    get coinType(): string;
    /**
     * Move type for the Coin object of this coin type
     *
     * @type {string}
     */
    get coinObjectType(): string;
    /** @returns {number | undefined} decimals from loaded metadata, or `undefined` if not yet loaded */
    get decimals(): number | undefined;
    /** @returns {?CoinMeta} loaded coin metadata, or null if not loaded */
    get metadata(): CoinMeta | null;
    /** @returns {?string} coin symbol from metadata, or null if metadata isn't loaded */
    get symbol(): string | null;
    /** @returns {?string} coin name from metadata, or null if metadata isn't loaded */
    get name(): string | null;
    /**
     * True if this coin's type is the normalized SUI type (`0x2::sui::SUI` expanded to 64 hex chars).
     * @returns {boolean}
     */
    isSUI(): boolean;
    /**
     * set predefined coin metadata so it will not be fetched from RPC
     * @param {CoinMeta} meta
     *
     * @returns {boolean} if processed ok
     */
    setMetadata(meta: CoinMeta): boolean;
    /**
     * Load coin metadata from the blockchain. Concurrent callers share the same in-flight request.
     * As a good pattern, prefer hard-coded / cached metadata set via `suiMaster.suiCoins.setCoinMetas(...)`.
     *
     * @returns {Promise<?CoinMeta>} resolved metadata, or `null` if the coin type has none on chain
     */
    getMetadata(): Promise<CoinMeta | null>;
    __getMetadataResolver: (value: any) => void;
    __getMetadataPromise: Promise<any>;
    /**
     * Get coin balance of the wallet
     * @param {string} owner
     *
     * @returns {Promise.<bigint>}
     */
    getBalance(owner: string): Promise<bigint>;
    /**
     * Return a TransactionObjectArgument with a Coin of the requested amount, ready to use in moveCall.
     * Delegates to the v2 SDK's `tx.coinWithBalance` intent, which at build time fetches all owned
     * coins of this type, merges them (including zero-balance dust), and splits off the requested amount.
     *
     * @param {Transaction} txb - Native SUI SDK Transaction
     * @param {string} _owner - unused; kept for signature compatibility. The resolver picks coins owned by the tx sender.
     * @param {BigInt|string} amount - amount of coin. BigInt or string normalized via Coin decimals ("0.05" → 0.05 SUI)
     * @returns {Promise.<TransactionObjectArgument>}
     */
    coinOfAmountToTxCoin(txb: Transaction, _owner: string, amount: bigint | string): Promise<TransactionObjectArgument>;
}
export type TransactionObjectArgument = import("@mysten/sui/transactions").TransactionObjectArgument;
export type CoinMeta = {
    /**
     * - Number of decimal places the coin uses.
     */
    decimals: number;
    /**
     * - Description of the token
     */
    description: string;
    /**
     * - URL for the token logo
     */
    iconUrl: string;
    /**
     * - Name for the token
     */
    name: string;
    /**
     * - Symbol for the token
     */
    symbol: string;
    /**
     * - Meta id
     */
    id?: string;
    /**
     * - Coin type string
     */
    type?: string;
};
export type SuidoubleCoinBalance = SuiClientTypes.Balance & {
    coin: SuiCoin;
    totalBalance: bigint;
};
export type SuiMaster = import("./SuiMaster.js").default;
export type SuiCoins = import("./SuiCoins.js").default;
import type { SuiClientTypes } from "@mysten/sui/client";
import { Transaction } from '@mysten/sui/transactions';
