import SuiCommonMethods from './SuiCommonMethods.js';

/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 * @typedef {import("./SuiObject.js").default} SuiObject
 * @typedef {import("./SuiEvent.js").default} SuiEvent
 */

/**
 * Wrapper over a Sui transaction result. Lazily parses `effects.changedObjects` into
 * typed `created`, `mutated`, `deleted` lists and wraps events in `SuiEvent` instances.
 */
export default class SuiTransaction extends SuiCommonMethods {
    /**
     * @param {Object} params
     * @param {SuiMaster} params.suiMaster
     * @param {SuiClientTypes.Transaction} params.data - raw transaction data
     * @param {boolean} [params.debug]
     */
    constructor(params) {
        super(params);

        this._debug = !!params.debug;
        /** @type {SuiMaster} */
        this._suiMaster = params.suiMaster;
        if (!this._suiMaster) {
            throw new Error('suiMaster is requried');
        }

        /** @type {?SuiClientTypes.Transaction} */
        this._data = params.data;

        /** @type {?{created: SuiObject[], mutated: SuiObject[], deleted: SuiObject[], objects: SuiObject[]}} */
        this._results = null;
        /** @type {?SuiEvent[]} */
        this._events = null;
    }

    /** @returns {?number} epoch the transaction executed in, or null if unavailable */
    get executedEpoch() {
        if (this._data && this._data.epoch) {
            return Number(this._data.epoch);
        }
        return null;
    }

    /** @returns {?string} Base58-encoded transaction digest, or null if data isn't set */
    get digest() {
        if (this._data) {
            return this._data.digest;
        }
        return null;
    }

    /** @returns {?bigint} net gas cost in MIST (computationCost + storageCost − storageRebate), or null */
    get gasUsed() {
        try {
            if (this._data && this._data.effects && this._data.effects.gasUsed) {
                return BigInt(this._data.effects.gasUsed.computationCost) + BigInt(this._data.effects.gasUsed.storageCost) - BigInt(this._data.effects.gasUsed.storageRebate);
            }
        } catch (e) {
            return null;
        }

        return null;
    }

    /** @returns {SuiObject[]} objects deleted by this transaction */
    get deleted() {
        const results = this.results;
        return results.deleted;
    }

    /** @returns {SuiObject[]} objects mutated (version changed) by this transaction */
    get mutated() {
        const results = this.results;
        return results.mutated;
    }

    /** @returns {SuiObject[]} objects created by this transaction */
    get created() {
        const results = this.results;
        return results.created;
    }

    /** @returns {?SuiClientTypes.Transaction} raw transaction data as received from the client */
    get data() {
        return this._data;
    }

    /**
     * Returns true if the transaction's status indicates success.
     * @returns {boolean}
     */
    isSuccessful() {
        if (this.data && this.data.status && this.data.status.success) {
            return true;
        }
        return false;
    }

    /** @returns {SuiEvent[]} events emitted by this transaction, lazily built and cached */
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
                    data: {
                        // map gRPC SuiClientTypes.Event shape → SuiEventData shape
                        type: event.eventType,
                        parsedJson: event.json,
                        sender: event.sender,
                        bcs: event.bcs,
                    },
                });

                events.push(suiEvent);
            }
        }

        this._events = events;
        return this._events;
    }

    /**
     * Parsed object-change results, lazily built from `effects.changedObjects` and cached.
     * @returns {{created: SuiObject[], mutated: SuiObject[], deleted: SuiObject[], objects: SuiObject[]}}
     */
    get results() {
        if (this._results) {
            return this._results;
        }

        /** @type {Object.<string, SuiObject>} */
        const objects = {};

        const listCreated = [];
        const listMutated = [];
        const listDeleted = [];

        if (this.data?.effects?.changedObjects) {
            for (const objectChange of this.data.effects.changedObjects) {
                if (objectChange.objectId) {
                    const objectId = objectChange.objectId;
                    const idOperation = objectChange.idOperation;
                    const typeGuess = 
                        (this.data.objectTypes && this.data.objectTypes[objectChange.objectId]) ?
                        this.data.objectTypes[objectChange.objectId] : undefined;

                    if (!objects[objectId]) {
                        const obj = new this._suiMaster.SuiObject({
                            suiMaster: this._suiMaster,
                            debug: this._debug,
                            id: objectChange.objectId,
                            version: objectChange.outputVersion,
                            type: typeGuess,
                        });
                        objects[objectId] = obj;
                    }
                    

                    if (idOperation == 'Created') { 
                        listCreated.push(objects[objectId]);
                    } else if (idOperation == 'Deleted') {
                        listDeleted.push(objects[objectId]);
                        objects[objectId].markAsDeleted();
                    } else if (objectChange.inputVersion && objectChange.outputVersion 
                        && objectChange.inputVersion != objectChange.outputVersion
                    ) {
                        listMutated.push(objects[objectId]);
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

    /**
     * Wait for this transaction to be finalised on chain, then refresh `_data` with the full result.
     * Clears the cached `_results` and `_events` so getters recompute from the fresh data.
     *
     * @param {SuiClientTypes.WaitForTransactionOptions} [input] - extra options forwarded to `client.waitForTransaction`
     * @returns {Promise<this>}
     * @throws if `digest` is not set
     */
    async waitForTransaction(input = /** @type {SuiClientTypes.WaitForTransactionOptions<{}>} */ ({})) {
        if (!this.digest) {
            throw new Error('can not waitForTransaction: digest is not set');
        }

        const result = await this._suiMaster.client.waitForTransaction(
            /** @type {SuiClientTypes.WaitForTransactionOptions<{}>} */ ({
                ...input,
                digest: this.digest,
            })
        );

        this._data = result.Transaction;
        this._results = null;
        this._events = null;

        return this;
    }

    /**
     * Checkpoint timestamp in milliseconds since epoch, or null if unavailable.
     *
     * Only populated when the transaction was fetched via the GraphQL path
     * (`SuiMaster.fetchTransactions`). Transactions returned from `signAndExecuteTransaction`
     * or `waitForTransaction` (gRPC) do not carry a timestamp in their data shape and will
     * always return null here.
     *
     * @returns {?number}
     */
    get timestampMs() {
        const ts = /** @type {any} */ (this.data)?.timestampMs;
        if (ts) {
            return parseInt(''+ts, 10);
        } else {
            return null;
        }
    }
};
