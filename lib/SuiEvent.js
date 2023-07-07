const SuiCommonMethods = require('./SuiCommonMethods.js');

class SuiEvent extends Event {
    constructor(params = {}) {
        const typeName = params.data ? ((''+params.data.type).split('<')[0].split('::').pop()) : null;
        super(typeName, {});

        this._debug = !!params.debug;
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is requried for suiPackage');
        }

        this._data = params.data || {};

        this.detail = this; // quick backward support as this is the instance of CustomEvent
    }

	log(...args) {
		if (!this._debug) {
			return;
		}

		let prefix = (this._suiMaster ? (''+this._suiMaster.instanceN+' |') : (this.instanceN ? ''+this.instanceN+' |' : '') );
		// prefix += this.constructor.name+' | ';

		args.unshift(this.constructor.name+' |');
		args.unshift(prefix);
		console.info.apply(null, args);
	}

    get isSuiEvent() {
        return true;
    }

    /**
     * In module type name, without package and module prefix and without <T..> suffix
     */
    get typeName() {
        return this._data ? (''+this._data.type).split('<')[0].split('::').pop() : null;
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