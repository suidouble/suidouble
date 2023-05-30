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