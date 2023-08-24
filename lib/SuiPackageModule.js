const sui = require('@mysten/sui.js');
const SuiObject = require('./SuiObject.js');

const SuiCommonMethods = require('./SuiCommonMethods.js');
const SuiPaginatedResponse = require('./SuiPaginatedResponse.js');
const SuiEvent = require('./SuiEvent.js');
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

        this._unsubscribeFunction = null;
    }

    async subscribeEvents() {
        this.log('subscribing to events of module', this._moduleName);

        // we need very first package version's id here. So we are getting it from normalized data
        const normalizedPackageAddress = await this.getNormalizedPackageAddress();

        const onMessage = (rawEvent) => {
            const suiEvent = new SuiEvent({
                suiMaster: this._suiMaster,
                debug: this._debug,
                data: rawEvent,
            });

            const eventTypeName = suiEvent.typeName;
            this.log('got event', eventTypeName);

            this.emit(eventTypeName, suiEvent); // emit specific event name
            this.emit('event', suiEvent, true); // emit to common events flow
        };

        this._unsubscribeFunction = await this._suiMaster._provider.subscribeEvent({
            filter: {"MoveModule": {"package": normalizedPackageAddress, "module": this._moduleName} },
            onMessage: onMessage,
        });
    }

    async unsubscribeEvents() {
        if (this._unsubscribeFunction) {
            await this._unsubscribeFunction();
            this._unsubscribeFunction = null;
            
            return true;
        }

        return false;
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

        let tx = null;
        if (params.tx) {
            tx = params.tx;
        } else {
            tx = new sui.TransactionBlock();

            const callArgs = [];
    
            for (let param of params) {
                if (param && param.type && param.amount) {
                    const ownerAddress = this._suiMaster.address;

                    const suiCoin = await this._suiMaster.suiCoins.get(param.type);
                    const txCoinToSend = await suiCoin.coinOfAmountToTxCoin(tx, ownerAddress, param.amount);

                    callArgs.push(txCoinToSend);
                } else if (param && Array.isArray(param) && param.length == 1 && param[0].type && param[0].amount) {
                    // vector<Coin<SUI>>
                    const ownerAddress = this._suiMaster.address;

                    const suiCoin = await this._suiMaster.suiCoins.get(param.type);
                    const txCoinToSend = await suiCoin.coinOfAmountToTxCoin(tx, ownerAddress, param.amount);

                    callArgs.push(tx.makeMoveVec({ objects: [txCoinToSend]}));
                } else {
                    callArgs.push(tx.pure(param));
                }
            }
            
            tx.moveCall({
                target: `${this._package.address}::${this._moduleName}::${methodName}`,
                arguments: callArgs,
            });
        }

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
        const suiTransaction = new this._suiMaster.SuiTransaction({
                suiMaster: this._suiMaster,
                debug: this._debug,
                data: result,
            });

        const status = suiTransaction.status;

        const listCreated = [];
        const listMutated = [];
        const listDeleted = [];

        for (const obj of suiTransaction.results.objects) {
            if (this.objectStorage.byAddress(obj.id)) {
                this.objectStorage.byAddress(obj.id).replaceWithSuiObjectIfNeeded(obj);
            } else {
                this.objectStorage.push(obj);
                this.emit('added', obj);
            }
        }

        for (const obj of suiTransaction.results.deleted) {
            if (this.objectStorage.byAddress(obj.id)) {
                this.objectStorage.byAddress(obj.id).markAsDeleted();
                listDeleted.push(this.objectStorage.byAddress(obj.id));
                this.emit('deleted', this.objectStorage.byAddress(obj.id));
            }
        }

        await this.fetchObjects();

        for (const obj of suiTransaction.results.created) {
            if (this.objectStorage.byAddress(obj.id)) {
                listCreated.push(this.objectStorage.byAddress(obj.id)); // it's probably the same instance as it's just created. @todo: check
                this.emit('created', this.objectStorage.byAddress(obj.id));
            } else {
                throw new Error('something is wrong!');
            }
        }

        for (const obj of suiTransaction.results.mutated) {
            if (this.objectStorage.byAddress(obj.id)) {
                listMutated.push(this.objectStorage.byAddress(obj.id)); // it may be a different entity, updated via .replaceWithSuiObjectIfNeeded above
                this.emit('mutated', this.objectStorage.byAddress(obj.id));
            } else {
                throw new Error('something is wrong!');
            }
        }

        for (const suiEvent of suiTransaction.events) {
            this.emit(suiEvent.typeName, suiEvent);
        }

        return {
            created: listCreated,
            mutated: listMutated,
            deleted: listDeleted,
            status: status,
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
        return await this.objectStorage.fetchObjects();
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