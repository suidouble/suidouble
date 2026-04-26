/**
 * Wrapper over a single Wallet Standard adapter (e.g. Sui Wallet, Martian, Suiet).
 * Abstracts away legacy `signAndExecuteTransactionBlock` vs the current
 * `signAndExecuteTransaction` API, and normalises connection state changes into
 * `'connected'` / `'disconnected'` events on this instance.
 */
export default class SuiInBrowserAdapter extends SuiCommonMethods {
    /**
     * @param {Object} [params]
     * @param {Object} [params.standardAdapter] - raw Wallet Standard adapter from `@wallet-standard/core`
     * @param {?string} [params.name] - display name used when no adapter is attached (e.g. "not installed" placeholder)
     * @param {?string} [params.icon] - data-URI icon used when no adapter is attached
     * @param {Object} [params.downloadUrls] - map of browser name → extension store URL (e.g. `{ chrome: 'https://…' }`)
     * @param {boolean} [params.debug]
     */
    constructor(params?: {
        standardAdapter?: any;
        name?: string | null;
        icon?: string | null;
        downloadUrls?: any;
        debug?: boolean;
    });
    /** @type {?Object} raw Wallet Standard adapter */
    _standardAdapter: any | null;
    /** @type {?string} */
    _name: string | null;
    /** @type {?string} */
    _icon: string | null;
    /** @type {Object.<string, string>} */
    _downloadUrls: {
        [x: string]: string;
    };
    /** @type {?string} */
    _connectedAddress: string | null;
    /** @type {?string} */
    _connectedChain: string | null;
    /** @type {boolean} */
    _isConnected: boolean;
    /**
     * Sign and execute a transaction. Prefers the current `sui:signAndExecuteTransaction`
     * feature; falls back to the legacy `sui:signAndExecuteTransactionBlock` for older wallets.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    signAndExecuteTransaction(params: any): Promise<any>;
    /**
     * Sign and execute a transaction using the legacy `sui:signAndExecuteTransactionBlock` feature.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    signAndExecuteTransactionBlock(params: any): Promise<any>;
    /**
     * Sign a transaction using the current `sui:signTransaction` feature.
     * @param {Object} params
     * @returns {Promise<SignatureWithBytes>}
     */
    signTransaction(params: any): Promise<SignatureWithBytes>;
    /**
     * Sign a transaction. Prefers the current `sui:signTransaction` feature;
     * falls back to the legacy `sui:signTransactionBlock` for older wallets.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    signTransactionBlock(params: any): Promise<any>;
    /**
     * Sign a personal/arbitrary message. Prefers `sui:signPersonalMessage`;
     * falls back to `sui:signMessage` for older wallets.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    signPersonalMessage(params: any): Promise<any>;
    /**
     * Alias for `signPersonalMessage`.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    signMessage(params: any): Promise<any>;
    /**
     * Disconnect from the wallet and refresh connection state.
     * @param {Object} [params]
     * @returns {Promise<*>}
     */
    disconnect(params?: any): Promise<any>;
    /**
     * Return the Chrome Web Store download URL, or null if not configured.
     * @returns {?string}
     */
    getDownloadURL(): string | null;
    /**
     * True when no underlying adapter has been attached (i.e. this is a "not installed" placeholder).
     * @returns {boolean}
     */
    get isDefault(): boolean;
    /** @returns {?string} currently connected Sui address, or null */
    get connectedAddress(): string | null;
    /** @returns {?string} currently connected chain identifier (e.g. `'sui:mainnet'`), or null */
    get connectedChain(): string | null;
    /** @returns {boolean} true if the wallet is connected and an address is available */
    get isConnected(): boolean;
    /**
     * Request connection to the wallet. Errors are swallowed; connection state is refreshed
     * via `connectionUpdated` regardless.
     * @returns {Promise<void>}
     */
    connect(): Promise<void>;
    /**
     * Read the current connection state from the underlying adapter and update
     * `connectedAddress`, `connectedChain`, and `isConnected`. Emits `'connected'` or
     * `'disconnected'` if the state changed.
     */
    connectionUpdated(): void;
    /**
     * Attach a Wallet Standard adapter to this instance. No-op if already attached.
     * Returns false and does nothing if the adapter has no `sui:` features.
     * Subscribes to adapter `'change'` events to keep connection state up to date.
     *
     * @param {Object} standardAdapter - raw adapter from `@wallet-standard/core`
     * @returns {boolean} false if the adapter lacks Sui features, undefined on success
     */
    setStandartAdapter(standardAdapter: any): boolean;
    __standardAdapterChangeListener: () => void;
    /**
     * True if the adapter is installed and supports the minimum required Sui features
     * (`sui:signAndExecuteTransaction` or `sui:signAndExecuteTransactionBlock`, plus `standard:events`).
     * @returns {boolean}
     */
    get okForSui(): boolean;
    /** @returns {boolean} true if a Wallet Standard adapter has been attached */
    get isInstalled(): boolean;
    /**
     * Feature map from the underlying adapter, or an empty object if not installed.
     * Keys are Wallet Standard feature strings (e.g. `'sui:signAndExecuteTransaction'`).
     * @returns {Object}
     */
    get features(): any;
    /**
     * Display name — from the adapter if installed, otherwise from the constructor param.
     * @returns {?string}
     */
    get name(): string | null;
    /**
     * Data-URI icon — from the adapter if installed, otherwise from the constructor param.
     * @returns {?string}
     */
    get icon(): string | null;
    /**
     * Wallet version string from the adapter, or undefined if not installed.
     * @returns {?string}
     */
    get version(): string | null;
    /**
     * Returns true if this adapter supports the given feature.
     * Accepts either a `Feature` enum key (e.g. `'SUI_SIGN_TX'`) or a raw feature string.
     * @param {string} featureName
     * @returns {boolean}
     */
    hasFeature(featureName: string): boolean;
    /**
     * Return the feature object for `featureName`, or null if not available.
     * Accepts either a `Feature` enum key (e.g. `'SUI_SIGN_TX'`) or a raw feature string.
     * @param {string} featureName
     * @returns {?Object}
     */
    getFeature(featureName: string): any | null;
}
export type SignatureWithBytes = import("@mysten/sui/cryptography").SignatureWithBytes;
import SuiCommonMethods from './SuiCommonMethods.js';
