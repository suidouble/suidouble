import SuiCommonMethods from './SuiCommonMethods.js';
import SuiLocalTestValidator from './SuiLocalTestValidator.js';
import SuiMaster from './SuiMaster.js';
import SuiUtils from './SuiUtils.js';


export default class SuiTestScenario extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._path = params.path; // path to Move package's root
        this._client = null;

        this._defaultAs = null; // 'as'(string for pseudo-random keypair generator) for default user and package's owner 
                                // (we will publish and init from this user)
        this._currentAs = null; // 'as' for current wrapped transaction

        this._masters = {       // suiMaster and package for each 'as'
        };
        this._packages = {
        };

        this._publishedPackageId = null;
    }

    get currentAs() {
        return this._currentAs;
    }

    arg(type, value) {
        return SuiUtils.pureInput(type, value);
    }

    /**
     * Start local test validator and set up `as` as owner of package deploy transaction.
     * Package will be deployed with method `init`, as we try to mimic Sui Move's test_scenario
     * @param {String} as 
     */
    async begin(as) {
        this._client = await SuiLocalTestValidator.launch({debug: true});
        this._defaultAs = as;
        this._currentAs = as;
    }

    /**
     * Shut down test validator and finish test scenario
     */
    async end() {
        await SuiLocalTestValidator.stop();
    }

    /**
     * Deploy the package. Move will execute it's init function.
     */
    async init() {
        if (!this._defaultAs) {
            throw new Error('please call .begin(as) first');
        }

        this._currentAs = this._defaultAs;
        await this.initMaster(this._defaultAs);
    }


    /**
     * Temorary assign user to `as`
     * @param {String} as 
     * @param {Function} func 
     */
    async next_tx(as, func) {
        if (!this._defaultAs) {
            throw new Error('please call .begin(as) first');
        }

        try {
            await this.initMaster(as);
            this._currentAs = as;
            await func(this);
            this._currentAs = this._defaultAs;
        } catch (e) {
            throw e;
        }
    }
    async nextTx(as, func) {
        return this.next_tx(as, func);
    }

    take_from_sender(typeName) {
        const asAsAddress = this._masters[this._currentAs].address;
        const objectStorage = this._masters[this._currentAs].objectStorage; // it's same object for different 'as' connected to the same provider, but we don't care here
        return objectStorage.findMostRecent((object)=>{
                return (object.typeName == typeName && object.isOwnedBy(asAsAddress));
            });
    }
    takeFromSender(typeName) {
        return this.take_from_sender(typeName);
    }

    take_shared(typeName) {
        const objectStorage = this._masters[this._currentAs].objectStorage; // it's same object for different 'as' connected to the same provider, but we don't care here
        return objectStorage.findMostRecent((object)=>{
                return (object.isShared && object.typeName == typeName);
            });
    }
    takeShared(typeName) {
        return this.take_shared(typeName);
    }

    take_immutable(typeName) {
        const objectStorage = this._masters[this._currentAs].objectStorage; // it's same object for different 'as' connected to the same provider, but we don't care here
        return objectStorage.findMostRecent((object)=>{
                return (object.isImmutable && object.typeName == typeName);
            });
    }
    takeImmutable(typeName) {
        return this.take_immutable(typeName);
    }

    async moveCall(moduleName, methodName, params) {
        if (!this._currentAs) {
            throw new Error('please call moveCall inside .next_tx(as, ()=>{}) wrapper');
        }

        await this._packages[this._currentAs].modules[moduleName].moveCall(methodName, params);
    }

    async initMaster(as) {
        if (this._masters[as]) {
            return true;
        }

        const suiMaster =  new SuiMaster({debug: this._debug, as: as, client: this._client, });

        await suiMaster.initialize();
        await suiMaster.requestSuiFromFaucet();

        const addPackageParams = {};
        if (this._publishedPackageId) {
            // already pulished
            addPackageParams.id = this._publishedPackageId;
        } else {
            // to be build and published
            addPackageParams.path = this._path;
        }
        const addedPackage = suiMaster.addPackage(addPackageParams);
        // addedPackage.addEventListener('added', (data)=>{
        //     const object = data.detail;
        //     if (object && !this._objects[object.address]) { // there may be few same object instances in different suiMaster's.
        //         this._objects[object.address] = object;
        //     }
        // });

        if (!this._publishedPackageId) {
            await addedPackage.publish();
            this._publishedPackageId = addedPackage.id;

            if (!this._publishedPackageId) {
                this.log('can not publish a package');
            }
        } else {
            await addedPackage.isOnChain(); // check modules etc for other user
        }


        this._masters[as] = suiMaster;
        this._packages[as] = addedPackage;
    }

};
