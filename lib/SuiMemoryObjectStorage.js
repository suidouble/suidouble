const SuiCommonMethods = require('./SuiCommonMethods.js');

class SuiMemoryObjectStorage extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._suiMaster = params.suiMaster;
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

    push(object) {
        if (object.address) {
            this._objects[object.address] = object;

            return true;
        }

        return false;
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
                resultsSlice = await this._suiMaster._provider.multiGetObjects({
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

    static instanceOf(validatorId, params = {}) {
        if (SuiMemoryObjectStorage._instances[validatorId]) {
            return SuiMemoryObjectStorage._instances[validatorId];
        }

        SuiMemoryObjectStorage._instances[validatorId] = new SuiMemoryObjectStorage(params);
        return SuiMemoryObjectStorage._instances[validatorId];
    }
};

module.exports = SuiMemoryObjectStorage;