/**
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 */
/**
 * In-memory registry of `SuiObject` instances keyed by normalized address. One instance is
 * created per connected chain (see `instanceOf`). Used by `SuiPackageModule` and friends to
 * deduplicate object references across moveCall results and queries.
 *
 * Sample usage:
 * ```
 * suiMemoryObjectStorage.push(id);
 * suiMemoryObjectStorage.push(suiObject);
 * await suiMemoryObjectStorage.fetchObjects();
 * suiMemoryObjectStorage.byAddress(id);
 * ```
 */
export default class SuiMemoryObjectStorage extends SuiCommonMethods {
    static _instances: {};
    /**
     * Return (and lazily create) a shared SuiMemoryObjectStorage keyed by `validatorId`.
     * Typically `validatorId` is the connected chain name (`sui:mainnet`, `sui:localnet`, …) so that
     * objects from different chains stay isolated.
     *
     * @param {string} validatorId - identifier for the singleton slot (chain name by convention)
     * @param {Object} params - Initialization parameters used only on first creation for that slot
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {boolean} [params.debug]
     * @returns {SuiMemoryObjectStorage}
     */
    static instanceOf(validatorId: string, params: {
        suiMaster: SuiMaster;
        debug?: boolean;
    }): SuiMemoryObjectStorage;
    /**
     * SuiMemoryObjectStorage constructor
     * @param {Object} params - Initialization parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {boolean} [params.debug]
     */
    constructor(params: {
        suiMaster: SuiMaster;
        debug?: boolean;
    });
    /** @type {SuiMaster} */
    _suiMaster: SuiMaster;
    /** @type {Object.<string, SuiObject>} */
    _objects: {
        [x: string]: SuiObject;
    };
    /** @returns {SuiObject[]} all stored SuiObjects, in insertion order */
    asArray(): SuiObject[];
    /**
     * Find the most-recently-pushed object whose `typeName` (short type name, e.g. "ChatTopMessage")
     * matches `typeName`. Ordering is by each object's `constructedAt` timestamp.
     *
     * @param {string} typeName
     * @returns {?SuiObject}
     */
    findMostRecentByTypeName(typeName: string): SuiObject | null;
    /**
     * Return the first stored object for which `filterFunction` returns truthy.
     * @param {(obj: SuiObject) => boolean} filterFunction
     * @returns {?SuiObject}
     */
    find(filterFunction: (obj: SuiObject) => boolean): SuiObject | null;
    /**
     * Return the most-recently-constructed object (by `constructedAt`) that matches `filterFunction`.
     * @param {(obj: SuiObject) => boolean} filterFunction
     * @returns {?SuiObject}
     */
    findMostRecent(filterFunction: (obj: SuiObject) => boolean): SuiObject | null;
    /**
     * Store a SuiObject, or wrap a raw `0x…` id in a new SuiObject and store it.
     * If an object with the same address is already stored, it is returned as-is (no replacement).
     *
     * @param {SuiObject | string} suiObjectOrId - a SuiObject instance, or a `0x…` id string
     * @returns {?SuiObject} the stored instance, or null if input didn't look like either
     */
    push(suiObjectOrId: SuiObject | string): SuiObject | null;
    /**
     * Lookup by address. The address must already be in its normalized form (as produced by SuiObject).
     * @param {string} address
     * @returns {?SuiObject}
     */
    byAddress(address: string): SuiObject | null;
    /**
     * Refresh every non-deleted stored SuiObject's fields from chain.
     * Delegates to `SuiMaster.getObjects(...)` which mutates the passed-in instances in place.
     *
     * @returns {Promise<SuiObject[]>}
     */
    fetchObjects(): Promise<SuiObject[]>;
}
export type SuiMaster = import("./SuiMaster.js").default;
import SuiCommonMethods from './SuiCommonMethods.js';
import SuiObject from './SuiObject.js';
