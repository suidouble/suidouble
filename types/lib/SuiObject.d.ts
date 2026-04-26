/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 */
/**
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 */
export default class SuiObject extends SuiCommonMethods {
    /**
     * Compare two Sui object IDs after normalisation.
     * @param {string} id1
     * @param {string} id2
     * @returns {boolean}
     */
    static idsEqual(id1: string, id2: string): boolean;
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
    constructor(params: {
        suiMaster: SuiMaster;
        raw?: SuiClientTypes.Object;
        id?: string | null;
        version?: string | number;
        type?: string | null;
        debug?: boolean;
    });
    /** @type {SuiMaster} */
    _suiMaster: SuiMaster;
    /** @type {?string} */
    _id: string | null;
    /** @type {?number} */
    _version: number | null;
    /** @type {?string} */
    _type: string | null;
    _fields: {};
    _display: {};
    _owner: any;
    _localProperties: {};
    _isDeleted: boolean;
    _constructedAt: Date;
    /**
     * Fill local properties from raw SuiClientTypes.Object api response
     * @param {SuiClientTypes.Object} raw
     */
    fillDataFromApi(raw: SuiClientTypes.Object): void;
    /** @returns {Date} timestamp when this JS object was instantiated (useful for sorting by recency) */
    get constructedAt(): Date;
    /** @returns {boolean} true if this object has been marked deleted */
    get isDeleted(): boolean;
    /** @returns {boolean} true if the object is shared (owned by the network) */
    get isShared(): boolean;
    /** @returns {boolean} true if the object is immutable (frozen) */
    get isImmutable(): boolean;
    /**
     * Check whether this object is address-owned by the given address or SuiObject.
     * @param {string | SuiObject} addressOrSuiObject
     * @returns {boolean}
     */
    isOwnedBy(addressOrSuiObject: string | SuiObject): boolean;
    /** Mark this object as deleted on-chain and set `isDeleted` to true. */
    markAsDeleted(): void;
    /** @returns {?string} raw object id as stored (not normalised) */
    get id(): string | null;
    /** @returns {?string} fully-qualified Move type string, e.g. `'0x2::coin::Coin<0x2::sui::SUI>'` */
    get type(): string | null;
    /**
     * Short type name — last `::` segment without `<T…>` suffix.
     * @returns {?string} e.g. `'ChatTopMessage'`
     */
    get typeName(): string | null;
    /**
     * Check whether this object's normalised address equals `toId`.
     * @param {string} toId
     * @returns {boolean}
     */
    idEquals(toId: string): boolean;
    /**
     * Normalised 0x-padded Sui address, or null if the id is invalid.
     * @returns {?string}
     */
    get address(): string | null;
    /** @returns {Object} on-chain Move struct fields (populated by `fillDataFromApi` or `fetchFields`) */
    get fields(): any;
    /** @returns {Object} Display template rendered output (populated by `fillDataFromApi` or `fetchFields`) */
    get display(): any;
    /** @returns {Object} local-only property bag — never sent to chain, for caller convenience */
    get localProperties(): any;
    /** @returns {?number} object version (lamport timestamp), or null before `fetchFields` */
    get version(): number | null;
    /**
     * Fetch transactions that interacted with this object, via GraphQL.
     *
     * @param {Object} [params]
     * @param {number} [params.limit=10]
     * @param {string} [params.order]
     * @returns {Promise<SuiPaginatedResponse>}
     */
    fetchTransactions(params?: {
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<any>>;
    /**
     * Fetch dynamic fields owned by this object, paginated.
     * @param {Object} [params]
     * @param {number} [params.limit=50]
     * @param {string} [params.order]
     * @returns {Promise<SuiPaginatedResponse>}
     */
    getDynamicFields(params?: {
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<any>>;
    /**
     * Fetch full field data for this object from chain and merge via `replaceWithSuiObjectIfNeeded`.
     * Populates `fields`, `display`, `type`, and `version` if not already filled.
     * @returns {Promise<this>}
     */
    fetchFields(): Promise<this>;
    /**
     * Replace data with another suiObject data if it's version is newer compared to this one
     * @param {SuiObject} suiObject
     */
    replaceWithSuiObjectIfNeeded(suiObject: SuiObject): boolean;
}
export type SuiMaster = import("./SuiMaster.js").default;
import SuiCommonMethods from './SuiCommonMethods.js';
import type { SuiClientTypes } from "@mysten/sui/client";
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
