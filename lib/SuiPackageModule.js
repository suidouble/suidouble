import SuiObject from './SuiObject.js';
import SuiCommonMethods from './SuiCommonMethods.js';
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
import { Transaction } from '@mysten/sui/transactions';
import { normalizeSuiAddress } from './SuiUtils.js';

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
    constructor(params) {
        super(params);

        this._package = params.package;
        if (!this._package) {
            throw new Error('package is required for SuiPackageModule');
        }

        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is required for SuiPackageModule');
        }
        this._moduleName = params.moduleName;
        if (!this._moduleName) {
            throw new Error('moduleName is required for SuiPackageModule');
        }

    }

    /**
     * Shortcut for `suiMaster.utils.pureInput(type, value)` — build a BCS-serialised Pure input
     * to use as a moveCall parameter.
     * @param {string} type - BCS type name, e.g. `'u64'`, `'address'`, `'string'`
     * @param {*} value
     * @returns {CallArg}
     */
    arg(type, value) {
        return this._suiMaster.utils.pureInput(type, value);
    }

    /** @returns {SuiMemoryObjectStorage} shared object storage for this suiMaster */
    get objectStorage() {
        return this._suiMaster.objectStorage;
    }

    /** @returns {Object.<string, SuiObject>} raw map of address → SuiObject */
    get objects() {
        return this.objectStorage._objects;
    }

    /** @returns {SuiObject[]} all objects in storage as an array */
    get objectsArray() {
        return this.objectStorage.asArray();
    }

    /**
     * Add an object to the shared objectStorage by address or SuiObject instance.
     * If the object is already stored, returns the existing instance.
     * Emits `'added'` if a new bare SuiObject is created from an id string.
     *
     * @param {SuiObject | string} suiObjectOrAddress
     * @returns {?SuiObject}
     */
    pushObject(suiObjectOrAddress) {
        const a = /** @type {any} */ (suiObjectOrAddress);
        let address = a.address ?? `${a}`;
        try {
            address = normalizeSuiAddress(address);
            if (!this.objectStorage.byAddress(address)) {
                if (a.address) {
                    // instance of suiObject
                    this.objectStorage.push(a);
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
    async moveCall(methodName, params, typeArguments) {
        await this._package.checkOnChainIfNeeded();

        const tx = new Transaction();

        const callArgs = [];

        for (let param of params) {
            if (param && param.type && param.amount) {
                const suiCoin = this._suiMaster.suiCoins.get(param.type);
                const txCoinToSend = await suiCoin.coinOfAmountToTxCoin(tx, this._suiMaster.address, param.amount);
                callArgs.push(txCoinToSend);
            } else if (param && Array.isArray(param) && param.length == 1 && param[0].type && param[0].amount) {
                // vector<Coin<T>>
                const suiCoin = this._suiMaster.suiCoins.get(param[0].type);
                const txCoinToSend = await suiCoin.coinOfAmountToTxCoin(tx, this._suiMaster.address, param[0].amount);
                callArgs.push(tx.makeMoveVec({ type: suiCoin.coinObjectType, elements: [txCoinToSend] }));
            } else if (typeof param === 'string' && param.indexOf('0x') === 0) {
                callArgs.push(tx.object(param));
            } else if (param && param.Pure && param.Pure.bytes) {
                // already Pure
                callArgs.push(this._suiMaster.utils.txInput(tx, param));
            } else {
                callArgs.push(tx.pure(param));
            }
        }

        tx.moveCall({
            target: `${this._package.address}::${this._moduleName}::${methodName}`,
            arguments: callArgs,
            typeArguments: typeArguments,
        });

        return await this.executeTransaction(tx);
    }

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
    async executeTransaction(tx) {
        const resultTransaction = await this._suiMaster.signAndExecuteTransaction({
            transaction: tx,
            requestType: 'WaitForLocalExecution',
            include: {
                effects: true,
                objectTypes: true,
                transaction: true,
                bcs: true,
                balanceChanges: true,
                events: true,
            },
        });

        for (const suiObject of resultTransaction.created) {
            if (this.objectStorage.byAddress(suiObject.id)) {
                this.objectStorage.byAddress(suiObject.id).replaceWithSuiObjectIfNeeded(suiObject);
            } else {
                this.objectStorage.push(suiObject);
                this.emit('added', suiObject);
            }
            this.emit('created', this.objectStorage.byAddress(suiObject.id));
        }
        for (const suiObject of resultTransaction.deleted) {
            if (this.objectStorage.byAddress(suiObject.id)) {
                this.objectStorage.byAddress(suiObject.id).markAsDeleted();
                this.emit('deleted', this.objectStorage.byAddress(suiObject.id));
            }
        }
        for (const suiObject of resultTransaction.mutated) {
            if (this.objectStorage.byAddress(suiObject.id)) {
                this.objectStorage.byAddress(suiObject.id).replaceWithSuiObjectIfNeeded(suiObject);
            } else {
                this.objectStorage.push(suiObject);
                this.emit('added', suiObject);
            }
        }

        return resultTransaction;
    }

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
    async getOwnedObjects(params = {}) {
        const originalPackageId = await this._package.getOriginalPackageId();
        const type = params.typeName
            ? `${originalPackageId}::${this._moduleName}::${params.typeName}`
            : `${originalPackageId}::${this._moduleName}`;

        return await this._suiMaster.getOwnedObjects({
            owner: this._suiMaster.address,
            type,
            limit: params.limit || 50,
            include: {
                content: true,
                json: true,
                display: true,
            },
        }, { order: params.order });
    }
      
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
    async fetchEvents(params = {}) {
        const filter = {};

        // we need very first package version's id here so the filter is stable across upgrades
        const originalPackageId = await this._package.getOriginalPackageId();
        if (params.eventTypeName) {
            filter.type = `${originalPackageId}::${this._moduleName}::${params.eventTypeName}`;
            this.log('querying for events of type: ', filter.type);
        } else {
            filter.module = `${originalPackageId}::${this._moduleName}`;
            this.log('querying for all events of module: ', filter.module);
        }

        const queryParams = {
            filter,
            limit: params.limit || 50,
        };

        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this._suiMaster,
            params: queryParams,
            method: 'graphqlEvents',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return /** @type {SuiPaginatedResponse<SuiEvent>} */ (/** @type {any} */ (paginatedResponse));
    }

    /**
     * Refresh all objects in the shared objectStorage from chain.
     * Delegates to `SuiMemoryObjectStorage.fetchObjects()`.
     * @returns {Promise<SuiObject[]>}
     */
    async fetchObjects() {
        return await this.objectStorage.fetchObjects();
    }


};
