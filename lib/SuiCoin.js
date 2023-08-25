const { Transactions } = require('@mysten/sui.js/transactions');

const safeList = {
    'sui:mainnet': {
        '0xa198f3be41cda8c07b3bf3fee02263526e535d682499806979a111e88a5a8d0f::coin::COIN': 'CELO',
        '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN': 'tBTC',
        '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN': 'USDCeth',
        '0xe32d3ebafa42e6011b87ef1087bbc6053b499bf6f095807b9013aff5a6ecd7bb::coin::COIN': 'USDCarb',
        '0x909cba62ce96d54de25bec9502de5ca7b4f28901747bbf96b76c2e63ec5f1cba::coin::COIN': 'USDCbnb',
        '0xcf72ec52c0f8ddead746252481fb44ff6e8485a39b803825bde6b00d77cdb0bb::coin::COIN': 'USDCpol',
        '0xb231fcda8bbddb31f2ef02e6161444aec64a514e2c89279584ac9806ce9cf037::coin::COIN': 'USDCsol',
        '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN': 'USDT',
        '0x1e8b532cca6569cab9f9b9ebc73f8c13885012ade714729aa3b450e0339ac766::coin::COIN': 'WAVAX',
        '0xb848cce11ef3a8f62eccea6eb5b35a12c4c2b1ee1af7755d02d7bd6218e8226f::coin::COIN': 'WBNB',
        '0x027792d9fed7f9844eb4839566001bb6f6cb4804f66aa2da6fe1ee242d896881::coin::COIN': 'WBTC',
        '0xaf8cd5edc19c4512f4259f0bee101a40d41ebed738ade5874359610ef8eeced5::coin::COIN': 'WETH',
        '0x6081300950a4f1e2081580e919c210436a1bed49080502834950d31ee55a2396::coin::COIN': 'WFTM',
        '0x66f87084e49c38f76502d17f87d17f943f183bb94117561eb573e075fdc5ff75::coin::COIN': 'WGLMR',
        '0xdbe380b13a6d0f5cdedd58de8f04625263f113b3f9db32b3e1983f49e2841676::coin::COIN': 'WMATIC',
        '0xb7844e289a8410e50fb3ca48d69eb9cf29e27d223ef90353fe1bd8e27ff8f3f8::coin::COIN': 'WSOL',
        '0x2::sui::SUI': 'SUI',
    },
};

class SuiCoin {
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
        return str.substring(0, ind) + '.' + str.substring(ind);
    }

    get suiMaster() {
        return this._suiCoins.suiMaster;
    }

    static safeList(connectedChain) {
        return safeList[connectedChain];
    }

    get coinType() {
        if (this._coinType.indexOf('0x') === 0) {
            return this._coinType;
        }

        return '0x'+this._coinType;
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

    get safeList() {
        if (this.suiMaster && this.suiMaster.connectedChain) {
            if (safeList[this.suiMaster.connectedChain]) {
                return safeList[this.suiMaster.connectedChain];
            }
        }

        return {};
    }

    get isSafe() {
        if (this.safeList[this.coinType]) {
            return true;
        }

        return false;
    }

    get symbol() {
        if (this.safeList[this.coinType]) {
            return this.safeList[this.coinType];
        }

        if (this.metadata) {
            return this.metadata.symbol;
        }

        return null;
    }

    get name() {
        return this.metadata.name;
    }

    isSUI() {
        return this._coinType.toLowerCase().indexOf('sui') > -1;
    }

    async getMetadata() {
        if (this._metadata) {
            return this._metadata;
        }

        let result = null;
        try {
            result = await this.suiMaster.provider.getCoinMetadata({
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
        }

        return this._metadata;
    }

    async getBalance(owner) {
        const coins = [];
        let result = null;
        let cursor = null;
        do {
            result = await this.suiMaster.provider.getCoins({
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
                const coinInput = txb.add(Transactions.SplitCoins(txb.gas, [txb.pure(expectedAmountAsBigInt)]));
                return coinInput;
            } else {
                // some other coin
                const coinInput = txb.add(Transactions.SplitCoins(txb.object(coinIds[0]), [txb.pure(expectedAmountAsBigInt)]));
                return coinInput;
            }
        } else {
            // few coin objects to merge
            const coinIdToMergeIn = coinIds.shift();
            txb.add(Transactions.MergeCoins(txb.object(coinIdToMergeIn), coinIds.map((id)=>{return txb.object(id);})));
            const coinInputSplet = txb.add(Transactions.SplitCoins(txb.object(coinIdToMergeIn), [txb.pure(expectedAmountAsBigInt)]));

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
            result = await this.suiMaster.provider.getCoins({
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
}

module.exports = SuiCoin;