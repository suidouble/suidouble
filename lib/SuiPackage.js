import SuiCliCommands from './SuiCliCommands.js';
import SuiObject from './SuiObject.js';
import SuiPackageModule from './SuiPackageModule.js';
import SuiPaginatedResponse from './SuiPaginatedResponse.js';
import { Transaction } from '@mysten/sui/transactions';


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
    constructor(params) {
        super(params);

        /** @type {?string} */
        this._path = params.path;
        /** @type {?string} */
        this._id = params.id || null;
        /** @type {?Array.<string>|string} */
        this._expectedModules = params.modules || null;

        this._isPublished = false;
        this._publishedVersion = null;

        this._upgradeCap = null;
        this._upgradeCapId = null;

        this._isBuilt = false;
        this._builtModules = null;
        this._builtDependencies = null;
        this._builtDigest = null;

        /**
         * Cached original package id (first published version). Stable across upgrades.
         * Lazy — do not read directly, use `getOriginalPackageId()`.
         * @type {?string}
         */
        this._originalPackageId = null;

        /** @type {Object.<string, SuiPackageModule>} */
        this._modules = {

        };
    }

    /** @returns {SuiMemoryObjectStorage} shared object storage for this suiMaster */
    get objectStorage() {
        return this._suiMaster.objectStorage;
    }

    /** @returns {Object.<string, SuiPackageModule>} map of module name → SuiPackageModule */
    get modules() {
        return this._modules;
    }

    /**
     * Ensure the package is on chain, then return the named module.
     * @param {string} moduleName
     * @returns {Promise<SuiPackageModule|undefined>}
     */
    async getModule(moduleName) {
        await this.checkOnChainIfNeeded();
        return this._modules[moduleName];
    }

    /** @returns {boolean} true if the local Move project has been built via `build()` */
    get isBuilt() {
        return this._isBuilt;
    }

    /**
     * Published version of this package as a plain `number`.
     * Returns `0` if the package has not been published yet (`_publishedVersion` is null).
     * @returns {number}
     */
    get version() {
        return Number(this._publishedVersion); // return as Number in getter
    }

    /**
     * Returns true if this package is confirmed published on chain.
     * Swallows `checkOnChainIfNeeded` errors so it always resolves.
     * @returns {Promise<boolean>}
     */
    async isOnChain() {
        try {
            await this.checkOnChainIfNeeded();
        } catch (e) {
            console.error(e);
        }

        if (this._publishedVersion && this._isPublished && this.address) {
            return true;
        }

        return false;
    }

    /**
     * Shortcut for `suiMaster.utils.pureInput(type, value)` — build a BCS-serialised Pure input
     * to use as a moveCall parameter.
     * @param {string} type - BCS type name, e.g. `'u64'`, `'address'`, `'string'`
     * @param {*} value
     * @returns {ReturnType<Inputs['Pure']>}
     */
    arg(type, value) {
        return this._suiMaster.utils.pureInput(type, value);
    }

    /**
     * Convenience wrapper — delegates to `this.modules[moduleName].moveCall(...)`.
     * @param {string} moduleName
     * @param {string} methodName
     * @param {Array} params - see `SuiPackageModule.moveCall` for element shapes
     * @param {string[]} [typeArguments]
     * @returns {Promise<SuiTransaction>}
     */
    async moveCall(moduleName, methodName, params, typeArguments) {
        await this.checkOnChainIfNeeded();
        return await this.modules[moduleName].moveCall(methodName, params, typeArguments);
    }

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
    async fetchEvents(params = {}) {
        await this.checkOnChainIfNeeded();

        const packageId = await this.getOriginalPackageId();

        return await this._suiMaster.fetchEvents({
            filter: { module: packageId },
            limit: params.limit,
            order: params.order,
        });
    }

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
    async getOwnedObjects(params = {}) {
        await this.checkOnChainIfNeeded();

        const packageId = await this.getOriginalPackageId();

        return await this._suiMaster.getOwnedObjects({
            owner: this._suiMaster.address,
            type: packageId,
            limit: params.limit || 50,
        }, { order: params.order });
    }

    /**
     * Get the original (first-version) package id, stable across upgrades.
     * Caches the value on first fetch.
     *
     * @returns {Promise<string>}
     */
    async getOriginalPackageId() {
        if (this._originalPackageId) {
            return this._originalPackageId;
        }

        const { response } = await this._suiMaster._client.movePackageService.getPackage({
            packageId: this.address,
        });
        const pkg = response?.package;
        this._originalPackageId = pkg?.originalId || pkg?.storageId || this.address;

        return this._originalPackageId;
    }

    async checkOnChainIfNeeded() {
        if (this._isPublished) {
            return true;
        } 

        if (!this._id && !this._expectedModules && this._path) {
            // we can get needed modules names from local package path
            this._expectedModules = await this.getModulesNamesFromBuild();
        }

        if (!this._id && this._expectedModules) {
            // we can get most recent version of package published on blockchain using names of needed modules in it
            this._id = await this.tryToFindByExpectedModules();
        }

        if (!this._id) {
            // if we really can not find any address on blockchain, means we need to publish it first
            throw new Error('no package id, nothing to check. Maybe lets start with .publish() ?');
        }

        const version = await this.getVersionOnChain();
        if (version) {
            this._isPublished = true;
            return true;
        }
    }

    /**
     * Try to find package on chain using its modules names.
     * Search for packages you own, in last versions of it
     * List all UpgradeCap -> List packages -> Filter ( max version, all modules )
     * 
     * @returns {Promise<?string>} id of the highest-version package that contains all expected modules, or null if none matched
     */
    async tryToFindByExpectedModules() {
        this.log('trying to find Package by expected modules in its content...');

        // normalize expected modules. May be an array or comma separated string
        const expectModules = [];

        let arr = Array.isArray(this._expectedModules)
            ? this._expectedModules
            : (''+this._expectedModules).split(',');
        arr.forEach((item)=>{
            if (item.trim()) {
                if (expectModules.indexOf(item.trim()) === -1) {
                    expectModules.push(item.trim());
                }
            }
        });

        this.log('looking for modules', expectModules);

        const packagesOnChainIds = []; // ids of packages with most recent versions

        // UpgradeCap references to most recent version of packages. But there're no modules fields in it
        // So what we do is getting list of UpgradeCap first
        const paginatedResponse = await this._suiMaster.getOwnedObjects({
            owner: this._suiMaster.address,
            type: '0x2::package::UpgradeCap',
            limit: 50,
            include: {
                content: true,
                json: true,
            },
        });

        await paginatedResponse.forEach((suiObject)=>{
            const packageId = suiObject.fields.package;
            if (packageId && packagesOnChainIds.indexOf(packageId) === -1) {
                packagesOnChainIds.push(packageId);
            }
        }); // go through all available UpgradeCap
        // paginatedResponse.forEach also accepts async callbacks

        // fetch each package via movePackageService to check its modules list
        const packagesResult = await Promise.all(
            packagesOnChainIds.map(async (packageId) => {
                try {
                    const { response } = await this._suiMaster._client.movePackageService.getPackage({ packageId });
                    return response?.package ? { packageId, pkg: response.package } : null;
                } catch (e) {
                    return null;
                }
            })
        );

        let maxVersion = 0;
        let packageIdWithMaxVersion = null;
        let packagesWithOkModulesCount = 0; // just to log

        // find package with highest version which has all needed modules
        for (const item of packagesResult) {
            if (!item) continue;
            const { packageId, pkg } = item;

            const moduleNames = (pkg.modules || []).map((m) => m.name);
            const allNeededModules = expectModules.every((m) => moduleNames.includes(m));

            const version = Number(pkg.version ?? 0);

            if (allNeededModules) {
                packagesWithOkModulesCount++;
                if (version > maxVersion) {
                    maxVersion = version;
                    packageIdWithMaxVersion = pkg.storageId || packageId;
                }
            }
        }

        this.log('found packages with needed modules', packagesWithOkModulesCount);
        if (packageIdWithMaxVersion) {
            this.log('the one with most recent Publisher version is', packageIdWithMaxVersion, 'version', maxVersion);

            return packageIdWithMaxVersion;
        }

        return null;
    }

    /**
     * Get published package version
     * 
     * @param {Object} [options]
     * @param {number} [options.timeout=10000] - total time in ms to keep polling if package is not found
     * 
     * @returns {Promise<?number>} on-chain package version, or null if it could not be read before the timeout
     */
    async getVersionOnChain(options = {}) {
        this.log('geting package version previously published on chain...');

        const timeout = options.timeout !== undefined ? options.timeout : 10000;
        const pollInterval = 1000;
        const deadline = Date.now() + timeout;

        const client = await this._suiMaster.getClient();

        let pkg = null;
        while (true) {
            try {
                const { response } = await client.movePackageService.getPackage({
                    packageId: this.address,
                });
                pkg = response?.package;
            } catch (e) {
                const willRetry = Date.now() + pollInterval <= deadline;
                this.log('getPackage failed', e && e.message ? e.message : e, willRetry ? `will retry in ${pollInterval}ms` : 'giving up, timeout reached');
                pkg = null;
            }

            if (pkg) {
                break;
            }

            if (Date.now() + pollInterval > deadline) {
                this.log('package not found on chain', this.address);
                return this._publishedVersion;
            }

            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }

        if (pkg.version !== undefined) {
            this._publishedVersion = Number(pkg.version);
            this._isPublished = true;
        }

        if (pkg.modules) {
            for (const moduleDef of pkg.modules) {
                if (moduleDef.name) {
                    this.attachModule(moduleDef.name);
                }
            }
        }

        this.log('on chain version', this._publishedVersion, 'with modules', Object.keys(this._modules));

        return this._publishedVersion;
    }

    /**
     * Attach module to this package and add event listeners over it
     *
     * @param {string} moduleName
     * @returns {boolean} true if the module was newly attached, false if it was already attached
     */
    attachModule(moduleName) {
        if (this._modules[moduleName]) {
            return false;
        }

        this._modules[moduleName] = new SuiPackageModule({
            suiMaster: this._suiMaster,
            debug: this._debug,
            moduleName: moduleName,
            package: this,
        });
        this._modules[moduleName].addEventListener('added', (data)=>{
            const object = /** @type {any} */ (data).detail;
            this.emit('added', object);
        });


        return true;
    }


    /**
     * UpgradeCap is capability object required to publish updates for a package.
     * We are trying to find it in owned objects with this function
     * 
     * @returns {Promise<?string>} id of UpgradeCap for this package, or null if none is owned by the current address
     */
    async getUpgradeCapId() {
        if (this._upgradeCap) {
            return this._upgradeCap.address;
        }

        this.log('trying to find UpgradeCap for this package in owned objects...');

        const ownedUpgradeCapsPaginated = await this._suiMaster.getOwnedObjects({
                owner: this._suiMaster.address,
                type: '0x2::package::UpgradeCap',
                include: {
                    content: true,
                    objectBcs: true,
                    json: true,
                },
            });
        ownedUpgradeCapsPaginated.forEach((suiObject)=>{
            if (suiObject?.fields?.package == this._id) {
                this._upgradeCap = suiObject;
            }
        });

        if (this._upgradeCap) {
            this.log('found UpgradeCap', this._upgradeCap.id);
            return this._upgradeCap.id;
        }

        this.log('no UpgradeCap for this package found. Are you sure you work with most recent version of the package?');
        return null;
    }

    /**
     * Read the result of a publish/upgrade transaction and update local package state:
     * sets `_id`, `_publishedVersion`, `_isPublished` from the created `package` object,
     * records `_upgradeCapId` from the created `UpgradeCap`, and refreshes on-chain version.
     *
     * @param {SuiTransaction} result - transaction result returned from publish()/upgrade()
     * @returns {Promise<boolean>} true if the package is now marked as published
     */
    async storeInfoFromPublishResult(result) {
        if (result && result.created) {
            for (const createdObject of result.created) {
                if (createdObject.type == 'package') {
                    this._id = createdObject.id;
                    this._isPublished = true;
                    this._publishedVersion = createdObject.version;
                } else if (createdObject.typeName == 'UpgradeCap') {
                    this._upgradeCapId = createdObject.id;
                    this.log('UpgradeCap', this._upgradeCapId);
                } else {
                    // objects created by the Move `init` function (e.g. shared objects)
                    this.objectStorage.push(createdObject);
                }
            }

            if (this._id) {
                await this.getVersionOnChain();
            }
        }


        return this._isPublished;
    }

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
    async publish(params = {}) {
        if (!this._isBuilt) {
            await this.build(params);
        }
        if (this.address) {
            throw new Error('already published. Maybe you need to upgrade() it?');
        }

        this.log('publishing package...');

        const tx = new Transaction();
        const [upgradeCap] = tx.publish({
            modules: this._builtModules,
            dependencies: this._builtDependencies,
        });

        tx.transferObjects([upgradeCap], this._suiMaster.address);
        tx.setSenderIfNotSet(this._suiMaster.address);

        const result = await this._suiMaster.signAndExecuteTransaction({
            transaction: tx,
            include: {
                effects: true,
                objectTypes: true,
            },
        });

        const success = await this.storeInfoFromPublishResult(result);

        if (success) {
            this.log('published');
        }

        this.log('published', this.address);

        return this.address;
    }

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
    async upgrade(params = {}) {
        await this.checkOnChainIfNeeded();

        if (!this._isBuilt) {
            await this.build(params);
        }

        this.log('upgrading package...');

        const tx = new Transaction();

        const cap = tx.object(await this.getUpgradeCapId());
        // export enum UpgradePolicy {
        //     COMPATIBLE = 0,
        //     ADDITIVE = 128,
        //     DEP_ONLY = 192,
        //   }
        const UpgradePolicyCOMPATIBLE = 0;

        const authorizeUpgradeArguments = [
            cap,
            this._suiMaster.utils.txInput(tx, 'u8', UpgradePolicyCOMPATIBLE), 
            this._suiMaster.utils.txInput(tx, 'vector<u8>', this._builtDigest), 
        ];

        const ticket = tx.moveCall({
            target: '0x2::package::authorize_upgrade',
            arguments: authorizeUpgradeArguments,
        });

        const receipt = tx.upgrade({
            modules: this._builtModules,
            dependencies: this._builtDependencies,
            package: this.address,
            ticket,
        });

        tx.moveCall({
            target: '0x2::package::commit_upgrade',
            arguments: [cap, receipt],
        });

        const wasAtVersion = this._publishedVersion;

        const signAndExecuteTransactionResult = await this._suiMaster.signAndExecuteTransaction({
            transaction: tx,
            include: {
                effects: true,
                objectTypes: true,
            },
            requestType: 'WaitForLocalExecution',
        });
        const success = await this.storeInfoFromPublishResult(signAndExecuteTransactionResult);

        if (success && this._publishedVersion > wasAtVersion) {
            this.log('upgraded. New version: '+this._publishedVersion+' at packageId: '+this._id);

            return true;
        }

        return false;
    }

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
    async build(params = {}) {
        this.log('building a package...');

        const path = this._path;

        if (!path) {
            throw new Error('Cant build a package with no path defined');
        }

        if (params.env) {
            // switch to env
            this.log('switching environment to', params.env);
            const switchResult = await SuiCliCommands.exec(`sui client switch --env ${params.env}`);
            this.log(switchResult);
        }

        let command = `sui move build --dump-bytecode-as-base64 --path ${path}`;
        if (params.withUnpublishedDependencies) {
            command = `sui move build --with-unpublished-dependencies --dump-bytecode-as-base64 --path ${path}`;
        }
        const buildResult = await SuiCliCommands.exec(command);
        const { modules, dependencies, digest } = JSON.parse(buildResult);

        this._builtModules = modules;
        this._builtDependencies = dependencies;
        this._builtDigest = digest;

        this._isBuilt = true;

        this.log('package built');

        return true;
    }

    /**
     * Read the local `build/<pkg>/bytecode_modules` directory and return the list of compiled module names.
     * Requires the package to have been built already (via `sui move build` or this instance's `build()`).
     *
     * @returns {Promise<string[]>} list of module names (without the `.mv` suffix)
     * @throws if the local path is not set or the build directory can not be read
     */
    async getModulesNamesFromBuild() {
        this.log('trying to get modules names from local package path...');

        try {
            return SuiCliCommands.getModulesNamesFromPackagePath(this._path);
        } catch (e) {
            this.log(e);
            throw new Error('can not get modules names from local package path');
        }
    }

};
