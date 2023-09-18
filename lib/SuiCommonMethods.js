
class CustomEvent extends Event {
	#detail;

	constructor(type, options) {
		super(type, options);
		this.#detail = options?.detail ?? null;
	}

	get detail() {
		return this.#detail;
	}
}

class SuiCommonMethods extends EventTarget {
    constructor(params = {}) {
		super();

        this._debug = !!params.debug;
    }

	log(...args) {
		if (!this._debug) {
			return;
		}

		let prefix = (this._suiMaster ? (''+this._suiMaster.instanceN+' |') : (this.instanceN ? ''+this.instanceN+' |' : '') );

		args.unshift(this.constructor.name+' |');
		args.unshift(prefix);
		console.info.apply(null, args);
	}

	emit(eventType, data, forceCustom = false) {
		try {
			if (data && data.isSuiEvent && !forceCustom) {
				this.dispatchEvent(data);
			} else {
				this.dispatchEvent(new CustomEvent(eventType, { detail: data }));
			}
		} catch (e) {
			console.error(e);
		}
	}
}

module.exports = SuiCommonMethods;
