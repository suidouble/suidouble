import SuiCommonMethods from './SuiCommonMethods.js';
import SuiEvent from './SuiEvent.js';
import SuiTransaction from './SuiTransaction.js';

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
export default class SuiPaginatedResponse extends SuiCommonMethods {

    /**
     * @param {Object} params
     * @param {SuiMaster} params.suiMaster
     * @param {SuiPaginatedResponseParams} params.params
     * @param {string} [params.method]
     * @param {string} [params.order]
     * @param {boolean} [params.debug]
     */
    constructor(params) {
        super(params);

        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is required for SuiPaginatedResponse');
        }

        this._method = params.method;

        /** @type {SuiPaginatedResponseParams} */
        this._params = params.params;
        this._order = SuiPaginatedResponse._normalizeOrder(params.order);

        this._hasNextPage = true;
        this._nextCursor = null;

        /** @type {T[]} */
        this._data = [];
    }

    /**
     * Accept 'asc' | 'ascending' | 'desc' | 'descending' (case-insensitive).
     * Defaults to 'descending' (newest first).
     * @param {?string} input
     * @returns {'ascending' | 'descending'}
     */
    static _normalizeOrder(input) {
        if (!input) return 'descending';
        const v = (''+input).toLowerCase();
        if (v === 'asc' || v === 'ascending') return 'ascending';
        if (v === 'desc' || v === 'descending') return 'descending';
        return 'descending';
    }

    /**
     * Simple itterator to go over all list of items, not caring about pagination/cursors etc. It fetches next page when needed
     * Optional maxLimit second parameter to stop when reached count
     * @param {(item: T) => (void | Promise<void>)} callbackFunc
     * @param {Number} maxLimit
     */
    async forEach(callbackFunc, maxLimit = null) {
        let curN = 0;
        do {
            for (const item of this._data) {
                if (maxLimit && curN >= maxLimit) break;
                await callbackFunc(item);
                curN++;
            }
        } while( (!maxLimit || curN < maxLimit) && (await this.nextPage()) );
    }

    get hasNextPage() {
        return this._hasNextPage;
    }

    /** @returns {T[]} */
    get data() {
        return this._data;
    }

    async nextPage() {
        if (this._hasNextPage) {
            return await this.fetch({cursor: this._nextCursor});
        } else {
            return false;
        }
    }

    async fetch(params = {}) {
        if (this._method === 'graphqlEvents') {
            return await this._fetchEventsGraphql(params);
        }
        if (this._method === 'graphqlOwnedObjects') {
            return await this._fetchOwnedObjectsGraphql(params);
        }
        if (this._method === 'graphqlTransactions') {
            return await this._fetchTransactionsGraphql(params);
        }

        const paramsCopy = /** @type {any} */ (Object.assign({}, this._params));

        if (params.cursor) {
            paramsCopy.cursor = params.cursor;
        }
        paramsCopy.order = this._order;

        const response = await this._suiMaster.client[this._method](paramsCopy);

        if (response.hasNextPage) {
            this._hasNextPage = true;
            this._nextCursor = response.cursor ?? null;
        } else {
            this._hasNextPage = false;
            this._nextCursor = null;
        }

        if (this._method === 'listOwnedObjects') {
            // convert data to SuiObject instances
            this._data = response.objects.map((raw)=>(new (this._suiMaster.SuiObject)({suiMaster: this._suiMaster, debug: this._debug, raw: raw})));
        } else if (this._method === 'listDynamicFields') {
            this._data = response.dynamicFields || [];
        } else {
            this._data = response.data;
        }

        return this._data;
    }

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
    async _fetchGraphqlPaginated(config, params = {}) {
        const pageSize = this._params.limit || 50;
        const cursor = params.cursor || null;
        const ascending = this._order === 'ascending';

        const pageVars = ascending
            ? { first: pageSize, after: cursor, last: null, before: null }
            : { last: pageSize, before: cursor, first: null, after: null };

        const response = await this._suiMaster.graphqlClient.query({
            query: config.query,
            variables: { ...(config.variables || {}), ...pageVars },
        });

        if (response.errors && response.errors.length) {
            const label = config.errorLabel || 'GraphQL query';
            throw new Error(`${label} failed: ` + response.errors.map((e) => e.message).join('; '));
        }

        const connection = config.extractConnection(response.data);
        if (!connection) {
            this._hasNextPage = false;
            this._nextCursor = null;
            this._data = [];
            return this._data;
        }

        const pageInfo = connection.pageInfo || {};
        if (ascending) {
            this._hasNextPage = !!pageInfo.hasNextPage;
            this._nextCursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
        } else {
            this._hasNextPage = !!pageInfo.hasPreviousPage;
            this._nextCursor = pageInfo.hasPreviousPage ? pageInfo.startCursor : null;
        }

        const nodes = connection.nodes || [];
        const ordered = ascending ? nodes : nodes.slice().reverse();

        this._data = ordered.map(config.mapNode);
        return this._data;
    }

    /**
     * Paginate the GraphQL `events` query. `this._params` = { filter, limit } where
     * `filter` is a GraphQL `EventFilter` (module/type/sender/checkpoint fields).
     */
    async _fetchEventsGraphql(params = {}) {
        const query = `
            query Events($filter: EventFilter, $first: Int, $after: String, $last: Int, $before: String) {
                events(filter: $filter, first: $first, after: $after, last: $last, before: $before) {
                    pageInfo { hasNextPage endCursor hasPreviousPage startCursor }
                    nodes {
                        sequenceNumber
                        timestamp
                        sender { address }
                        transaction { digest }
                        contents {
                            type { repr }
                            json
                            bcs
                        }
                    }
                }
            }
        `;

        return await this._fetchGraphqlPaginated({
            query,
            variables: { filter: /** @type {any} */ (this._params).filter || {} },
            extractConnection: (data) => data?.events,
            mapNode: (node) => /** @type {any} */ (new SuiEvent({
                suiMaster: this._suiMaster,
                debug: this._debug,
                data: {
                    type: node.contents?.type?.repr,
                    parsedJson: node.contents?.json,
                    timestampMs: node.timestamp ? new Date(node.timestamp).getTime() : null,
                    sender: node.sender?.address,
                    transactionDigest: node.transaction?.digest,
                    sequenceNumber: node.sequenceNumber,
                    bcs: node.contents?.bcs,
                },
            })),
            errorLabel: 'GraphQL events query',
        }, params);
    }

    /**
     * Paginate `address(address).objects(filter)` via GraphQL. `this._params` = { owner, type, limit }
     * where `type` is a GraphQL `ObjectFilter.type` string.
     */
    async _fetchOwnedObjectsGraphql(params = {}) {
        const p = /** @type {any} */ (this._params);
        const owner = p.owner;
        const filter = p.type ? { type: p.type } : null;

        const query = `
            query OwnedObjects($owner: SuiAddress!, $filter: ObjectFilter, $first: Int, $after: String, $last: Int, $before: String) {
                address(address: $owner) {
                    objects(first: $first, after: $after, last: $last, before: $before, filter: $filter) {
                        pageInfo { hasNextPage endCursor hasPreviousPage startCursor }
                        nodes {
                            address
                            version
                            digest
                            contents {
                                type { repr }
                                json
                            }
                            owner {
                                __typename
                                ... on AddressOwner { address { address } }
                                ... on ObjectOwner { address { address } }
                                ... on ConsensusAddressOwner { address { address } }
                            }
                        }
                    }
                }
            }
        `;

        return await this._fetchGraphqlPaginated({
            query,
            variables: { owner, filter },
            extractConnection: (data) => data?.address?.objects,
            mapNode: (node) => /** @type {any} */ (new (this._suiMaster.SuiObject)({
                suiMaster: this._suiMaster,
                debug: this._debug,
                raw: /** @type {any} */ ({
                    objectId: node.address,
                    version: node.version,
                    type: node.contents?.type?.repr,
                    owner: SuiPaginatedResponse._normalizeGraphqlOwner(node.owner),
                    json: node.contents?.json,
                }),
            })),
            errorLabel: 'GraphQL owned-objects query',
        }, params);
    }

    /**
     * Paginate the GraphQL root `transactions(filter: TransactionFilter)` query.
     * `this._params` = { filter, limit } where `filter` is a GraphQL `TransactionFilter`
     * (`sentAddress`, `affectedAddress`, `affectedObject`, `function`, checkpoint bounds, `kind`).
     */
    async _fetchTransactionsGraphql(params = {}) {
        const query = `
            query Transactions($filter: TransactionFilter, $first: Int, $after: String, $last: Int, $before: String) {
                transactions(filter: $filter, first: $first, after: $after, last: $last, before: $before) {
                    pageInfo { hasNextPage endCursor hasPreviousPage startCursor }
                    nodes {
                        digest
                        sender { address }
                        effects {
                            status
                            timestamp
                            epoch { epochId }
                        }
                    }
                }
            }
        `;

        return await this._fetchGraphqlPaginated({
            query,
            variables: { filter: /** @type {any} */ (this._params).filter || {} },
            extractConnection: (data) => data?.transactions,
            mapNode: (node) => /** @type {any} */ (new SuiTransaction({
                suiMaster: this._suiMaster,
                debug: this._debug,
                data: /** @type {any} */ ({
                    digest: node.digest,
                    epoch: node.effects?.epoch?.epochId,
                    timestampMs: node.effects?.timestamp ? new Date(node.effects.timestamp).getTime() : null,
                    status: { success: node.effects?.status === 'SUCCESS' },
                    sender: node.sender?.address,
                }),
            })),
            errorLabel: 'GraphQL transactions query',
        }, params);
    }

    /**
     * Map a GraphQL Owner union node to the gRPC-style owner shape SuiObject consumes.
     */
    static _normalizeGraphqlOwner(owner) {
        if (!owner || !owner.__typename) return null;
        if (owner.__typename === 'AddressOwner') {
            return { AddressOwner: owner.address?.address || null };
        }
        if (owner.__typename === 'ObjectOwner') {
            return { ObjectOwner: owner.address?.address || null };
        }
        if (owner.__typename === 'ConsensusAddressOwner') {
            return { ConsensusAddressOwner: owner.address?.address || null };
        }
        if (owner.__typename === 'Shared') return { Shared: {} };
        if (owner.__typename === 'Immutable') return 'Immutable';
        return null;
    }
};
