const SuiCommonMethods = require('./SuiCommonMethods.js');

class SuiEvent extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is requried for suiPackage');
        }

        this._data = params.data || {};
    }

    /**
     * In module type name, without package and module prefix
     */
    get typeName() {
        return this._data ? this._data.type.split('::').pop() : null;
    }

    get data() {
        return this._data;
    }

    get parsedJson() {
        if (this._data.parsedJson) {
            return this._data.parsedJson;
        }
        return null;
    }

    get timestampMs() {
        if (this._data.timestampMs) {
            return parseInt(this._data.timestampMs, 10);
        } else {
            return null;
        }
    }
};

module.exports = SuiEvent;