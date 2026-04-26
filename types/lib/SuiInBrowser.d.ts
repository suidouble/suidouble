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
    static _singleInstances: {};
    /**
     * Returns the singleton SuiInBrowser instance for the given defaultChain, creating it if
     * necessary. Ideal for single-page-app usage where one instance is shared across the app.
     * @param {Object} [params]
     * @param {string} [params.defaultChain]
     * @returns {SuiInBrowser}
     */
    static getSingleton(params?: {
        defaultChain?: string;
    }): SuiInBrowser;
    /**
     * Returns the list of known wallet placeholder params used to pre-populate the adapter
     * registry before the Wallet Standard registry is queried.
     * @returns {Array<{name: string, icon: string, downloadUrls: Object}>}
     */
    static getPossibleWallets(): Array<{
        name: string;
        icon: string;
        downloadUrls: any;
    }>;
    /**
     * @param {Object} [params]
     * @param {string} [params.defaultChain='sui:devnet'] - chain used before any wallet connects
     * @param {boolean} [params.debug]
     */
    constructor(params?: {
        defaultChain?: string;
        debug?: boolean;
    });
    /** @type {Object.<string, SuiInBrowserAdapter>} */
    _adapters: {
        [x: string]: SuiInBrowserAdapter;
    };
    /** @type {string} */
    _defaultChain: string;
    /** @type {?SuiInBrowserAdapter} */
    _activeAdapter: SuiInBrowserAdapter | null;
    /** @type {?string} */
    _connectedAddress: string | null;
    /** @type {?string} */
    _connectedChain: string | null;
    /** @type {boolean} */
    _isConnected: boolean;
    /** @type {boolean} */
    _isConnecting: boolean;
    _client: import("@mysten/sui/grpc").SuiGrpcClient;
    _suiMaster: SuiMaster;
    /** @type {?Object} */
    _rpcSettings: any | null;
    /** @returns {?SuiInBrowserAdapter} The currently active wallet adapter, or null. */
    get activeAdapter(): SuiInBrowserAdapter | null;
    /**
     * Returns the currently connected wallet address, or null if not connected.
     * @returns {?string}
     */
    getAddress(): string | null;
    /**
     * Sign a transaction using the current `sui:signTransaction` feature.
     * @param {Object} params
     * @returns {Promise<SignatureWithBytes>}
     */
    signTransaction(params: any): Promise<SignatureWithBytes>;
    /**
     * Delegates to the active adapter using the legacy transaction-block API.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    signAndExecuteTransactionBlock(params: any): Promise<any>;
    /**
     * Delegates to the active adapter using the current transaction API.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    signAndExecuteTransaction(params: any): Promise<any>;
    /** @returns {*} The gRPC client instance, or null if not yet initialised. */
    get client(): any;
    toSuiAddress(): string;
    /**
     * Ensures the client is initialised, then returns it.
     * @returns {Promise<*>}
     */
    getClient(): Promise<any>;
    /**
     * Ensures the client is initialised, then returns the SuiMaster instance.
     * @returns {Promise<SuiMaster>}
     */
    getSuiMaster(): Promise<SuiMaster>;
    /** @returns {?SuiMaster} The current SuiMaster instance, or null if not yet initialised. */
    get suiMaster(): SuiMaster | null;
    /** @returns {boolean} True if a wallet adapter is currently connected. */
    get isConnected(): boolean;
    /** @returns {?string} The active wallet address, or null if not connected. */
    get connectedAddress(): string | null;
    /** @returns {?string} The chain the active adapter is connected to (e.g. 'sui:mainnet'), or null. */
    get connectedChain(): string | null;
    /** @returns {Object.<string, SuiInBrowserAdapter>} Map of adapter name to SuiInBrowserAdapter. */
    get adapters(): {
        [x: string]: SuiInBrowserAdapter;
    };
    /**
     * Connects to a named adapter or an adapter instance. Returns false if the adapter is not
     * found in the registry.
     * @param {string|SuiInBrowserAdapter} adapterOrAdapterName
     * @returns {Promise<boolean|void>}
     */
    connect(adapterOrAdapterName: string | SuiInBrowserAdapter): Promise<boolean | void>;
    /**
     * Called when an adapter fires its 'connected' event. Updates the active adapter, connected
     * address and chain, rebuilds the gRPC client and SuiMaster, and emits 'connected'.
     * @param {SuiInBrowserAdapter} suiInBrowserAdapter
     */
    adapterConnected(suiInBrowserAdapter: SuiInBrowserAdapter): void;
    /**
     * Switch connection to use custom RPC endpoint
     * @param {Object} params parameters
     * @param {string} params.url rpc url
     * @param {Object} params.rpc rpc settings
     * @param {Object.<string, string>} params.rpc.headers rpc headers
     */
    setRPC(params: {
        url: string;
        rpc: {
            headers: {
                [x: string]: string;
            };
        };
    }): Promise<void>;
    /**
     * Called when an adapter fires its 'disconnected' event. Resets connection state and emits
     * 'disconnected'.
     * @param {SuiInBrowserAdapter} [_suiInBrowserAdapter]
     */
    adapterDisconnected(_suiInBrowserAdapter?: SuiInBrowserAdapter): void;
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
    attachAdapter(adapterParams: {
        name?: string;
        standartAdapter?: any;
        icon?: string;
        downloadUrls?: any;
    }): void | false;
    /**
     * Returns the currently connected chain, or the default chain if no wallet is connected.
     * @returns {string}
     */
    getCurrentChain(): string;
    /**
     * Builds the gRPC client and SuiMaster for the current chain. No-op if already built.
     * Uses _rpcSettings when a custom RPC endpoint has been set via setRPC.
     * @returns {Promise<void>}
     */
    initClient(): Promise<void>;
    /**
     * Seeds the adapter registry from the known-wallets list and the live Wallet Standard
     * registry, then subscribes to future 'register' events for dynamically installed wallets.
     * @returns {Promise<void>}
     */
    initialize(): Promise<void>;
}
export type SuiGrpcClient = import("@mysten/sui/grpc").SuiGrpcClient;
export type SignatureWithBytes = import("@mysten/sui/cryptography").SignatureWithBytes;
import SuiCommonMethods from './SuiCommonMethods.js';
import SuiInBrowserAdapter from './SuiInBrowserAdapter.js';
import SuiMaster from './SuiMaster.js';
