import { Transaction } from '@mysten/sui/transactions';

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
     * SuiCoin constructor
     * @param {Object} params - Initialization parameters
     * @param {string} params.coinType - sui object type for a coin, without Coin<...>, only the inside type
     * @param {SuiCoins} params.suiCoins - instance of SuiCoins
     */
    constructor(params) {
        this._coinType = params.coinType;
        this._suiCoins = params.suiCoins;

        this._exists = null;
        this._metadata = null;
    }

    /**
     * Normalize amount based on .decimals. Pass a string with a dot ('5.22', '0.0005') to convert it to units
     * always use a dot, event for '1.0' or '100.0'.
     * @param {String|Number|BigInt} amount 
     * @returns {BigInt}
     */
    normalizeAmount(amount) {
        if (typeof(amount) == 'string' && amount.indexOf('.') !== -1) {
            if (!this.decimals) {
                throw new Error('Please load coin metadata first');
            }

            return BigInt(Math.floor(parseFloat(amount) * Math.pow(10, this.decimals)));
        }

        return BigInt(amount);
    }

    /**
     * Normalize amount based on .decimals. Pass a string with a dot ('5.22', '0.0005') to convert it to units. No worries about loading metadata first.
     * @param {String|Number|bigint} amount 
     * @returns {Promise.<bigint>}
     */
    async lazyNormalizeAmount(amount) {
        await this.getMetadata();
        return this.normalizeAmount(amount);
    }

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
    amountToString(amount, options = {}) {
        if (!this.decimals) {
            throw new Error('Please load coin metadata first');
        }

        const withAbbr = !!options.withAbbr;
        const separateThousands = options.separateThousands;

        const str = (''+BigInt(amount)).padStart(this.decimals + 1,'0');
        const ind = str.length - this.decimals;
        let asFloatString = str.substring(0, ind) + '.' + str.substring(ind);

        if (asFloatString.includes('.')) {
            asFloatString = asFloatString.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
            if (!asFloatString.includes('.')) {
                asFloatString = '' + asFloatString + '.0';
            }
        }

        if (withAbbr) {
            const asBig = BigInt(Math.floor(Number(asFloatString)));

            if (asBig > 1000n) {
                if (asBig < 1000000n) return this.formatWithAbbr(asBig, 1000n, 'K', separateThousands);
                if (asBig >= 1000000n && asBig < 1000000000n) return this.formatWithAbbr(asBig, 1000000n, 'M', separateThousands);
                if (asBig >= 1000000000n && asBig < 1000000000000n) return this.formatWithAbbr(asBig, 1000000000n, 'B', separateThousands);
                if (asBig >= 1000000000000n) return this.formatWithAbbr(asBig, 1000000000000n, 'T', separateThousands);
            }
        }

        if (separateThousands) {
            // asFloatString has '.' anyway ( see above )
            const [integerPart, decimalPart] = asFloatString.split('.'); // Split into integer and decimal parts
            const separator = (typeof separateThousands === 'string') ? separateThousands : ',';
            const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
            asFloatString = '' + formattedInteger + '.' + decimalPart;
        }

        return asFloatString;
    }

    
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
    formatWithAbbr(amount, measureUnit, abbrSymbol, separateThousands = false) {
        let showAmount = (''+Math.floor(Number(amount) / Number(measureUnit / 1000n)));
        showAmount = showAmount.padEnd(4, '0');

        const result = Intl.NumberFormat('en-US').format(Number(showAmount));

        let separator = '';
        if (separateThousands) {
            separator = (typeof separateThousands === 'string') ? separateThousands : ',';
        }

        const pcs = result.split(',');
        const lastPc = pcs.pop();
        return pcs.join( separator ) + '.' + lastPc + abbrSymbol;
    }


    /**
     * @type {SuiMaster}
     */
    get suiMaster() {
        return this._suiCoins.suiMaster;
    }

    /** @returns {string} coin type string, always prefixed with `0x` */
    get coinType() {
        if (this._coinType.indexOf('0x') === 0) {
            return this._coinType;
        }

        return '0x'+this._coinType;
    }

    /**
     * Move type for the Coin object of this coin type
     * 
     * @type {string}
     */
    get coinObjectType() {
        return '0x2::coin::Coin<'+this.coinType+'>';
    }

    /** @returns {number | undefined} decimals from loaded metadata, or `undefined` if not yet loaded */
    get decimals() {
        if (this.metadata) {
            return this.metadata.decimals;
        }
        return undefined;
    }

    /** @returns {?CoinMeta} loaded coin metadata, or null if not loaded */
    get metadata() {
        return this._metadata;
    }

    /** @returns {?string} coin symbol from metadata, or null if metadata isn't loaded */
    get symbol() {
        if (this.metadata) {
            return this.metadata.symbol;
        }

        return null;
    }

    /** @returns {?string} coin name from metadata, or null if metadata isn't loaded */
    get name() {
        if (this.metadata) {
            return this.metadata.name;
        }

        return null;
    }

    /**
     * True if this coin's type is the normalized SUI type (`0x2::sui::SUI` expanded to 64 hex chars).
     * @returns {boolean}
     */
    isSUI() {
        const lc = this._coinType.toLowerCase();
        if (lc == '0x0000000000000000000000000000000000000000000000000000000000000002::sui::sui') { // as it's normalized
            return true;
        }
        return false;
    }

    /**
     * set predefined coin metadata so it will not be fetched from RPC
     * @param {CoinMeta} meta
     * 
     * @returns {boolean} if processed ok
     */
    setMetadata(meta) {
        if (SuiCoin.isValidMetadata(meta)) {
            this._metadata = meta;
            this._exists = true;
            return true;
        }
        return false;
    }

    /**
     * Returns true if the object looks like a usable CoinMeta (has positive `decimals`, `name`, `symbol`).
     * @param {CoinMeta} meta
     * @returns {boolean}
     */
    static isValidMetadata(meta) {
        if (meta && meta.decimals && meta.decimals > 0 && meta.name && meta.symbol) {
            return true;
        }
        return false;
    }

    /**
     * Load coin metadata from the blockchain. Concurrent callers share the same in-flight request.
     * As a good pattern, prefer hard-coded / cached metadata set via `suiMaster.suiCoins.setCoinMetas(...)`.
     *
     * @returns {Promise<?CoinMeta>} resolved metadata, or `null` if the coin type has none on chain
     */
    async getMetadata() {
        if (this._metadata) {
            return this._metadata;
        }

        if (this.__getMetadataPromise) {
            return await this.__getMetadataPromise;
        }

        // be sure it asyncs in 1 thread
        this.__getMetadataResolver = null;
        this.__getMetadataPromise = new Promise((res)=>{ this.__getMetadataResolver = res; });

        try {
            const result = await this.suiMaster.client.getCoinMetadata({
                    coinType: this.coinType,
                });
            if (result && result.coinMetadata && result.coinMetadata.decimals) {
                this._exists = true;
                this._metadata = result.coinMetadata;
            } else {
                this._exists = false;
            }
        } catch (e) {
            console.error(e);
            this._exists = false;
        }

        this.__getMetadataResolver(this._metadata);

        return this._metadata;
    }

    /**
     * Get coin balance of the wallet
     * @param {string} owner
     * 
     * @returns {Promise.<bigint>}
     */
    async getBalance(owner) {
        const coinBalanceResponse = await this.suiMaster.client.getBalance({
            owner: owner,
            coinType: this.coinType,
        });
        if (coinBalanceResponse?.balance?.balance) {
            return BigInt(coinBalanceResponse.balance.balance);
        } else {
            return BigInt(0);
        }
    }


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
    async coinOfAmountToTxCoin(txb, _owner, amount) {
        const normalizedAmount = await this.lazyNormalizeAmount(amount);
        return txb.coin({
            type: this.coinType,
            balance: BigInt(normalizedAmount),
        });
    }
};
