const SuiCliCommands = require('./SuiCliCommands.js');
const SuiObject = require('./SuiObject.js');
const SuiPackageModule = require('./SuiPackageModule.js');
const SuiPaginatedResponse = require('./SuiPaginatedResponse.js');

// fromB64, toB64
const { TransactionBlock } = require('@mysten/sui.js/transactions');
const { normalizeSuiAddress } = require('@mysten/sui.js/utils');

class SuiPackage extends SuiObject {
    constructor(params = {}) {
        super(params);

        // set in super()  :
        // this._id
        // this._suiMaster

        this._path = params.path;
        this._id = params.id || null;
        this._expectedModules = params.modules || null;

        this._isPublished = false;
        this._publishedVersion = null;

        this._upgradeCap = null;
        this._upgradeCapId = null;

        this._isBuilt = false;
        this._builtModules = null;
        this._builtDependencies = null;
        this._builtDigest = null;

        this._modules = {

        };
    }

    get objectStorage() {
        return this._suiMaster.objectStorage;
    }

    get modules() {
        return this._modules;
    }

    async getModule(moduleName) {
        await this.checkOnChainIfNeeded();
        return this._modules[moduleName];
    }

    get isBuilt() {
        return this._isBuilt;
    }

    get version() {
        return Number(this._publishedVersion); // return as Number in getter
    }

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

    async moveCall(moduleName, methodName, params) {
        await this.checkOnChainIfNeeded();
        return await this.modules[moduleName].moveCall(methodName, params);
    }

    async fetchEvents(moduleName, params = {}) {
        await this.checkOnChainIfNeeded();
        return await this.modules[moduleName].fetchEvents(params);
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
     * @returns id of package
     */
    async tryToFindByExpectedModules() {
        this.log('trying to find Package by expected modules in its content...');

        // normalize expected modules. May be an array or comma separated string
        const expectModules = [];

        let arr = this._expectedModules;
        if (!Array.isArray(this._expectedModules)) {
            //
            arr = (''+this._expectedModules).split(',');
        }
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
        const queryParams = {
            owner: this._suiMaster.address,
            filter: { StructType: '0x2::package::UpgradeCap', }, 
            limit: 50, // max limit is 50
            options: {
                showType: true,
                showContent: true,
                showOwner: true,
                showDisplay: true,
            },
        };

        const paginatedResponse = new SuiPaginatedResponse({
            debug: this._debug,
            suiMaster: this._suiMaster,
            params: queryParams,
            method: 'getOwnedObjects',
        });

        await paginatedResponse.forEach((suiObject)=>{
            const packageId = suiObject.fields.package;
            if (packageId && packagesOnChainIds.indexOf(packageId) === -1) {
                packagesOnChainIds.push(packageId);
            }
        }); // go through all available UpgradeCap
        // paginatedResponse.forEach also accepts async callbacks

        // queriing packages out of the loop, as not sure if pagination cursor works ok with mixed calls, @todo: check
        // @todo: what is the max count of ids here?
        const packagesResult = await this._suiMaster._provider.multiGetObjects({
            ids: packagesOnChainIds,
            // only fetch the object type
            options: { showType: true, showContent: true, },
          });

        let maxVersion = BigInt(0); 
        let packageIdWithMaxVersion = null;
        let packagesWithOkModulesCount = 0; // just to log

        // find package with highest version which has all needed modules
        for (const packagesResultItem of packagesResult) {
            let allNeededModules = true;
            expectModules.forEach((expectModuleName)=>{
                if (!packagesResultItem?.data?.content?.disassembled[expectModuleName]) {
                    allNeededModules = false;
                }
            });

            const version = BigInt(packagesResultItem.data.version);

            if (allNeededModules) {
                packagesWithOkModulesCount++;
            }

            if (version > maxVersion) {
                maxVersion = version;
                packageIdWithMaxVersion = packagesResultItem.data.objectId;
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
     * @returns Number
     */
    async getVersionOnChain() {
        this.log('geting package version previously published on chain...');

        const provider = await this._suiMaster.getProvider();

        const result = await provider.getObject({
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

        if (result?.data?.version) {
            this._publishedVersion = BigInt(result?.data?.version); // not sure, but it's string in response, so let's convert it to bigint, who knows
            this._isPublished = true;
        }

        if (result?.data?.content?.disassembled) {
            for (const key in result?.data?.content?.disassembled) {
                this.attachModule(key);
                // if (!this._modules[key]) {
                //     this._modules[key] = new SuiPackageModule({
                //         suiMaster: this._suiMaster,
                //         debug: this._debug,
                //         moduleName: key,
                //         package: this,
                //     });
                // }
            }
        }

        this.log('on chain version', this._publishedVersion, 'with modules', Object.keys(this._modules));
        
        return this._publishedVersion;
    }

    /**
     * Attach module to this package and add event listeners over it
     * @param {String} moduleName 
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
            const object = data.detail;
            this.emit('added', object);
        });


        return true;
    }


    /**
     * UpgradeCap is capability object required to publish updates for a package.
     * We are trying to find it in owned objects with this function
     * @returns address of UpgradeCap for this package
     */
    async getUpgradeCapId() {
        if (this._upgradeCap) {
            return this._upgradeCap.address;
        }

        this.log('trying to find UpgradeCap for this package in owned objects...');

        let hasNextPage = false;
        let nextCursor = null;

        do {
            const queryParams = {
                owner: this._suiMaster.address,
                filter: { StructType: '0x2::package::UpgradeCap', }, 
                limit: 50, // max limit is 50
                options: {
                  showType: true,
                  showContent: true,
                  showOwner: true,
                  showDisplay: true,
                },
            };

            if (nextCursor) {
                queryParams.cursor = nextCursor;
            }

            const result = await this._suiMaster._provider.getOwnedObjects(queryParams);

            if (result.hasNextPage && result.nextCursor) {
                hasNextPage = true;
                nextCursor = result.nextCursor;
            } else {
                hasNextPage = false;
            }

            for (const object of result.data) {
                if (object?.data?.content?.fields?.package == this._id) {
                    this._upgradeCap = new SuiObject({
                        id: object.data.objectId,
                        suiMaster: this._suiMaster,
                        debug: this._debug,
                    });
    
                    this.log('found UpgradeCap', this._upgradeCap.address);
    
                    return this._upgradeCap.address;
                }
            }
        } while(hasNextPage && !this._upgradeCap);

        this.log('no UpgradeCap for this package found. Are you sure you work with most recent version of the package?');

        return null;
    }

    async storeInfoFromPublishResult(result) {

        if (result && result.objectChanges && result.objectChanges.length) {
            for (const objectChange of result.objectChanges) {
                if (objectChange.type === 'published' && objectChange.packageId) {
                    this._id = normalizeSuiAddress(objectChange.packageId);
                    this._isPublished = true;

                    if (objectChange.version) {
                        this._publishedVersion = BigInt(objectChange.version);
                    }

                    if (objectChange.modules) {
                        for (const module of objectChange.modules) {
                            this.attachModule(module);
                        }
                    }
                }

                if (objectChange.type === 'created' && objectChange.objectType.indexOf('::package::UpgradeCap') !== -1) {
                    this._upgradeCapId = objectChange.objectId;
                    this.log('UpgradeCap', this._upgradeCapId);
                }
            }

            // now as we have modules stored, we can try to push objects to them
            for (const objectChange of result.objectChanges) {
                if (objectChange.objectId && objectChange.objectType && objectChange.type && (objectChange.type == 'created' || objectChange.type == 'mutated')) {
                    // : not sure if it's good decision, but lets add objects to all modules we published
                    for (const moduleName in this._modules) {
                        const object = this._modules[moduleName].pushObject(objectChange.objectId);
                        if (object) {
                            object.tryToFillDataFromObjectChange(objectChange);
                        }
                    }
                }
            }

            this.log('got results:', this.address, 'version', this._publishedVersion, 'with modules', Object.keys(this._modules));

            return true;
        } else {
            this.log('nothing is found in publish result. storing old values');

            return false;
        }
    }

    async publish() {
        if (!this._isBuilt) {
            await this.build();
        }
        if (this.address) {
            throw new Error('already published. Maybe you need to upgrade() it?');
        }

        this.log('publishing package...');

        const tx = new TransactionBlock();
        const [upgradeCap] = tx.publish({
            modules: this._builtModules,
            dependencies: this._builtDependencies,
        });

        tx.transferObjects([upgradeCap], tx.pure(this._suiMaster.address));

        const result = await this._suiMaster.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            requestType: 'WaitForLocalExecution',
            options: {
                "showEffects": true, // @todo: remove?
                "showEvents": true, // @todo: remove?
                "showObjectChanges": true,
            },
        });

        const success = await this.storeInfoFromPublishResult(result);

        if (success) {
            this.log('published');
        }

        return this.address;
    }

    async upgrade() {
        await this.checkOnChainIfNeeded();

        if (!this._isBuilt) {
            await this.build();
        }

        this.log('upgrading package...');

        const tx = new TransactionBlock();

        const cap = tx.object(await this.getUpgradeCapId());
        // export enum UpgradePolicy {
        //     COMPATIBLE = 0,
        //     ADDITIVE = 128,
        //     DEP_ONLY = 192,
        //   }
        const UpgradePolicyCOMPATIBLE = 0;

        const ticket = tx.moveCall({
            target: '0x2::package::authorize_upgrade',
            arguments: [cap, tx.pure(UpgradePolicyCOMPATIBLE), tx.pure(this._builtDigest)],
        });

        const receipt = tx.upgrade({
            modules: this._builtModules,
            dependencies: this._builtDependencies,
            packageId: this.address, // normalized id
            ticket,
        });

        tx.moveCall({
            target: '0x2::package::commit_upgrade',
            arguments: [cap, receipt],
        });

        const result = await this._suiMaster.signAndExecuteTransactionBlock({
            transactionBlock: tx,
            options: {
                showEffects: true,
                showObjectChanges: true,
            },
        });

        const success = await this.storeInfoFromPublishResult(result);

        if (success) {
            this.log('upgraded');
        }

        return this.address;
    }

    /**
     * Build a Move project using `sui move build`
     * @returns Boolean true on success
     */
    async build() {
        this.log('builing a package...');

        const path = this._path;

        if (!path) {
            throw new Error('Cant build a package with no path defined');
        }

        const buildResult = await SuiCliCommands.exec(`sui move build --dump-bytecode-as-base64 --path ${path}`);
        const { modules, dependencies, digest } = JSON.parse(buildResult);

        this._builtModules = modules;
        this._builtDependencies = dependencies;
        this._builtDigest = digest;

        this._isBuilt = true;

        this.log('package built');

        return true;
    }

    /**
     * Get list of expected modules from local package path
     * @returns array of module names
     */
    async getModulesNamesFromBuild() {
        this.log('tring to get modules names from local package path...');

        try {
            return SuiCliCommands.getModulesNamesFromPackagePath(this._path);
        } catch (e) {
            this.log(e);
            throw new Error('can not get modules names from local package path');
        }
    }
}

module.exports = SuiPackage;