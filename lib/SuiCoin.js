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
     * @param {String|Number|BigInt} amount 
     * @returns {BigInt}
     */
    async lazyNormalizeAmount(amount) {
        await this.getMetadata();
        return this.normalizeAmount(amount);
    }

    amountToString(amount) {
        if (!this.decimals) {
            throw new Error('Please load coin metadata first');
        }

        const str = (''+BigInt(amount)).padStart(this.decimals + 1,'0');
        const ind = str.length - this.decimals;
        let asFloatString = str.substring(0, ind) + '.' + str.substring(ind);

        /// yep, I can't find a better way to strip extra 0 at the end. All regexes are not ok. Ping me if you have a good one
        let i = asFloatString.length - 1;
        let haveNotMetNoZero = false;
        while (i > 0 && !haveNotMetNoZero) {
            if (asFloatString.substring(i, i+1) === '0' && asFloatString.substring(i-1, i) !== '.') {
                asFloatString = asFloatString.substring(0, i);
            } else {
                haveNotMetNoZero = true;
            }
            i--;
        }

        return asFloatString;
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

    async getMetadata() {
        if (this._metadata) {
            return this._metadata;
        }

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

        return this._metadata;
    }

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
     * @returns {TransactionObjectArgument}
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
