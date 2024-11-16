import { Commands, Transaction } from '@mysten/sui/transactions';

/**
 * @typedef {import("@mysten/sui/transactions").TransactionObjectArgument} TransactionObjectArgument
 * 
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
 * @typedef SuidoubleCoinBalance
 * @type {object}
 * @property {SuiCoin} coin
 * @property {string} coinType
 * @property {number} coinObjectCount
 * @property {bigint} totalBalance
 * @property {Object.<string,string>} lockedBalance
 * 
 */

/** Coin metadata object */
export default class SuiCoin {

    /**
     * SuiCoin constructor
     * @param {Object} params - Initialization parameters
     * @param {string} params.coinType - sui object type for a coin, without Coin<...>, only the inside type
     * @param {SuiCoins} params.suiCoins - instance of SuiCoins
     */
    constructor(params = {}) {
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

            return BigInt(Math.floor(parseFloat(amount, 10) * Math.pow(10, this.decimals)));
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
     * Get readable representation of amount value (system one, bigint or converted from bigint, NOT the '1.99' etc) 
     * based on coin decimals metadata ( so it expects metadata to be loaded or set).
     * 
     * @param {Object} params - format parameters
     * @param {boolean} params.withAbbr - append K, M, B, T for large amounts. Suiet-style
     * @param {boolean|string} params.separateThousands - separate thousands, by ',' or by specific delimeter
     * 
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
     * Format large amounts
     * 
     * thanks @bruceeewong and @suiet
     * 
     * @param {bigint} amount 
     * @param {bigint} measureUnit 
     * @param {string} abbrSymbol 
     * 
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


    get suiMaster() {
        return this._suiCoins.suiMaster;
    }

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

    get decimals() {
        if (this.metadata) {
            return this.metadata.decimals;
        }
        return undefined;
    }

    get metadata() {
        return this._metadata;
    }

    get symbol() {
        if (this.metadata) {
            return this.metadata.symbol;
        }

        return null;
    }

    get name() {
        return this.metadata.name;
    }

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
        if (meta && meta.decimals && meta.decimals > 0 && meta.name && meta.symbol) {
            this._metadata = meta;
            this._exists = true;
            return true;
        }

        return false;
    }

    /**
     * Load coin metadata from the blockchain. As a good pattern, it's better to have metadata hard-coded or cached
     * and set via suiMaster.suiCoins.setCoinMetas(...)  
     * 
     * @returns {Promise.<boolean>}
     */
    async getMetadata() {
        if (this._metadata) {
            return this._metadata;
        }

        if (this.__getMetadataPromise) {
            return await this.__getMetadataPromise();
        }

        // be sure it asyncs in 1 thread
        this.__getMetadataResolver = null;
        this.__getMetadataPromise = new Promise((res)=>{ this.__getMetadataResolver = res; });

        let result = null;
        try {
            result = await this.suiMaster.client.getCoinMetadata({
                    coinType: this.coinType,
                });
        } catch (e) {
            console.error(e);
            result = null;
        }
        if (!result) {
            this._exists = false;
        } else {
            this._metadata = result;
            this._exists = true;
        }

        this.__getMetadataResolver(true);

        return true;
    }

    /**
     * Get coin balance of the wallet
     * @param {string} owner
     * 
     * @returns {Promise.<bigint>}
     */
    async getBalance(owner) {
        const coins = [];
        let result = null;
        let cursor = null;
        do {
            result = await this.suiMaster.client.getCoins({
                owner: owner,
                coinType: this.coinType,
                limit: 50,
                cursor: cursor,
            });
            coins.push(...result.data);

            cursor = result.nextCursor;
        } while (result.hasNextPage);

        let totalAmount = BigInt(0);
        for (const coin of coins) {
            totalAmount = totalAmount + BigInt(coin.balance);
        }

        return totalAmount;
    }


    /**
     * Returns TransactionObjectArgument with Coin of amount to be used in tranasctions
     * 
     * @param {Transaction} txb - Native SUI SDK Transaction
     * @param {string} owner - address of the owner
     * @param {BigInt|string} amount - amount of coin. BigIng or String to be normalized via Coin decimals, "0.05" for 0.05 sui
     * @param {boolean} addEmptyCoins - attach coins == 0 to the list
     * 
     * @returns {Promise.<TransactionObjectArgument>}
     */
    async coinOfAmountToTxCoin(txb, owner, amount, addEmptyCoins = false) {
        const normalizedAmount = await this.lazyNormalizeAmount(amount);

        const expectedAmountAsBigInt = BigInt(normalizedAmount);
        const coinIds = await this.coinObjectsEnoughForAmount(owner, expectedAmountAsBigInt, addEmptyCoins);

        if (!coinIds || !coinIds.length) {
            throw new Error('you do not have enough coins of type '+this.coinType);
        }

        if (coinIds.length == 1) {
            // only one coin object enough to cover the expense
            if (this.isSUI()) {
                const coinInput = txb.add(Commands.SplitCoins(txb.gas, [txb.pure.u64(expectedAmountAsBigInt)]));
                return coinInput;
            } else {
                // some other coin
                const coinInput = txb.add(Commands.SplitCoins(txb.object(coinIds[0]), [txb.pure.u64(expectedAmountAsBigInt)]));
                return coinInput;
            }
        } else {
            // few coin objects to merge
            const coinIdToMergeIn = coinIds.shift();
            txb.add(Commands.MergeCoins(txb.object(coinIdToMergeIn), coinIds.map((id)=>{return txb.object(id);})));
            const coinInputSplet = txb.add(Commands.SplitCoins(txb.object(coinIdToMergeIn), [txb.pure.u64(expectedAmountAsBigInt)]));

            return coinInputSplet;
        }
    }

    async coinObjectsEnoughForAmount(owner, expectedAmount, addEmptyCoins = false) {
        const expectedAmountAsBigInt = BigInt(expectedAmount);

        const coinIds = [];
        const coins = [];

        let result = null;
        let cursor = null;
        do {
            result = await this.suiMaster.client.getCoins({
                owner: owner,
                coinType: this.coinType,
                limit: 50,
                cursor: cursor,
            });
            coins.push(...result.data);

            cursor = result.nextCursor;
        } while (result.hasNextPage);

        coins.sort((a, b) => {
            // From big to small
            return Number(b.balance) - Number(a.balance);
        });

        let totalAmount = BigInt(0);
        for (const coin of coins) {
            if (totalAmount <= expectedAmountAsBigInt) {
                coinIds.push(coin.coinObjectId);
                totalAmount = totalAmount + BigInt(coin.balance);//  totalAmount.add(coin.balance);
            } else {
                if (addEmptyCoins && BigInt(coin.balance) == 0n) {
                    coinIds.push(coin.coinObjectId);
                }
            }
        }

        if (totalAmount >= expectedAmountAsBigInt) {
            return coinIds;
        }

        return null;
    }
};
