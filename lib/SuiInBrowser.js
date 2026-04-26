import SuiCommonMethods from './SuiCommonMethods.js';
import SuiInBrowserAdapter from './SuiInBrowserAdapter.js';
import { getWallets } from '@wallet-standard/core';
import SuiMaster from './SuiMaster.js';
import { toBase64 } from '@mysten/bcs';

import icons from './data/icons.js';

/** 
 * @typedef {import("@mysten/sui/grpc").SuiGrpcClient} SuiGrpcClient 
 * @typedef {import("@mysten/sui/cryptography").SignatureWithBytes} SignatureWithBytes
 */


const DEFAULT_CHAIN = 'sui:devnet';

/**
 * Browser-side entry point for wallet integration. Manages a registry of SuiInBrowserAdapter
 * instances (one per known wallet), tracks the active connection, and creates a SuiMaster
 * pointing at the connected chain.
 *
 * Starts initialising itself 50 ms after construction so callers have time to attach listeners.
 * Use SuiInBrowser.getSingleton({ defaultChain }) for the typical single-page-app pattern.
 *
 * Events emitted:
 *   - 'adapter'      — a new SuiInBrowserAdapter was registered (detail: adapter)
 *   - 'connected'    — the active adapter connected
 *   - 'disconnected' — the active adapter disconnected
 *   - 'rpc'          — the RPC endpoint was changed via setRPC
 */
export default class SuiInBrowser extends SuiCommonMethods {
    /**
     * @param {Object} [params]
     * @param {string} [params.defaultChain='sui:devnet'] - chain used before any wallet connects
     * @param {boolean} [params.debug]
     */
    constructor(params = {}) {
        super(params);

        /** @type {Object.<string, SuiInBrowserAdapter>} */
        this._adapters = {};

        /** @type {string} */
        this._defaultChain = params.defaultChain || DEFAULT_CHAIN;

        /** @type {?SuiInBrowserAdapter} */
        this._activeAdapter = null;
        /** @type {?string} */
        this._connectedAddress = null;
        /** @type {?string} */
        this._connectedChain = null;
        /** @type {boolean} */
        this._isConnected = false;
        /** @type {boolean} */
        this._isConnecting = false;

        this._client = null;
        this._suiMaster = null;

        /** @type {?Object} */
        this._rpcSettings = null;

        setTimeout(()=>{
            this.initialize();
        }, 50);
    }

    /** @returns {?SuiInBrowserAdapter} The currently active wallet adapter, or null. */
    get activeAdapter() {
        return this._activeAdapter;
    }

    /**
     * Returns the currently connected wallet address, or null if not connected.
     * @returns {?string}
     */
    getAddress() {
        return this._connectedAddress;
    }

    /**
     * Sign a transaction using the current `sui:signTransaction` feature.
     * @param {Object} params
     * @returns {Promise<SignatureWithBytes>}
     */
    async signTransaction(params) {
        const enriched = { account: { address: this._connectedAddress }, chain: this._connectedChain, ...params };
        return await this._activeAdapter.signTransaction(enriched);
    }

    /**
     * Delegates to the active adapter using the legacy transaction-block API.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    async signAndExecuteTransactionBlock(params) {
        return await this._activeAdapter.signAndExecuteTransactionBlock(params);
    }

    /**
     * Delegates to the active adapter using the current transaction API.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    async signAndExecuteTransaction(params) {
        const enriched = { account: { address: this._connectedAddress }, chain: this._connectedChain, ...params };
        return await this._activeAdapter.signAndExecuteTransaction(enriched);
    }

    /** @returns {*} The gRPC client instance, or null if not yet initialised. */
    get client() {
        return this._client;
    }

    toSuiAddress() {
        return this._connectedAddress;
    }

    /**
     * Ensures the client is initialised, then returns it.
     * @returns {Promise<*>}
     */
    async getClient() {
        await this.initClient();
        return this._client;
    }

    /**
     * Ensures the client is initialised, then returns the SuiMaster instance.
     * @returns {Promise<SuiMaster>}
     */
    async getSuiMaster() {
        await this.initClient();
        return this._suiMaster;
    }

    /** @returns {?SuiMaster} The current SuiMaster instance, or null if not yet initialised. */
    get suiMaster() {
        return this._suiMaster;
    }

    /** @returns {boolean} True if a wallet adapter is currently connected. */
    get isConnected() {
        return this._isConnected;
    }

    /** @returns {?string} The active wallet address, or null if not connected. */
    get connectedAddress() {
        return this._connectedAddress;
    }

    /** @returns {?string} The chain the active adapter is connected to (e.g. 'sui:mainnet'), or null. */
    get connectedChain() {
        return this._connectedChain;
    }

    static _singleInstances = {};
    /**
     * Returns the singleton SuiInBrowser instance for the given defaultChain, creating it if
     * necessary. Ideal for single-page-app usage where one instance is shared across the app.
     * @param {Object} [params]
     * @param {string} [params.defaultChain]
     * @returns {SuiInBrowser}
     */
    static getSingleton(params = {}) {
        let defaultChainKey = params.defaultChain || DEFAULT_CHAIN;

        if (SuiInBrowser._singleInstances[defaultChainKey]) {
            return SuiInBrowser._singleInstances[defaultChainKey];
        }

        SuiInBrowser._singleInstances[defaultChainKey] = new SuiInBrowser(params);
        return SuiInBrowser._singleInstances[defaultChainKey];
    }

    /** @returns {Object.<string, SuiInBrowserAdapter>} Map of adapter name to SuiInBrowserAdapter. */
    get adapters() {
        return this._adapters;
    }

    /**
     * Connects to a named adapter or an adapter instance. Returns false if the adapter is not
     * found in the registry.
     * @param {string|SuiInBrowserAdapter} adapterOrAdapterName
     * @returns {Promise<boolean|void>}
     */
    async connect(adapterOrAdapterName) {
        const a = /** @type {any} */ (adapterOrAdapterName);
        const adapterName = a.name ?? a;

        if (!this._adapters[adapterName]) {
            return false;
        }
        this._activeAdapter = this._adapters[adapterName];

        this._isConnecting = true;
        try {
            await this._activeAdapter.connect();
        } catch (e) {
            this.log('error', e);
        }
        this._isConnecting = false;
    }

    /**
     * Called when an adapter fires its 'connected' event. Updates the active adapter, connected
     * address and chain, rebuilds the gRPC client and SuiMaster, and emits 'connected'.
     * @param {SuiInBrowserAdapter} suiInBrowserAdapter
     */
    adapterConnected(suiInBrowserAdapter) {
        this._activeAdapter = suiInBrowserAdapter;
        this._isConnected = suiInBrowserAdapter.isConnected;
        this._connectedAddress = suiInBrowserAdapter.connectedAddress;
        this._connectedChain = suiInBrowserAdapter.connectedChain;

        if (this._connectedChain == 'sui:unknown') {
            this._connectedChain = 'sui:mainnet'; // custom RPC in Sui Wallet
        }

        this._client = null;
        this._suiMaster = null;

        this.initClient().then(() => {
            this.emit('connected');
        });
    }

    /**
     * Switch connection to use custom RPC endpoint
     * @param {Object} params parameters
     * @param {string} params.url rpc url
     * @param {Object} params.rpc rpc settings
     * @param {Object.<string, string>} params.rpc.headers rpc headers
     */
    async setRPC(params) {
        this._rpcSettings = params;
        this._client = null;
        this._suiMaster = null;

        await this.initClient();

        this.emit('rpc');
    }

    /**
     * Called when an adapter fires its 'disconnected' event. Resets connection state and emits
     * 'disconnected'.
     * @param {SuiInBrowserAdapter} [_suiInBrowserAdapter]
     */
    adapterDisconnected(_suiInBrowserAdapter) {
        this._isConnected = false;
        this._connectedAddress = null;

        this.emit('disconnected');
    }

    /**
     * Registers a wallet adapter in the registry. If the adapter is new, creates a
     * SuiInBrowserAdapter instance, wires up its events, and emits 'adapter'. If the adapter
     * already exists and a standartAdapter is provided, updates it instead.
     * @param {Object} adapterParams
     * @param {string} [adapterParams.name]
     * @param {Object} [adapterParams.standartAdapter]
     * @param {string} [adapterParams.icon]
     * @param {Object} [adapterParams.downloadUrls]
     * @returns {void|false}
     */
    attachAdapter(adapterParams) {
        let adapterName = adapterParams.name;
        if (adapterParams.standartAdapter && adapterParams.standartAdapter.name) {
            adapterName = adapterParams.standartAdapter.name;
        }

        if (!adapterName) {
            return false;
        }

        const adapter = new SuiInBrowserAdapter({
            ...adapterParams,
            debug: this._debug,
        });
        if (this._adapters[adapterName]) {
            // already attached
            if (adapterParams.standartAdapter) {
                this._adapters[adapterName].setStandartAdapter(adapterParams.standartAdapter);
            }
        } else {
            this._adapters[adapterName] = adapter;
            this._adapters[adapterName].addEventListener('connected', (e)=>{
                this.adapterConnected(/** @type {any} */ (e).detail);
            });
            this._adapters[adapterName].addEventListener('disconnected', (e)=>{
                this.adapterDisconnected(/** @type {any} */ (e).detail);
            });
            this.emit('adapter', adapter);
        }
    }

    /**
     * Returns the currently connected chain, or the default chain if no wallet is connected.
     * @returns {string}
     */
    getCurrentChain() {
        return this._connectedChain ? this._connectedChain : this._defaultChain;
    }

    /**
     * Builds the gRPC client and SuiMaster for the current chain. No-op if already built.
     * Uses _rpcSettings when a custom RPC endpoint has been set via setRPC.
     * @returns {Promise<void>}
     */
    async initClient() {
        if (this._client) {
            return;
        }

        let chainName = this.getCurrentChain();

        if (this._rpcSettings) {
            this._rpcSettings.providerName = chainName.split('sui:').join('');
            this._client = SuiMaster.SuiUtils.suiClientForRPC(this._rpcSettings.providerName ?? chainName, this._rpcSettings);
        } else if (!chainName) {
            this.log('error', 'invalid chain', chainName);
            throw new Error('invalid chain: '+chainName);
        } else {
            this._client = SuiMaster.SuiUtils.suiClientFor(chainName);
        }

        this._suiMaster = new SuiMaster({
            debug: this._debug,
            signer: this,
            client: this._client,
        });
    }

    /**
     * Seeds the adapter registry from the known-wallets list and the live Wallet Standard
     * registry, then subscribes to future 'register' events for dynamically installed wallets.
     * @returns {Promise<void>}
     */
    async initialize() {
        await this.initClient(); // set default client

        // create empty adapters (we need instances even if they are not installed)
        for (const possibleAdapterParams of SuiInBrowser.getPossibleWallets()) {
            this.attachAdapter(possibleAdapterParams);
        }

        const walletsCore = getWallets();
        const standartAdapters = walletsCore.get();
        
        for (const standartAdapter of standartAdapters) {
            this.attachAdapter({
                standartAdapter: standartAdapter,
            });
        }
        walletsCore.on('register', (what)=>{
            const adapterName = what.name;
            if (adapterName) {
                this.attachAdapter({
                    standartAdapter: what,
                });
            }
        });
    }

    /**
     * Returns the list of known wallet placeholder params used to pre-populate the adapter
     * registry before the Wallet Standard registry is queried.
     * @returns {Array<{name: string, icon: string, downloadUrls: Object}>}
     */
    static getPossibleWallets() {
        return [
            {
                name: 'Slush',
                icon: icons['SLUSH'],
                downloadUrls: {
                    chrome: 'https://chromewebstore.google.com/detail/slush-%E2%80%94-a-sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil',
                },
            },
            // {
            //     name: 'Sui Wallet',
            //     icon: icons['SUI'],
            //     downloadUrls: {
            //         chrome: 'https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil',
            //     },
            // },
            {
                name: 'Suiet',
                icon: icons['SUIET'],
                downloadUrls: {
                    chrome: 'https://chrome.google.com/webstore/detail/suiet-sui-wallet/khpkpbbcccdmmclmpigdgddabeilkdpd',
                },
            },
            {
                name: 'OKX Wallet',
                icon: icons['OKX'],
                downloadUrls: {
                    chrome: 'https://chromewebstore.google.com/detail/mcohilncbfahbmgdjkbpemcciiolgcge',
                },
            },
            {
                name: 'Phantom',
                icon: icons['PHANTOM'],
                downloadUrls: {
                    chrome: 'https://chromewebstore.google.com/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa',
                },
            },
            {
                name: 'Surf Wallet',
                icon: icons['SURF'],
                downloadUrls: {
                    chrome: 'https://chrome.google.com/webstore/detail/surf-wallet/emeeapjkbcbpbpgaagfchmcgglmebnen',
                },
            },
            {
                name: 'Nightly Wallet',
                icon: icons['NIGHTLY'],
                downloadUrls: {
                    chrome: 'https://chrome.google.com/webstore/detail/nightly/fiikommddbeccaoicoejoniammnalkfa',
                },
            },
        ];
    }
};
