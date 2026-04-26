/**
 * @typedef {import("./SuiTransaction.js").default} SuiTransaction
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 * @typedef {import("./SuiPackage.js").default} SuiPackage
 * @typedef {import("./SuiEvent.js").default} SuiEvent
 * @typedef {import("./SuiMemoryObjectStorage.js").default} SuiMemoryObjectStorage
 * @typedef {import("@mysten/sui/transactions").CallArg} CallArg
 */
export default class SuiPackageModule extends SuiCommonMethods {
    /**
     * SuiPackageModule constructor
     * @param {Object} params - Initialization parameters
     * @param {SuiPackage} params.package - instance of SuiPackage this module is part of
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {string} params.moduleName - name of the Move module
     * @param {boolean} [params.debug]
     */
    constructor(params: {
        package: SuiPackage;
        suiMaster: SuiMaster;
        moduleName: string;
        debug?: boolean;
    });
    _package: import("./SuiPackage.js").default;
    _suiMaster: import("./SuiMaster.js").default;
    _moduleName: string;
    /**
     * Shortcut for `suiMaster.utils.pureInput(type, value)` — build a BCS-serialised Pure input
     * to use as a moveCall parameter.
     * @param {string} type - BCS type name, e.g. `'u64'`, `'address'`, `'string'`
     * @param {*} value
     * @returns {CallArg}
     */
    arg(type: string, value: any): CallArg;
    /** @returns {SuiMemoryObjectStorage} shared object storage for this suiMaster */
    get objectStorage(): SuiMemoryObjectStorage;
    /** @returns {Object.<string, SuiObject>} raw map of address → SuiObject */
    get objects(): {
        [x: string]: SuiObject;
    };
    /** @returns {SuiObject[]} all objects in storage as an array */
    get objectsArray(): SuiObject[];
    /**
     * Add an object to the shared objectStorage by address or SuiObject instance.
     * If the object is already stored, returns the existing instance.
     * Emits `'added'` if a new bare SuiObject is created from an id string.
     *
     * @param {SuiObject | string} suiObjectOrAddress
     * @returns {?SuiObject}
     */
    pushObject(suiObjectOrAddress: SuiObject | string): SuiObject | null;
    /**
     * Execute a Move function on this module.
     *
     * Builds a `Transaction` from `params`, signs and executes it, then syncs the local
     * `objectStorage` with the effects.
     *
     * After the call the following events are emitted on this module:
     *   - `'added'`   — for each created or first-seen-mutated SuiObject (payload: SuiObject)
     *   - `'created'` — for each chain-created SuiObject (payload: SuiObject)
     *   - `'deleted'` — for each deleted SuiObject (payload: SuiObject)
     *
     * `params` element shapes:
     *   - `{ type, amount }` — coin argument; converted via `SuiCoin.coinOfAmountToTxCoin`
     *   - `[{ type, amount }]` — single-element array → `vector<Coin<T>>` via `makeMoveVec`
     *   - `'0x…'` string → `tx.object(id)`
     *   - `{ Pure: { bytes } }` → already-serialised Pure input
     *   - anything else → `tx.pure(value)`
     *
     * @param {string} methodName - name of the Move function to call
     * @param {Array} params - call arguments
     * @param {string[]} [typeArguments] - Move type parameters, e.g. `['0x2::sui::SUI']`
     * @returns {Promise<SuiTransaction>}
     */
    moveCall(methodName: string, params: any[], typeArguments?: string[]): Promise<SuiTransaction>;
    /**
     * Sign and execute a pre-built Transaction, then sync `objectStorage` with the effects and
     * emit change events on this module.
     *
     * Emits per-object events:
     *   - `'added'`   — created objects not yet in storage, and first-seen mutated objects
     *   - `'created'` — every chain-created object
     *   - `'deleted'` — every deleted object
     *
     * @param {Transaction} tx
     * @returns {Promise<SuiTransaction>}
     */
    executeTransaction(tx: Transaction): Promise<SuiTransaction>;
    /**
     * List objects of this module owned by the current SuiMaster address.
     * Uses the original (first-version) package id so the filter is stable across upgrades.
     *
     * @param {Object} [params]
     * @param {?string} [params.typeName] - If set, narrows the type filter to `<pkg>::<module>::<typeName>`.
     *                                      Otherwise filters by `<pkg>::<module>`.
     * @param {number} [params.limit=50]
     * @param {string} [params.order]
     * @returns {Promise<SuiPaginatedResponse<SuiObject>>}
     */
    getOwnedObjects(params?: {
        typeName?: string | null;
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<SuiObject>>;
    /**
     * Fetch events emitted by this module, via the GraphQL `events` query.
     * Uses the original (first-version) package id of the parent SuiPackage so the filter
     * is stable across upgrades.
     *
     * @param {Object} [params]
     * @param {?string} [params.eventTypeName] - If set, narrows the filter to a single event struct
     *                                           (`<pkg>::<module>::<EventName>`). Otherwise fetches
     *                                           all events emitted by any function in this module.
     * @param {number} [params.limit=50]
     * @param {string} [params.order] - Passed through to the underlying paginated response
     * @returns {Promise<SuiPaginatedResponse<SuiEvent>>}
     */
    fetchEvents(params?: {
        eventTypeName?: string | null;
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<SuiEvent>>;
    /**
     * Refresh all objects in the shared objectStorage from chain.
     * Delegates to `SuiMemoryObjectStorage.fetchObjects()`.
     * @returns {Promise<SuiObject[]>}
     */
    fetchObjects(): Promise<SuiObject[]>;
}
export type SuiTransaction = import("./SuiTransaction.js").default;
export type SuiMaster = import("./SuiMaster.js").default;
export type SuiPackage = import("./SuiPackage.js").default;
export type SuiEvent = import("./SuiEvent.js").default;
export type SuiMemoryObjectStorage = import("./SuiMemoryObjectStorage.js").default;
export type CallArg = import("@mysten/sui/transactions").CallArg;
import SuiCommonMethods from './SuiCommonMethods.js';
import SuiObject from './SuiObject.js';
import { Transaction } from '@mysten/sui/transactions';
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
