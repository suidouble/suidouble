/**
 * @typedef {import("./SuiMaster.js").default} SuiMaster
 * @typedef {import("./SuiTransaction.js").default} SuiTransaction
 * @typedef {import("./SuiEvent.js").default} SuiEvent
 * @typedef {import("./SuiMemoryObjectStorage.js").default} SuiMemoryObjectStorage
 * @typedef {import("@mysten/sui/transactions").Inputs} Inputs
 */
export default class SuiPackage extends SuiObject {
    /**
     * Smart Contract Package on Sui blockchain
     *
     * @param {Object} params - Configuration parameters
     * @param {SuiMaster} params.suiMaster - instance of SuiMaster
     * @param {?string} [params.path] - Local filesystem path to the Move package source code
     * @param {?string} [params.id] - ID or address of the Move package on the Sui blockchain
     * @param {?Array.<string>|string} [params.modules] - List of modules in the package to look on chain in the UpgradeCap owned by current address
     * @param {boolean} [params.debug] - Enable debug mode
     */
    constructor(params: {
        suiMaster: SuiMaster;
        path?: string | null;
        id?: string | null;
        modules?: (Array<string> | string) | null;
        debug?: boolean;
    });
    /** @type {?string} */
    _path: string | null;
    /** @type {?Array.<string>|string} */
    _expectedModules: (Array<string> | string) | null;
    _isPublished: boolean;
    _publishedVersion: number;
    _upgradeCap: SuiObject;
    _upgradeCapId: string;
    _isBuilt: boolean;
    _builtModules: any;
    _builtDependencies: any;
    _builtDigest: any;
    /**
     * Cached original package id (first published version). Stable across upgrades.
     * Lazy — do not read directly, use `getOriginalPackageId()`.
     * @type {?string}
     */
    _originalPackageId: string | null;
    /** @type {Object.<string, SuiPackageModule>} */
    _modules: {
        [x: string]: SuiPackageModule;
    };
    /** @returns {SuiMemoryObjectStorage} shared object storage for this suiMaster */
    get objectStorage(): SuiMemoryObjectStorage;
    /** @returns {Object.<string, SuiPackageModule>} map of module name → SuiPackageModule */
    get modules(): {
        [x: string]: SuiPackageModule;
    };
    /**
     * Ensure the package is on chain, then return the named module.
     * @param {string} moduleName
     * @returns {Promise<SuiPackageModule|undefined>}
     */
    getModule(moduleName: string): Promise<SuiPackageModule | undefined>;
    /** @returns {boolean} true if the local Move project has been built via `build()` */
    get isBuilt(): boolean;
    /**
     * Returns true if this package is confirmed published on chain.
     * Swallows `checkOnChainIfNeeded` errors so it always resolves.
     * @returns {Promise<boolean>}
     */
    isOnChain(): Promise<boolean>;
    /**
     * Shortcut for `suiMaster.utils.pureInput(type, value)` — build a BCS-serialised Pure input
     * to use as a moveCall parameter.
     * @param {string} type - BCS type name, e.g. `'u64'`, `'address'`, `'string'`
     * @param {*} value
     * @returns {ReturnType<Inputs['Pure']>}
     */
    arg(type: string, value: any): ReturnType<Inputs["Pure"]>;
    /**
     * Convenience wrapper — delegates to `this.modules[moduleName].moveCall(...)`.
     * @param {string} moduleName
     * @param {string} methodName
     * @param {Array} params - see `SuiPackageModule.moveCall` for element shapes
     * @param {string[]} [typeArguments]
     * @returns {Promise<SuiTransaction>}
     */
    moveCall(moduleName: string, methodName: string, params: any[], typeArguments?: string[]): Promise<SuiTransaction>;
    /**
     * Fetch all events emitted by any module of this package, via the GraphQL `events` query.
     * Uses the original (first-version) package id so the filter stays stable across upgrades.
     * For module-scoped or event-type-scoped queries use `this.modules[name].fetchEvents(...)`.
     *
     * @param {Object} [params]
     * @param {number} [params.limit=50]
     * @param {string} [params.order] - Passed through to the underlying paginated response
     * @returns {Promise<SuiPaginatedResponse<SuiEvent>>}
     */
    fetchEvents(params?: {
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<SuiEvent>>;
    /**
     * List objects of any type belonging to this package owned by the current SuiMaster address.
     * Uses the original (first-version) package id and GraphQL (gRPC can't filter by package alone).
     *
     * For module-scoped or full-struct-type filtering use `this.modules[name].getOwnedObjects(...)`.
     *
     * @param {Object} [params]
     * @param {number} [params.limit=50]
     * @param {string} [params.order]
     * @returns {Promise<SuiPaginatedResponse<SuiObject>>}
     */
    getOwnedObjects(params?: {
        limit?: number;
        order?: string;
    }): Promise<SuiPaginatedResponse<SuiObject>>;
    /**
     * Get the original (first-version) package id, stable across upgrades.
     * Caches the value on first fetch.
     *
     * @returns {Promise<string>}
     */
    getOriginalPackageId(): Promise<string>;
    checkOnChainIfNeeded(): Promise<boolean>;
    /**
     * Try to find package on chain using its modules names.
     * Search for packages you own, in last versions of it
     * List all UpgradeCap -> List packages -> Filter ( max version, all modules )
     *
     * @returns {Promise<?string>} id of the highest-version package that contains all expected modules, or null if none matched
     */
    tryToFindByExpectedModules(): Promise<string | null>;
    /**
     * Get published package version
     *
     * @param {Object} [options]
     * @param {number} [options.timeout=10000] - total time in ms to keep polling if package is not found
     *
     * @returns {Promise<?number>} on-chain package version, or null if it could not be read before the timeout
     */
    getVersionOnChain(options?: {
        timeout?: number;
    }): Promise<number | null>;
    /**
     * Attach module to this package and add event listeners over it
     *
     * @param {string} moduleName
     * @returns {boolean} true if the module was newly attached, false if it was already attached
     */
    attachModule(moduleName: string): boolean;
    /**
     * UpgradeCap is capability object required to publish updates for a package.
     * We are trying to find it in owned objects with this function
     *
     * @returns {Promise<?string>} id of UpgradeCap for this package, or null if none is owned by the current address
     */
    getUpgradeCapId(): Promise<string | null>;
    /**
     * Read the result of a publish/upgrade transaction and update local package state:
     * sets `_id`, `_publishedVersion`, `_isPublished` from the created `package` object,
     * records `_upgradeCapId` from the created `UpgradeCap`, and refreshes on-chain version.
     *
     * @param {SuiTransaction} result - transaction result returned from publish()/upgrade()
     * @returns {Promise<boolean>} true if the package is now marked as published
     */
    storeInfoFromPublishResult(result: SuiTransaction): Promise<boolean>;
    /**
     * Publish the Move package to the chain for the first time.
     *
     * Flow:
     *  - build the local Move project if it has not been built yet
     *  - throw if the package already has an on-chain address (use upgrade() instead)
     *  - submit a publish transaction and transfer the returned UpgradeCap to the current address
     *  - refresh local publish info from the result
     *
     * @param {Object} [params] - Configuration parameters
     * @param {?string} [params.env] - Sui CLI env to switch to before building (forwarded to build())
     * @returns {Promise<?string>} the on-chain package id, or null if publish info could not be read
     * @throws if the package is already published
     */
    publish(params?: {
        env?: string | null;
    }): Promise<string | null>;
    /**
     * Upgrade an on-chain package to a newer version from local Move sources.
     *
     * Flow:
     *  - ensure the package is known on chain (checkOnChainIfNeeded)
     *  - build the local Move project if it has not been built yet
     *  - authorize the upgrade using the owned UpgradeCap (COMPATIBLE policy)
     *  - execute the upgrade transaction and commit it
     *  - refresh local publish info from the result
     *
     * Requires an UpgradeCap owned by the current address.
     *
     * @param {Object} [params] - Configuration parameters
     * @param {?string} [params.env] - Sui CLI env to switch to before building (forwarded to build())
     * @returns {Promise<boolean>} true on successful upgrade (version incremented), false otherwise
     */
    upgrade(params?: {
        env?: string | null;
    }): Promise<boolean>;
    /**
     * Build the local Move project by invoking `sui move build --dump-bytecode-as-base64`
     * and cache the resulting modules, dependencies and digest on the instance
     * (`_builtModules`, `_builtDependencies`, `_builtDigest`). Sets `_isBuilt = true`.
     *
     * Must have a local source `path` set on the package — throws otherwise.
     *
     * @param {Object} [params] - Configuration parameters
     * @param {?string} [params.env] - If set, runs `sui client switch --env <env>` before building
     * @param {?boolean} [params.withUnpublishedDependencies] - Pass `--with-unpublished-dependencies` to the build command
     * @returns {Promise<boolean>} true on success
     * @throws if no local path is set
     */
    build(params?: {
        env?: string | null;
        withUnpublishedDependencies?: boolean | null;
    }): Promise<boolean>;
    /**
     * Read the local `build/<pkg>/bytecode_modules` directory and return the list of compiled module names.
     * Requires the package to have been built already (via `sui move build` or this instance's `build()`).
     *
     * @returns {Promise<string[]>} list of module names (without the `.mv` suffix)
     * @throws if the local path is not set or the build directory can not be read
     */
    getModulesNamesFromBuild(): Promise<string[]>;
}
export type SuiMaster = import("./SuiMaster.js").default;
export type SuiTransaction = import("./SuiTransaction.js").default;
export type SuiEvent = import("./SuiEvent.js").default;
export type SuiMemoryObjectStorage = import("./SuiMemoryObjectStorage.js").default;
export type Inputs = any;
import SuiObject from './SuiObject.js';
import SuiPackageModule from './SuiPackageModule.js';
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
