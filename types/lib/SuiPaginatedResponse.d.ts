/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 */
/**
 * @typedef {import('./SuiObject.js').default} SuiObject
 * @typedef {import('./SuiMaster.js').default} SuiMaster
 * @typedef {{ filter?: object, limit?: number }} GraphqlEventsParams
 * @typedef {{ owner: string, type?: string, limit?: number }} GraphqlOwnedObjectsParams
 * @typedef {{ filter?: object, limit?: number }} GraphqlTransactionsParams
 * @typedef {SuiClientTypes.ListOwnedObjectsOptions<SuiClientTypes.ObjectInclude>
 *              | SuiClientTypes.ListCoinsOptions
 *              | SuiClientTypes.ListDynamicFieldsOptions
 *              | GraphqlEventsParams
 *              | GraphqlOwnedObjectsParams
 *              | GraphqlTransactionsParams } SuiPaginatedResponseParams
 */
/**
 * @template {SuiObject | SuiTransaction | SuiEvent} T
 */
export default class SuiPaginatedResponse<T extends SuiObject | SuiTransaction | SuiEvent> extends SuiCommonMethods {
    /**
     * Accept 'asc' | 'ascending' | 'desc' | 'descending' (case-insensitive).
     * Defaults to 'descending' (newest first).
     * @param {?string} input
     * @returns {'ascending' | 'descending'}
     */
    static _normalizeOrder(input: string | null): "ascending" | "descending";
    /**
     * Map a GraphQL Owner union node to the gRPC-style owner shape SuiObject consumes.
     */
    static _normalizeGraphqlOwner(owner: any): "Immutable" | {
        AddressOwner: any;
        ObjectOwner?: undefined;
        ConsensusAddressOwner?: undefined;
        Shared?: undefined;
    } | {
        ObjectOwner: any;
        AddressOwner?: undefined;
        ConsensusAddressOwner?: undefined;
        Shared?: undefined;
    } | {
        ConsensusAddressOwner: any;
        AddressOwner?: undefined;
        ObjectOwner?: undefined;
        Shared?: undefined;
    } | {
        Shared: {};
        AddressOwner?: undefined;
        ObjectOwner?: undefined;
        ConsensusAddressOwner?: undefined;
    };
    /**
     * @param {Object} params
     * @param {SuiMaster} params.suiMaster
     * @param {SuiPaginatedResponseParams} params.params
     * @param {string} [params.method]
     * @param {string} [params.order]
     * @param {boolean} [params.debug]
     */
    constructor(params: {
        suiMaster: SuiMaster;
        params: SuiPaginatedResponseParams;
        method?: string;
        order?: string;
        debug?: boolean;
    });
    _suiMaster: import("./SuiMaster.js").default;
    _method: string;
    /** @type {SuiPaginatedResponseParams} */
    _params: SuiPaginatedResponseParams;
    _order: "ascending" | "descending";
    _hasNextPage: boolean;
    _nextCursor: any;
    /** @type {T[]} */
    _data: T[];
    /**
     * Simple itterator to go over all list of items, not caring about pagination/cursors etc. It fetches next page when needed
     * Optional maxLimit second parameter to stop when reached count
     * @param {(item: T) => (void | Promise<void>)} callbackFunc
     * @param {Number} maxLimit
     */
    forEach(callbackFunc: (item: T) => (void | Promise<void>), maxLimit?: number): Promise<void>;
    get hasNextPage(): boolean;
    /** @returns {T[]} */
    get data(): T[];
    nextPage(): Promise<false | T[]>;
    fetch(params?: {}): Promise<T[]>;
    /**
     * Shared Relay-style GraphQL pagination:
     *   - ascending  → `first` + `after`, `hasNextPage` / `endCursor`
     *   - descending → `last`  + `before`, `hasPreviousPage` / `startCursor`
     * `last` returns nodes ascending too, so descending callers get a reversed slice.
     *
     * @param {Object} config
     * @param {string} config.query - GraphQL query declaring $first/$after/$last/$before + any extra vars
     * @param {Object} [config.variables] - extra variables merged into the request (e.g. filter, owner)
     * @param {(data: any) => any} config.extractConnection - pull the Connection (pageInfo + nodes) out of response.data
     * @param {(node: any) => T} config.mapNode - turn a node into the wrapped T instance
     * @param {string} [config.errorLabel='GraphQL query'] - prefix for errors
     * @param {Object} [params]
     * @param {?string} [params.cursor]
     */
    _fetchGraphqlPaginated(config: {
        query: string;
        variables?: any;
        extractConnection: (data: any) => any;
        mapNode: (node: any) => T;
        errorLabel?: string;
    }, params?: {
        cursor?: string | null;
    }): Promise<T[]>;
    /**
     * Paginate the GraphQL `events` query. `this._params` = { filter, limit } where
     * `filter` is a GraphQL `EventFilter` (module/type/sender/checkpoint fields).
     */
    _fetchEventsGraphql(params?: {}): Promise<T[]>;
    /**
     * Paginate `address(address).objects(filter)` via GraphQL. `this._params` = { owner, type, limit }
     * where `type` is a GraphQL `ObjectFilter.type` string.
     */
    _fetchOwnedObjectsGraphql(params?: {}): Promise<T[]>;
    /**
     * Paginate the GraphQL root `transactions(filter: TransactionFilter)` query.
     * `this._params` = { filter, limit } where `filter` is a GraphQL `TransactionFilter`
     * (`sentAddress`, `affectedAddress`, `affectedObject`, `function`, checkpoint bounds, `kind`).
     */
    _fetchTransactionsGraphql(params?: {}): Promise<T[]>;
}
export type SuiObject = import("./SuiObject.js").default;
export type SuiMaster = import("./SuiMaster.js").default;
export type GraphqlEventsParams = {
    filter?: object;
    limit?: number;
};
export type GraphqlOwnedObjectsParams = {
    owner: string;
    type?: string;
    limit?: number;
};
export type GraphqlTransactionsParams = {
    filter?: object;
    limit?: number;
};
export type SuiPaginatedResponseParams = SuiClientTypes.ListOwnedObjectsOptions<SuiClientTypes.ObjectInclude> | SuiClientTypes.ListCoinsOptions | SuiClientTypes.ListDynamicFieldsOptions | GraphqlEventsParams | GraphqlOwnedObjectsParams | GraphqlTransactionsParams;
import SuiTransaction from './SuiTransaction.js';
import SuiEvent from './SuiEvent.js';
import SuiCommonMethods from './SuiCommonMethods.js';
import type { SuiClientTypes } from "@mysten/sui/client";
