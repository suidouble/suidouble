const SuiCommonMethods = require('./SuiCommonMethods.js');

class SuiMemoryObjectStorage extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

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