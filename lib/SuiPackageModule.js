const sui = require('@mysten/sui.js');
const SuiObject = require('./SuiObject.js');

const SuiCommonMethods = require('./SuiCommonMethods.js');
const SuiPaginatedResponse = require('./SuiPaginatedResponse.js');
// fromB64, toB64

class SuiPackageModule extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._package = params.package;
        if (!this._package) {
            throw new Error('package is required for SuiPackageModule');
        }
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is requried for SuiPackageModule');
        }
        this._moduleName = params.moduleName;
        if (!this._moduleName) {
            throw new Error('moduleName is required for SuiPackageModule');
        }

        // this._objects = {};
        // this._objectsArray = [];

        // we need to get very first version's address of this package to use for types, so we are doing this in separate call
        this._checkedOnChain = false;
        this._normalizedMoveModule = {};
    }

    get objectStorage() {
        return this._suiMaster.objectStorage;
    }

    get objects() {
        return this.objectStorage._objects;
    }

    get objectsArray() {
        return this.objectStorage.asArray();
    }

    pushObject(suiObjectOrAddress) {
        let address = `${suiObjectOrAddress}`;
        if (suiObjectOrAddress.address) {
            address = suiObjectOrAddress.address;
        }
        try {
            address = sui.normalizeSuiAddress(address);
            if (!this.objectStorage.byAddress(address)) {
                if (suiObjectOrAddress.address) {
                    // instance of suiObject
                    this.objectStorage.push(suiObjectOrAddress);
                } else {
                    const obj = new SuiObject({
                        suiMaster: this._suiMaster,
                        debug: this._debug,
                        id: address,
                    });
                    this.objectStorage.push(obj);
                    this.emit('added', obj);
                }
            }

            return this.objectStorage.byAddress(address);
        } catch (e) {
            this.log('error', e);
        }

        return null;
    }

    async moveCall(methodName, params) {
        await this._package.checkOnChainIfNeeded();

        const tx = new sui.TransactionBlock();

        const callArgs = [];
        for (let param of params) {
            if (param.indexOf && param.indexOf('<SUI>') === 0) {
                let amount = BigInt(param.split('>')[1]);
                const coin = tx.add(sui.Transactions.SplitCoins(tx.gas, [tx.pure(amount)]));
                callArgs.push(coin);
            } else {
                callArgs.push(tx.pure(param));
            }
        }
        tx.moveCall({
            target: `${this._package.address}::${this._moduleName}::${methodName}`,
            arguments: callArgs,
        });

        const result = await this._suiMaster._signer.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            requestType: 'WaitForLocalExecution',
            options: {
                "showEffects": true, // @todo: remove?
                "showEvents": true, // @todo: remove?
                "showObjectChanges": true,
                showType: true,
                showContent: true,
                showOwner: true,
                showDisplay: true,
            },
        });

        const listCreated = [];
        const listMutated = [];
        const listDeleted = [];

        for (const objectChange of result.objectChanges) {
            if (objectChange.objectId) {
                if (this.objectStorage.byAddress(objectChange.objectId)) {
                    this.objectStorage.byAddress(objectChange.objectId).tryToFillDataFromObjectChange(objectChange);
                } else {
                    const obj = new SuiObject({
                        suiMaster: this._suiMaster,
                        debug: this._debug,
                        objectChange: objectChange,
                    });

                    if (obj.address) {
                        this.objectStorage.push(obj);
                        
                        this.emit('added', obj);
                    }
                }
            }
        }

        // Mark objects as deleted so we don't fetch them
        if (result.effects && result.effects.deleted && result.effects.deleted.length) {
            for (const effect of result.effects.deleted) {
                // if (effect.reference && effect.reference.objectId) {
                //     if (this._objects[effect.reference.objectId]) {
                //         this.log('object is deleted', effect.reference.objectId);
                //         this._objects[effect.reference.objectId].markAsDeleted();
                //     }
                // }
                if (effect.objectId) {
                    if (this.objectStorage.byAddress(effect.objectId)) {
                        this.log('object is deleted', effect.objectId);
                        this.objectStorage.byAddress(effect.objectId).markAsDeleted();
                        this.emit('deleted', this.objectStorage.byAddress(effect.objectId));

                        listDeleted.push(this.objectStorage.byAddress(effect.objectId));
                    }
                }
            }
        }

        await this.fetchObjects();

        // Emit events based on result.effects
        if (result.effects) {
            const events = ['created', 'mutated']; // events names are the same as properties in result.effects

            for (const eventName of events) {
                if (result.effects[eventName] && result.effects[eventName].length) {
                    for (const effect of result.effects[eventName]) {
                        if (effect.reference && effect.reference.objectId) {
                            if (this.objectStorage.byAddress(effect.reference.objectId)) {
                                this.emit(eventName, this.objectStorage.byAddress(effect.reference.objectId));

                                if (eventName === 'created') {
                                    listCreated.push(this.objectStorage.byAddress(effect.reference.objectId));
                                } else if (eventName === 'mutated') {
                                    listMutated.push(this.objectStorage.byAddress(effect.reference.objectId));
                                }
                            }
                        }
                    }
                }
            }
        }

        if (result.events && result.events.length) {
            for (const event of result.events) {
                const eventType = event.type;
                const eventTypeName = eventType.split(':').pop(); // last name, without package and module names

                const eventData = event.parsedJson;
                this.emit(eventTypeName, eventData);
            }
        }

        return {
            created: listCreated,
            mutated: listMutated,
            deleted: listDeleted,
        };
    }
      
    async fetchEvents(params = {}) {
        const moduleFilter = {};

        // we need very first package version's id here. So we are getting it from normalized data
        const normalizedPackageAddress = await this.getNormalizedPackageAddress();
        if (params.eventTypeName) {
            moduleFilter.MoveEventType = `${normalizedPackageAddress}::${this._moduleName}::${params.eventTypeName}`;
            this.log('queriying for events of type: ', moduleFilter.MoveEventType);
        } else {
            moduleFilter.MoveModule = { package: normalizedPackageAddress, module: this._moduleName };
            this.log('queriying for all events of module: ', this._moduleName);
        }

        const queryParams = {
            descending_order: false,
            query: moduleFilter,
            limit: params.limit || 50,
        };

        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this._suiMaster,
            params: queryParams,
            method: 'queryEvents',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return paginatedResponse;
    }

    async fetchObjects() {
        const objectsToFetch = this.objectStorage.asArray(); //Object.values(this._objects);

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
                    // only fetch the object type
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

    async getNormalizedPackageAddress() {
        await this.checkOnChainIfNeeded();
        if (this._normalizedMoveModule && this._normalizedMoveModule.address) {
            return this._normalizedMoveModule.address;
        }
    }

    async checkOnChainIfNeeded() {
        if (this._checkedOnChain) {
            return true;
        } 

        const normalized = await this._suiMaster._provider.getNormalizedMoveModule({
            package: this._package.address,
            module: this._moduleName,
        });

        if (normalized && normalized.address) {
            this._normalizedMoveModule = normalized;
            this._checkedOnChain = true;
        }

        return true;
    }

}

module.exports = SuiPackageModule;