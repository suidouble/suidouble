/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 * @typedef {import("./SuiObject.js").default} SuiObject
 * @typedef {import("./SuiEvent.js").default} SuiEvent
 */
/**
 * Wrapper over a Sui transaction result. Lazily parses `effects.changedObjects` into
 * typed `created`, `mutated`, `deleted` lists and wraps events in `SuiEvent` instances.
 */
export default class SuiTransaction extends SuiCommonMethods {
    /**
     * @param {Object} params
     * @param {SuiMaster} params.suiMaster
     * @param {SuiClientTypes.Transaction} params.data - raw transaction data
     * @param {boolean} [params.debug]
     */
    constructor(params: {
        suiMaster: SuiMaster;
        data: SuiClientTypes.Transaction;
        debug?: boolean;
    });
    /** @type {SuiMaster} */
    _suiMaster: SuiMaster;
    /** @type {?SuiClientTypes.Transaction} */
    _data: SuiClientTypes.Transaction | null;
    /** @type {?{created: SuiObject[], mutated: SuiObject[], deleted: SuiObject[], objects: SuiObject[]}} */
    _results: {
        created: SuiObject[];
        mutated: SuiObject[];
        deleted: SuiObject[];
        objects: SuiObject[];
    } | null;
    /** @type {?SuiEvent[]} */
    _events: SuiEvent[] | null;
    /** @returns {?number} epoch the transaction executed in, or null if unavailable */
    get executedEpoch(): number | null;
    /** @returns {?string} Base58-encoded transaction digest, or null if data isn't set */
    get digest(): string | null;
    /** @returns {?bigint} net gas cost in MIST (computationCost + storageCost − storageRebate), or null */
    get gasUsed(): bigint | null;
    /** @returns {SuiObject[]} objects deleted by this transaction */
    get deleted(): SuiObject[];
    /** @returns {SuiObject[]} objects mutated (version changed) by this transaction */
    get mutated(): SuiObject[];
    /** @returns {SuiObject[]} objects created by this transaction */
    get created(): SuiObject[];
    /** @returns {?SuiClientTypes.Transaction} raw transaction data as received from the client */
    get data(): SuiClientTypes.Transaction | null;
    /**
     * Returns true if the transaction's status indicates success.
     * @returns {boolean}
     */
    isSuccessful(): boolean;
    /** @returns {SuiEvent[]} events emitted by this transaction, lazily built and cached */
    get events(): SuiEvent[];
    /**
     * Parsed object-change results, lazily built from `effects.changedObjects` and cached.
     * @returns {{created: SuiObject[], mutated: SuiObject[], deleted: SuiObject[], objects: SuiObject[]}}
     */
    get results(): {
        created: SuiObject[];
        mutated: SuiObject[];
        deleted: SuiObject[];
        objects: SuiObject[];
    };
    /**
     * Wait for this transaction to be finalised on chain, then refresh `_data` with the full result.
     * Clears the cached `_results` and `_events` so getters recompute from the fresh data.
     *
     * @param {SuiClientTypes.WaitForTransactionOptions} [input] - extra options forwarded to `client.waitForTransaction`
     * @returns {Promise<this>}
     * @throws if `digest` is not set
     */
    waitForTransaction(input?: SuiClientTypes.WaitForTransactionOptions): Promise<this>;
    /**
     * Checkpoint timestamp in milliseconds since epoch, or null if unavailable.
     *
     * Only populated when the transaction was fetched via the GraphQL path
     * (`SuiMaster.fetchTransactions`). Transactions returned from `signAndExecuteTransaction`
     * or `waitForTransaction` (gRPC) do not carry a timestamp in their data shape and will
     * always return null here.
     *
     * @returns {?number}
     */
    get timestampMs(): number | null;
}
export type SuiMaster = import("./SuiMaster.js").default;
export type SuiObject = import("./SuiObject.js").default;
export type SuiEvent = import("./SuiEvent.js").default;
import SuiCommonMethods from './SuiCommonMethods.js';
import type { SuiClientTypes } from "@mysten/sui/client";
