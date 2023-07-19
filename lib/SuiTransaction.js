const SuiCommonMethods = require('./SuiCommonMethods.js');

class SuiTransaction extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._debug = !!params.debug;
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is requried for suiPackage');
        }

        this._data = params.data || {};

        this._results = null;
        this._events = null;
    }

    get data() {
        return this._data;
    }

    get status() {
        let status = null;
        if (this.data && this.data.effects && this.data.effects.status && this.data.effects.status.status) {
            status = this.data.effects.status.status;
        }
        return status;
    }

    isSuccessful() {
        if (this.data && this.data.effects && this.data.effects.status && this.data.effects.status.status) {
            if (this.data.effects.status.status == 'success') {
                return true;
            }
        }

        return false;
    }

    get events() {
        if (this._events) {
            return this._events;
        }

        const events = [];

        if (this.data.events && this.data.events.length) {
            for (const event of this.data.events) {
                const suiEvent = new this._suiMaster.SuiEvent({
                    suiMaster: this._suiMaster,
                    debug: this._debug,
                    data: event,
                });

                events.push(suiEvent);
            }
        }

        this._events = events;
        return this._events;
    }

    get results() {
        if (this._results) {
            return this._results;
        }

        const objects = {};

        const listCreated = [];
        const listMutated = [];
        const listDeleted = [];

        if (this.data.objectChanges) {
            for (const objectChange of this.data.objectChanges) {
                if (objectChange.objectId) {
                    if (objects[objectChange.objectId]) {
    
                    } else {
                        const obj = new this._suiMaster.SuiObject({
                            suiMaster: this._suiMaster,
                            debug: this._debug,
                            objectChange: objectChange,
                        });
                        if (obj.address) {
                            objects[obj.address] = obj;
                        }
                    }
                }
            }
        }

        if (this.data.effects) {
            const events = ['created', 'mutated']; // events names are the same as properties in result.effects

            for (const eventName of events) {
                if ( this.data.effects[eventName] &&  this.data.effects[eventName].length) {
                    for (const effect of this.data.effects[eventName]) {
                        if (effect.reference && effect.reference.objectId) {
                            if (objects[effect.reference.objectId]) {
                                if (eventName === 'created') {
                                    listCreated.push(objects[effect.reference.objectId]);
                                } else if (eventName === 'mutated') {
                                    listMutated.push(objects[effect.reference.objectId]);
                                }
                            }
                        }
                    }
                }
            }

            if (this.data.effects.deleted) {
                for (const effect of this.data.effects.deleted) {
                    if (effect.objectId) {
                        if (objects[effect.objectId]) {

                        } else {
                            const obj = new this._suiMaster.SuiObject({
                                suiMaster: this._suiMaster,
                                debug: this._debug,
                                objectChange: effect,
                            });
                            objects[effect.objectId] = obj;
                        }
                        objects[effect.objectId].markAsDeleted();
                        listDeleted.push(objects[effect.objectId]);
                    }
                }
            }
        }

        this._results = {
            created: listCreated,
            mutated: listMutated,
            deleted: listDeleted,
            objects: Object.values(objects),
        };

        return this._results;
    }

    get timestampMs() {
        if (this.data.timestampMs) {
            return parseInt(''+this.data.timestampMs, 10);
        } else {
            return null;
        }
    }
};

module.exports = SuiTransaction;