/**
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 *
 * @typedef SuiEventData
 * @type {object}
 * @property {string} [type] - Fully-qualified Move type of the event, e.g. `<pkg>::<module>::<EventName>`
 * @property {Object} [parsedJson] - JSON representation of the event's Move struct contents
 * @property {string|number} [timestampMs] - Timestamp (ms since epoch) of the checkpoint the event's tx was finalized in
 * @property {string} [sender] - SuiAddress of the sender of the emitting transaction
 * @property {string} [transactionDigest] - Digest of the emitting transaction
 * @property {string|number} [sequenceNumber] - Event position within its transaction
 * @property {string|Uint8Array} [bcs] - BCS bytes (base64 string from GraphQL, Uint8Array from gRPC)
 */

/**
 * Wrapper over a Sui event. Extends the native `Event` so it can be dispatched through
 * `EventTarget`-style listeners; also exposes the common Sui event fields directly.
 */
export default class SuiEvent extends Event {
    /**
     * @param {Object} params - Initialization parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {SuiEventData} [params.data] - raw event data
     * @param {boolean} [params.debug] - enable debug logging
     */
    constructor(params) {
        const typeName = params.data ? ((''+params.data.type).split('<')[0].split('::').pop()) : null;
        super(typeName, {});

        this._debug = !!params.debug;
        /** @type {SuiMaster} */
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is required for SuiEvent');
        }

        /** @type {SuiEventData} */
        this._data = params.data || {};

        this.detail = this; // quick backward support as this is the instance of CustomEvent
    }

    /**
     * Debug logger. No-op unless the instance was constructed with `debug: true`.
     * Prefixes messages with the SuiMaster instance number and the class name.
     * @param {...any} args
     */
	log(...args) {
		if (!this._debug) {
			return;
		}

		const self = /** @type {any} */ (this);
		let prefix = (self._suiMaster ? (''+self._suiMaster.instanceN+' |') : (self.instanceN ? ''+self.instanceN+' |' : '') );
		// prefix += this.constructor.name+' | ';

		args.unshift(this.constructor.name+' |');
		args.unshift(prefix);
		console.info.apply(null, args);
	}

    /** Brand property for duck-typing. @returns {true} */
    get isSuiEvent() {
        return true;
    }

    /**
     * In-module type name — last segment of `package::module::Name<...>`, without package/module prefix or `<T..>` suffix.
     * @returns {?string}
     */
    get typeName() {
        return this._data ? (''+this._data.type).split('<')[0].split('::').pop() : null;
    }

    /**
     * Fully-qualified Move type of the event, e.g. `<pkg>::<module>::<EventName>[<type-params>]`.
     * @returns {?string}
     */
    get type() {
        return this._data ? (''+this._data.type) : null;
    }

    /**
     * Raw event data as received from the client.
     * @returns {SuiEventData}
     */
    get data() {
        return this._data;
    }

    /**
     * JSON representation of the event's Move struct contents.
     * @returns {?Object}
     */
    get parsedJson() {
        if (this._data.parsedJson) {
            return this._data.parsedJson;
        }
        return null;
    }

    /**
     * Timestamp (milliseconds since epoch) of the checkpoint the emitting transaction was finalized in.
     * @returns {?number}
     */
    get timestampMs() {
        if (this._data.timestampMs) {
            return parseInt('' + this._data.timestampMs, 10);
        } else {
            return null;
        }
    }
};