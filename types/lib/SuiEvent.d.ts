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
    constructor(params: {
        suiMaster: SuiMaster;
        data?: SuiEventData;
        debug?: boolean;
    });
    _debug: boolean;
    /** @type {SuiMaster} */
    _suiMaster: SuiMaster;
    /** @type {SuiEventData} */
    _data: SuiEventData;
    detail: this;
    /**
     * Debug logger. No-op unless the instance was constructed with `debug: true`.
     * Prefixes messages with the SuiMaster instance number and the class name.
     * @param {...any} args
     */
    log(...args: any[]): void;
    /** Brand property for duck-typing. @returns {true} */
    get isSuiEvent(): true;
    /**
     * In-module type name — last segment of `package::module::Name<...>`, without package/module prefix or `<T..>` suffix.
     * @returns {?string}
     */
    get typeName(): string | null;
    /**
     * Raw event data as received from the client.
     * @returns {SuiEventData}
     */
    get data(): SuiEventData;
    /**
     * JSON representation of the event's Move struct contents.
     * @returns {?Object}
     */
    get parsedJson(): any | null;
    /**
     * Timestamp (milliseconds since epoch) of the checkpoint the emitting transaction was finalized in.
     * @returns {?number}
     */
    get timestampMs(): number | null;
}
export type SuiMaster = import("./SuiMaster.js").default;
export type SuiEventData = {
    /**
     * - Fully-qualified Move type of the event, e.g. `<pkg>::<module>::<EventName>`
     */
    type?: string;
    /**
     * - JSON representation of the event's Move struct contents
     */
    parsedJson?: any;
    /**
     * - Timestamp (ms since epoch) of the checkpoint the event's tx was finalized in
     */
    timestampMs?: string | number;
    /**
     * - SuiAddress of the sender of the emitting transaction
     */
    sender?: string;
    /**
     * - Digest of the emitting transaction
     */
    transactionDigest?: string;
    /**
     * - Event position within its transaction
     */
    sequenceNumber?: string | number;
    /**
     * - BCS bytes (base64 string from GraphQL, Uint8Array from gRPC)
     */
    bcs?: string | Uint8Array;
};
