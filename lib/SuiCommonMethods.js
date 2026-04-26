/**
 * Minimal `CustomEvent` polyfill — `globalThis.CustomEvent` is not universally available
 * in Node runtimes, so suidouble dispatches its own class with a `detail` field.
 */
class CustomEvent extends Event {
	#detail;

	/**
	 * @param {string} type
	 * @param {EventInit & { detail?: * }} [options]
	 */
	constructor(type, options) {
		super(type, options);
		this.#detail = options?.detail ?? null;
	}

	/** @returns {*} the payload passed via `options.detail` at construction time, or null */
	get detail() {
		return this.#detail;
	}
}

/**
 * Base class for suidouble domain objects. Extends `EventTarget` so subclasses can emit
 * events via `this.emit(...)` and consumers can subscribe via `addEventListener(...)`.
 * Also provides a debug-gated `log(...)` helper.
 */
export default class SuiCommonMethods extends EventTarget {
    /**
     * @param {Object} [params]
     * @param {boolean} [params.debug] - enable debug logging via `log(...)`
     */
    constructor(params = {}) {
		super();

        this._debug = !!params.debug;
    }

	/**
	 * Debug logger. No-op unless the instance was constructed with `debug: true`.
	 * Prefixes messages with the owning SuiMaster's instance number (if available) and the class name.
	 * @param {...any} args
	 */
	log(...args) {
		if (!this._debug) {
			return;
		}

		const self = /** @type {any} */ (this);
		let prefix = (self._suiMaster ? (''+self._suiMaster.instanceN+' |') : (self.instanceN ? ''+self.instanceN+' |' : '') );

		args.unshift(this.constructor.name+' |');
		args.unshift(prefix);
		console.info.apply(null, args);
	}

	/**
	 * Dispatch an event to registered `addEventListener` subscribers.
	 *
	 * If `data` is a `SuiEvent` (has `isSuiEvent === true`) and `forceCustom` is falsy, it is dispatched
	 * directly so its own `.type` (the Move event name) is used — this lets consumers
	 * `addEventListener('ChatShopCreated', …)` without wrapping. Otherwise dispatches a `CustomEvent`
	 * of type `eventType` with `data` placed on the event's `detail` field.
	 *
	 * Any dispatch errors are caught and logged to `console.error` so a buggy listener can't abort the
	 * surrounding flow.
	 *
	 * @param {string} eventType - event name when wrapping in a CustomEvent (ignored for direct SuiEvent dispatch)
	 * @param {*} data - payload; SuiEvent is dispatched directly, anything else is wrapped
	 * @param {boolean} [forceCustom=false] - if true, always wrap in a CustomEvent even for SuiEvent payloads
	 */
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
};
