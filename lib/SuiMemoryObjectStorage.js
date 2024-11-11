import SuiCommonMethods from './SuiCommonMethods.js';
import SuiObject from './SuiObject.js';

/**
 * Class to work with SuiObject's in bulk
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
     */
    constructor(params = {}) {
        super(params);

        this._suiMaster = params.suiMaster;

        /** @type {Object.<string, SuiObject>} */
        this._objects = {};
    }

    asArray() {
        return Object.values(this._objects);
    }

    findMostRecentByTypeName(typeName) {
        return this.findMostRecent((object) => {
                return (object.typeName == typeName);
            });
    }

    find(filterFunction) {
        for (const id in this._objects) {
            if (filterFunction(this._objects[id])) {
                return this._objects[id];
            }
        }

        return null;
    }

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
     * @param {SuiObject | string} suiObjectOrId 
     * 
     * @returns {SuiObject | null}
     */
    push(suiObjectOrId) {
        if (suiObjectOrId && suiObjectOrId.address) {
            const /** @type {SuiObject} */ obj = suiObjectOrId;
            this._objects[obj.address] = obj;

            return obj;
        } else if (suiObjectOrId && (''+suiObjectOrId).indexOf('0x') === 0) {
            if (this._objects[suiObjectOrId]) {
                return this._objects[suiObjectOrId];
            }

            const obj = new SuiObject({id: suiObjectOrId, suiMaster: this._suiMaster});
            this._objects[obj.address] = obj;

            return obj;
        }

        return null;
    }

    byAddress(address) {
        if (this._objects[address]) {
            return this._objects[address];
        }
        return null;
    }

    async fetchObjects() {
        const objectsToFetch = this.asArray(); //Object.values(this._objects);

        const objectIds = [];
        for (const object of objectsToFetch) {
            if (!object.isDeleted && objectIds.indexOf(object.address) === -1) {
                objectIds.push(object.address);
            }
        }

        this.log('querying details about', objectIds.length, 'objects');
        this.log(objectIds);

        let results = [];
        const maxCountToFetch = 50;
        for (let i = 0; i < objectIds.length; i += maxCountToFetch) {
            const objectIdsSlice = objectIds.slice(i, i + maxCountToFetch);

            let resultsSlice = [];
            let consoleWarnMessage = null;
            try {
                const originalConsoleWarn = console.warn;
                console.warn = (e)=>{
                    consoleWarnMessage = e;
                };
                resultsSlice = await this._suiMaster._client.multiGetObjects({
                    ids: objectIdsSlice,
                    options: { showType: true, showContent: true, showOwner: true, showDisplay: true, },
                  });
                console.warn = originalConsoleWarn;
            } catch(e) {
                console.error(e);
            }

            if (consoleWarnMessage) {
                this.log('got', resultsSlice.length, 'objects but with warning (ok, but probably it is different client vs rpc versions)');
            } else {
                this.log('got', resultsSlice.length, 'objects');
            }

            if (resultsSlice && resultsSlice.length) {
                results = results.concat(resultsSlice);
            }
        }

        for (const object of objectsToFetch) {
            const foundInResults = results.find(element => object.idEquals(element?.data?.objectId));
            if (foundInResults) {
                object.tryToFillDataFromObjectChange(foundInResults);
                // this.log('got updates for object', object.address, object.fields);
            } else {
                // object is removed?
                const foundInRemoved = results.find(element => (element?.error?.code == 'deleted' && object.idEquals(element?.error?.object_id)));
                if (foundInRemoved) {
                    object.markAsDeleted();
                } else {
                    this.log('not found in results', object);
                }
            }
        }
    }

    static _instances = {};

    /**
     * @param {string} validatorId - just a string for single instance identifier
     * @param {Object} params - Initialization parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * 
     * @returns {SuiMemoryObjectStorage}
     */
    static instanceOf(validatorId, params = {}) {
        if (SuiMemoryObjectStorage._instances[validatorId]) {
            return SuiMemoryObjectStorage._instances[validatorId];
        }

        SuiMemoryObjectStorage._instances[validatorId] = new SuiMemoryObjectStorage(params);
        return SuiMemoryObjectStorage._instances[validatorId];
    }
};
