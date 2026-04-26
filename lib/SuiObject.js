import SuiCommonMethods from './SuiCommonMethods.js';
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
import { normalizeSuiAddress } from './SuiUtils.js';

/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 */
/**
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 */

export default class SuiObject extends SuiCommonMethods {
    /**
     * Sui Object representation
     *
     * @param {Object} params - parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {SuiClientTypes.Object} [params.raw] - raw data from api
     * @param {?string} [params.id] - ID or address on the sui blockchain
     * @param {string|number} [params.version] - object version
     * @param {?string} [params.type] - fully-qualified Move type string
     * @param {boolean} [params.debug]
     */
    constructor(params) {
        super(params);

        /** @type {SuiMaster} */
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is required for SuiObject');
        }

        /** @type {?string} */
        this._id = params.id || null;
        /** @type {?number} */
        this._version = params.version != null ? Number(params.version) : null;

        /** @type {?string} */
        this._type = params.type || null;

        this._fields = {};          //  on-chain fields on the object
                                    //

        this._display = {};         // https://examples.sui.io/basics/display.html
                                    // https://docs.sui.io/devnet/build/sui-object-display

        this._owner = null;         // Going to store it in the same format as in rpc responses

        this._localProperties = {}; // object to store some local data for you to help with your local calculations, no interaction with blockchain

        this._isDeleted = false;

        if (params.raw) {
            this.fillDataFromApi(params.raw);
        }

        this._constructedAt = new Date(); // just a helpful data so we can sort later when trying to find most recent item in different modules
    }

    /**
     * Fill local properties from raw SuiClientTypes.Object api response
     * @param {SuiClientTypes.Object} raw
     */
    fillDataFromApi(raw) {
        if (!raw) {
            return;
        }

        if (raw.objectId && !this._id) {
            this._id = raw.objectId;
        }
        if (raw.version !== undefined && raw.version !== null) {
            this._version = Number(raw.version);
        }
        if (raw.type) {
            this._type = raw.type;
        }
        if (raw.owner) {
            this._owner = raw.owner;
        }

        if (raw.json && typeof raw.json === 'object') {
            this._fields = raw.json;
        }

        if (raw.display && raw.display.output) {
            this._display = raw.display.output;
        }
    }

    /** @returns {Date} timestamp when this JS object was instantiated (useful for sorting by recency) */
    get constructedAt() {
        return this._constructedAt;
    }

    /**
     * Compare two Sui object IDs after normalisation.
     * @param {string} id1
     * @param {string} id2
     * @returns {boolean}
     */
    static idsEqual(id1, id2) {
        return (normalizeSuiAddress(id1) === normalizeSuiAddress(id2));
    }

    /** @returns {boolean} true if this object has been marked deleted */
    get isDeleted() {
        return this._isDeleted;
    }

    /** @returns {boolean} true if the object is shared (owned by the network) */
    get isShared() {
        return !!(this._owner && (this._owner.Shared || this._owner.$kind === 'Shared'));
    }

    /** @returns {boolean} true if the object is immutable (frozen) */
    get isImmutable() {
        return !!(this._owner && (this._owner === 'Immutable' || this._owner.$kind === 'Immutable'));
    }

    /**
     * Check whether this object is address-owned by the given address or SuiObject.
     * @param {string | SuiObject} addressOrSuiObject
     * @returns {boolean}
     */
    isOwnedBy(addressOrSuiObject) {
        const a = /** @type {any} */ (addressOrSuiObject);
        const toId = a.id ?? a;

        if (this._owner && this._owner.AddressOwner && this._owner.AddressOwner == toId) {
            return true;
        }

        return false;
    }

    /** Mark this object as deleted on-chain and set `isDeleted` to true. */
    markAsDeleted() {
        this._isDeleted = true;
    }

    /** @returns {?string} raw object id as stored (not normalised) */
    get id() {
        return this._id;
    }

    /** @returns {?string} fully-qualified Move type string, e.g. `'0x2::coin::Coin<0x2::sui::SUI>'` */
    get type() {
        return this._type;
    }

    /**
     * Short type name — last `::` segment without `<T…>` suffix.
     * @returns {?string} e.g. `'ChatTopMessage'`
     */
    get typeName() {
        return this._type ? (''+this._type).split('<')[0].split('::').pop() : null;
    }

    /**
     * Check whether this object's normalised address equals `toId`.
     * @param {string} toId
     * @returns {boolean}
     */
    idEquals(toId) {
        if (!toId) {
            return false;
        }

        const thisAddress = this.address;
        if (thisAddress && thisAddress === normalizeSuiAddress(toId)) {
            return true;
        }
        return false;
    }

    /**
     * Normalised 0x-padded Sui address, or null if the id is invalid.
     * @returns {?string}
     */
    get address() {
        try {
            return normalizeSuiAddress(this._id);
        } catch (e) {
            return null;
        }
    }

    /** @returns {Object} on-chain Move struct fields (populated by `fillDataFromApi` or `fetchFields`) */
    get fields() {
        return this._fields;
    }

    /** @returns {Object} Display template rendered output (populated by `fillDataFromApi` or `fetchFields`) */
    get display() {
        return this._display;
    }

    /** @returns {Object} local-only property bag — never sent to chain, for caller convenience */
    get localProperties() {
        return this._localProperties;
    }

    /** @returns {?number} object version (lamport timestamp), or null before `fetchFields` */
    get version() {
        return this._version;
    }

    /**
     * Fetch transactions that interacted with this object, via GraphQL.
     *
     * @param {Object} [params]
     * @param {number} [params.limit=10]
     * @param {string} [params.order]
     * @returns {Promise<SuiPaginatedResponse>}
     */
    async fetchTransactions(params = {}) {
        return await this._suiMaster.fetchTransactions({
            affectedObject: this.address,
            limit: params.limit || 10,
            order: params.order,
        });
    }

    /**
     * Fetch dynamic fields owned by this object, paginated.
     * @param {Object} [params]
     * @param {number} [params.limit=50]
     * @param {string} [params.order]
     * @returns {Promise<SuiPaginatedResponse>}
     */
    async getDynamicFields(params = {}) {
        const queryParams = {
            parentId: this.address,
            limit: params.limit || 50,
        };

        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this._suiMaster,
            params: queryParams,
            method: 'listDynamicFields',
            order: params.order,
        });

        await paginatedResponse.fetch();

        return paginatedResponse;
    }

    /**
     * Fetch full field data for this object from chain and merge via `replaceWithSuiObjectIfNeeded`.
     * Populates `fields`, `display`, `type`, and `version` if not already filled.
     * @returns {Promise<this>}
     */
    async fetchFields() {
        const fetched = await this._suiMaster.getObject(this.address);
        if (fetched) {
            this.replaceWithSuiObjectIfNeeded(fetched);
        }
        return this;
    }

    /**
     * Replace data with another suiObject data if it's version is newer compared to this one
     * @param {SuiObject} suiObject 
     */
    replaceWithSuiObjectIfNeeded(suiObject) {
        if (!suiObject || !suiObject.version || !suiObject.id) {
            return false;
        }

        if (!this.idEquals(suiObject.id)) {
            // should be the same id
            return false;
        }

        if (!this.version || suiObject.version > this.version) {
            this._type = suiObject.type;
            this._owner = suiObject._owner;
            this._fields = suiObject._fields;
            this._display = suiObject._display;

            this._version = suiObject.version;

            if (suiObject.isDeleted) {
                this.markAsDeleted();
            }

            return true;
        }

        // same or older version — still fill any locally-empty slots
        let filled = false;
        if (!this._type && suiObject.type) {
            this._type = suiObject.type;
            filled = true;
        }
        if (!this._owner && suiObject._owner) {
            this._owner = suiObject._owner;
            filled = true;
        }
        if ((!this._fields || Object.keys(this._fields).length === 0) && suiObject._fields) {
            this._fields = suiObject._fields;
            filled = true;
        }
        if ((!this._display || Object.keys(this._display).length === 0) && suiObject._display) {
            this._display = suiObject._display;
            filled = true;
        }
        if (!this._version && suiObject.version) {
            this._version = suiObject.version;
            filled = true;
        }

        return filled;
    }
};
