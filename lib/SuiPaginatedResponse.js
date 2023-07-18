const sui = require('@mysten/sui.js');
const SuiCommonMethods = require('./SuiCommonMethods.js');
const SuiEvent = require('./SuiEvent.js');
const SuiTransaction = require('./SuiTransaction.js');

class SuiPaginatedResponse extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is requried for SuiPaginatedResponse');
        }

        this._method = params.method;
        this._params = params.params;
        this._order = params.order || 'descending';  // default - newest first, pass {order: 'ascending'} for oldest first

        this._hasNextPage = true;
        this._nextCursor = null;

        this._data = [];
    }

    /**
     * Simple itterator to go over all list of items, not caring about pagination/cursors etc. It fetches next page when needed
     * Optional maxLimit second parameter to stop when reached count
     * @param {Function taking single argument of item} callbackFunc 
     * @param {Number} maxLimit 
     */
    async forEach(callbackFunc, maxLimit = null) {
        let curN = 0;
        do {
            for (const item of this._data) {
                if (!maxLimit || curN < maxLimit) {
                    await callbackFunc(item);
                } 
                curN++;
            }
        } while( (!maxLimit || curN < maxLimit) && (await this.nextPage()) );
    }

    get hasNextPage() {
        return this._hasNextPage;
    }

    get data() {
        return this._data;
    }

    async nextPage() {
        if (this._hasNextPage) {
            return await this.fetch({cursor: this._nextCursor});
        } else {
            return false;
        }
    }

    async fetch(params = {}) {
        const paramsCopy = Object.assign({}, this._params);
        // paramsCopy.limit = 3;

        if (params.cursor) {
            paramsCopy.cursor = params.cursor;
        }
        paramsCopy.order = this._order;

        const response = await this._suiMaster.provider[this._method](paramsCopy);
        let responseCount = 0;
        if (response.data && response.data.length) {
            responseCount = response.data.length;
        }

        if (response.hasNextPage) {
            this._hasNextPage = true;
            this._nextCursor = response.nextCursor;
        } else {
            this._hasNextPage = false;
            this._nextCursor = null;
        }

        this.log('got', responseCount, 'items. Has next page: ', response.hasNextPage);

        if (this._method === 'queryEvents') {
            // convert data to SuiEvent instances
            this._data = response.data.map((raw)=>(new SuiEvent({data: raw, suiMaster: this._suiMaster, debug: this._debug})));
        } else if (this._method === 'queryTransactionBlocks') {
            // convert data to SuiEvent instances
            this._data = response.data.map((raw)=>(new SuiTransaction({data: raw, suiMaster: this._suiMaster, debug: this._debug})));
        } else {
            this._data = response.data;
        }

        return this._data;
    }
};

module.exports = SuiPaginatedResponse;
