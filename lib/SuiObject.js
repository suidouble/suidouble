const sui = require('@mysten/sui.js');
const SuiCommonMethods = require('./SuiCommonMethods.js');
const SuiPaginatedResponse = require('./SuiPaginatedResponse.js');

class SuiObject extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is requried for suiPackage');
        }

        this._id = params.id || null;
        this._version = params.version || null;
        this._type = params.type || null;

        this._fields = {};          //  on-chain fields on the object
                                    //

        this._display = {};         // https://examples.sui.io/basics/display.html
                                    // https://docs.sui.io/devnet/build/sui-object-display

        this._owner = null;         // Going to store it in the same format as in rpc responses

        this._localProperties = {}; // object to store some local data for you to help with your local calculations, no interaction with blockchain

        // this._ownerAddress = null;

        this._isDeleted = false;

        if (params.objectChange) {
            this.tryToFillDataFromObjectChange(params.objectChange);
        }

        this._constructedAt = new Date(); // just a helpful data so we can sort later when trying to find most recent item in different modules
    }

    get constructedAt() {
        return this._constructedAt;
    }

    static idsEqual(id1, id2) {
        return (sui.normalizeSuiAddress(id1) === sui.normalizeSuiAddress(id2));
    }

    get isDeleted() {
        return this._isDeleted;
    }

    get isShared() {
        return (this._owner && this._owner.Shared);
    }

    get isImmutable() {
        return (this._owner && this._owner == 'Immutable');
    }

    isOwnedBy(addressOrSuiObject) {
        let toId = addressOrSuiObject;
        if (toId.id) {
            toId = toId.id;
        }

        if (this._owner && this._owner.AddressOwner && this._owner.AddressOwner == toId) {
            return true;
        }

        return false;
    }

    markAsDeleted() {
        this._isDeleted = true;
    }

    get id() {
        return this._id;
    }

    get type() {
        return this._type;
    }

    /**
     * In module type name, without package and module prefix and without <T..> suffix
     */
    get typeName() {
        return this._type ? (''+this._type).split('<')[0].split('::').pop() : null;
    }

    idEquals(toId) {
        if (!toId) {
            return false;
        }
        
        const thisAddress = this.address;
        if (thisAddress && thisAddress === sui.normalizeSuiAddress(toId)) {
            return true;
        }
        return false;
    }

    get address() {
        try {
            return sui.normalizeSuiAddress(this._id);
        } catch (e) {
            return null;
        }
    }

    get fields() {
        return this._fields;
    }

    get display() {
        return this._display;
    }

    get localProperties() {
        return this._localProperties;
    }

    get version() {
        return this._version;
    }

    /**
     * Try to get past version of an object from blockchain.
     * Non-cacheable
     * Note from SUI docs, there's no garantee past version is available on nodes, so may return null even if you expect v to be there
     * @param {Number} v 
     * @returns SuiObject
     */
    async getPastObject(v = null) {
        if (!v) {
            v = this._version - BigInt(1);
        }
        v = Number(v);

        const result = await this._suiMaster._provider.tryGetPastObject({
            version: (v),
            id: this.address,
            options: {
              showType: true,
              showContent: true,
              showOwner: true,
              showDisplay: true,
              "showPreviousTransaction": true,
              "showBcs": false,
              "showStorageRebate": true
            },
        });

        if (result && result.details && result.details.objectId) {
            const pastObject = new SuiObject({
                suiMaster: this._suiMaster,
                debug: this._debug,
                objectChange: result.details,
            });

            return pastObject;
        }

        return null;
    }

    async queryTransactionBlocks(params = {}) {
        // @todo: InputObject / ChangedObject ? make separate function or a param here?
        const queryParams = {
            filter: {
                InputObject: this.address,
            },
            limit: params.limit || 10,
            options: {
                /* Whether to show transaction input data. Default to be false. */
                showInput: true,
                /* Whether to show transaction effects. Default to be false. */
                showEffects: true,
                /* Whether to show transaction events. Default to be false. */
                showEvents: true,
                /* Whether to show object changes. Default to be false. */
                showObjectChanges: true,
                /* Whether to show coin balance changes. Default to be false. */
                showBalanceChanges: true,    
                showContent: true,
                showOwner: true,
                showDisplay: true,       
            },
        };

        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this._suiMaster,
            params: queryParams,
            method: 'queryTransactionBlocks',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return paginatedResponse;
    }

    async getDynamicFields(params = {}) {
        const queryParams = {
            parentId: this.address,
            limit: params.limit || 50,
        };

        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this._suiMaster,
            params: queryParams,
            method: 'getDynamicFields',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return paginatedResponse;
    }

    async fetchFields() {
        const result = await this._suiMaster._provider.getObject({
            id: this.address, // normalized id
            options: {
              showType: true,
              showContent: true,
              showOwner: true,
              showDisplay: true,
              "showPreviousTransaction": true,
              "showBcs": false,
              "showStorageRebate": true
            },
        });
        if (result && result.data) {
            this.tryToFillDataFromObjectChange(result.data);
        }
    }

    /**
     * Try to fill local object properties with values from ( showObjectChanges = true ) rpc response   
     * @param {Object} objectChange 
     */
    tryToFillDataFromObjectChange(objectChange) {
        if (!objectChange.objectId && objectChange.data && objectChange.data.objectId) {
            objectChange = objectChange.data;
        }

        if (objectChange.type && objectChange.type == 'deleted') {
            this.markAsDeleted();
        }

        // basic fields. Available both in getObject and in results of .moveCall
        if (objectChange.objectId) {
            if (!this._id) {
                this._id = objectChange.objectId;
            } else if (!this.idEquals(objectChange.objectId)) {
                throw new Error('Trying to fill from different object');
            }
            if (objectChange.type && !this._type) {
                this._type = objectChange.type;
            }
        }
        if (objectChange.version) {
            this._version = BigInt(objectChange.version);
        }
        if (objectChange.objectType) {
            this._type = `${objectChange.objectType}`;
        }

        // extra fields. Possible to get them from separate call to getObject or multiGetObjects
        // .content
        if (objectChange?.content?.fields) {
            for (const key in objectChange?.content?.fields) {
                if (key !== 'id') {
                    this._fields[key] = objectChange.content.fields[key];
                }
            }
        }

        // .display
        if (objectChange?.display?.data) {
            for (const key in objectChange?.display?.data) {
                this._display[key] = objectChange.display.data[key];
            }
        }

        // .owner
        if (objectChange.owner) {
            this._owner = objectChange.owner;
        }

    }
};

module.exports = SuiObject;
