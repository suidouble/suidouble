import SuiCommonMethods from './SuiCommonMethods.js';
import SuiObject from './SuiObject.js';

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
    /**
     * SuiMemoryObjectStorage constructor
     * @param {Object} params - Initialization parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {boolean} [params.debug]
     */
    constructor(params) {
        super(params);

        /** @type {SuiMaster} */
        this._suiMaster = params.suiMaster;

        /** @type {Object.<string, SuiObject>} */
        this._objects = {};
    }

    /** @returns {SuiObject[]} all stored SuiObjects, in insertion order */
    asArray() {
        return Object.values(this._objects);
    }

    /**
     * Find the most-recently-pushed object whose `typeName` (short type name, e.g. "ChatTopMessage")
     * matches `typeName`. Ordering is by each object's `constructedAt` timestamp.
     *
     * @param {string} typeName
     * @returns {?SuiObject}
     */
    findMostRecentByTypeName(typeName) {
        return this.findMostRecent((object) => {
                return (object.typeName == typeName);
            });
    }

    /**
     * Return the first stored object for which `filterFunction` returns truthy.
     * @param {(obj: SuiObject) => boolean} filterFunction
     * @returns {?SuiObject}
     */
    find(filterFunction) {
        for (const id in this._objects) {
            if (filterFunction(this._objects[id])) {
                return this._objects[id];
            }
        }

        return null;
    }

    /**
     * Return the most-recently-constructed object (by `constructedAt`) that matches `filterFunction`.
     * @param {(obj: SuiObject) => boolean} filterFunction
     * @returns {?SuiObject}
     */
    findMostRecent(filterFunction) {
        let mostRecentDate = null;
        let mostRecentObject = null;

        for (const id in this._objects) {
            if (filterFunction(this._objects[id])) {
                if (!mostRecentDate || (mostRecentDate.getTime() <= this._objects[id].constructedAt.getTime())) {
                    mostRecentDate = this._objects[id].constructedAt;
                    mostRecentObject = this._objects[id];
                }
            }
        }

        return mostRecentObject;
    }

    /**
     * Store a SuiObject, or wrap a raw `0x…` id in a new SuiObject and store it.
     * If an object with the same address is already stored, it is returned as-is (no replacement).
     *
     * @param {SuiObject | string} suiObjectOrId - a SuiObject instance, or a `0x…` id string
     * @returns {?SuiObject} the stored instance, or null if input didn't look like either
     */
    push(suiObjectOrId) {
        const a = /** @type {any} */ (suiObjectOrId);
        if (a && a.address) {
            const obj = /** @type {SuiObject} */ (a);
            this._objects[obj.address] = obj;

            return obj;
        } else if (a && (''+a).indexOf('0x') === 0) {
            const id = /** @type {string} */ (a);
            if (this._objects[id]) {
                return this._objects[id];
            }

            const obj = new SuiObject({id, suiMaster: this._suiMaster});
            this._objects[obj.address] = obj;

            return obj;
        }

        return null;
    }

    /**
     * Lookup by address. The address must already be in its normalized form (as produced by SuiObject).
     * @param {string} address
     * @returns {?SuiObject}
     */
    byAddress(address) {
        if (this._objects[address]) {
            return this._objects[address];
        }
        return null;
    }

    /**
     * Refresh every non-deleted stored SuiObject's fields from chain.
     * Delegates to `SuiMaster.getObjects(...)` which mutates the passed-in instances in place.
     *
     * @returns {Promise<SuiObject[]>}
     */
    async fetchObjects() {
        const objectsToFetch = this.asArray().filter((o) => !o.isDeleted);
        if (!objectsToFetch.length) return [];

        this.log('querying details about', objectsToFetch.length, 'objects');
        await this._suiMaster.getObjects(objectsToFetch);

        return objectsToFetch;
    }

    static _instances = {};

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
    static instanceOf(validatorId, params) {
        if (SuiMemoryObjectStorage._instances[validatorId]) {
            return SuiMemoryObjectStorage._instances[validatorId];
        }

        SuiMemoryObjectStorage._instances[validatorId] = new SuiMemoryObjectStorage(params);
        return SuiMemoryObjectStorage._instances[validatorId];
    }
};
