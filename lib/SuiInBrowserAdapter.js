import SuiCommonMethods from './SuiCommonMethods.js';


/**
 * @typedef {import("@mysten/sui/cryptography").SignatureWithBytes} SignatureWithBytes
 */

/**
 * Wallet Standard feature identifiers — keys map to the string feature names used by the
 * `@wallet-standard/core` registry.
 * @enum {string}
 */
const Feature = {
    DISCONNECT: 'standard:disconnect',
    CONNECT: 'standard:connect',
    EVENTS: 'standard:events',
    SUI_SIGN_AND_EXECUTE_TX_BLOCK: 'sui:signAndExecuteTransactionBlock',
    SUI_SIGN_TX_BLOCK: 'sui:signTransactionBlock',
    SUI_SIGN_AND_EXECUTE_TX: 'sui:signAndExecuteTransaction',
    SUI_SIGN_TX: 'sui:signTransaction',
    SUI_SIGN_MESSAGE: 'sui:signMessage',
    SUI_SIGN_PERSONAL_MESSAGE: 'sui:signPersonalMessage',
};

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
    constructor(params = {}) {
        super(params);

        /** @type {?Object} raw Wallet Standard adapter */
        this._standardAdapter = null;
        if (params.standardAdapter) {
            this.setStandartAdapter(params.standardAdapter);
        }

        /** @type {?string} */
        this._name = params.name || null;
        /** @type {?string} */
        this._icon = params.icon || null;
        /** @type {Object.<string, string>} */
        this._downloadUrls = params.downloadUrls || {};

        /** @type {?string} */
        this._connectedAddress = null;
        /** @type {?string} */
        this._connectedChain = null;
        /** @type {boolean} */
        this._isConnected = false;
        /** @type {boolean} */
        this._userDisconnected = false;
        /** @type {?string} */
        this._preferredChain = null;
    }

    /**
     * Sign and execute a transaction. Prefers the current `sui:signAndExecuteTransaction`
     * feature; falls back to the legacy `sui:signAndExecuteTransactionBlock` for older wallets.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    async signAndExecuteTransaction(params) {
        if (this.hasFeature(Feature.SUI_SIGN_AND_EXECUTE_TX)) {
            return await this.getFeature(Feature.SUI_SIGN_AND_EXECUTE_TX).signAndExecuteTransaction(params);
        } else {
            // outdated wallet?
            params.transactionBlock = params.transaction;
            return await this.getFeature(Feature.SUI_SIGN_AND_EXECUTE_TX_BLOCK).signAndExecuteTransactionBlock(params);
        }
    }

    /**
     * Sign and execute a transaction using the legacy `sui:signAndExecuteTransactionBlock` feature.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    async signAndExecuteTransactionBlock(params) {
        return await this.getFeature(Feature.SUI_SIGN_AND_EXECUTE_TX_BLOCK).signAndExecuteTransactionBlock(params);
    }

    /**
     * Sign a transaction using the current `sui:signTransaction` feature.
     * @param {Object} params
     * @returns {Promise<SignatureWithBytes>}
     */
    async signTransaction(params) {
        /** @type {SignatureWithBytes} */
        const resp = await this.getFeature(Feature.SUI_SIGN_TX).signTransaction(params);
        return resp;
    }

    /**
     * Sign a transaction. Prefers the current `sui:signTransaction` feature;
     * falls back to the legacy `sui:signTransactionBlock` for older wallets.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    async signTransactionBlock(params) {
        if (this.hasFeature(Feature.SUI_SIGN_TX)) {
            return await this.getFeature(Feature.SUI_SIGN_TX).signTransaction(params);
        } else {
            // outdated wallet?
            params.transactionBlock = params.transaction;
            return await this.getFeature(Feature.SUI_SIGN_TX_BLOCK).signTransactionBlock(params);
        }
    }

    /**
     * Sign a personal/arbitrary message. Prefers `sui:signPersonalMessage`;
     * falls back to `sui:signMessage` for older wallets.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    async signPersonalMessage(params) {
        if (this.hasFeature(Feature.SUI_SIGN_PERSONAL_MESSAGE)) {
            return await this.getFeature(Feature.SUI_SIGN_PERSONAL_MESSAGE).signPersonalMessage(params);
        } else {
            return await this.getFeature(Feature.SUI_SIGN_MESSAGE).signMessage(params);
        }
    }

    /**
     * Alias for `signPersonalMessage`.
     * @param {Object} params
     * @returns {Promise<*>}
     */
    async signMessage(params) {
        return await this.signPersonalMessage(params);
    }

    /**
     * Disconnect from the wallet and refresh connection state.
     * Force-clears local connection state even if the wallet doesn't support
     * standard:disconnect or doesn't revoke site authorization (e.g. Phantom).
     * @param {Object} [params]
     * @returns {Promise<void>}
     */
    async disconnect(params) {
        try {
            const feature = this.getFeature(Feature.DISCONNECT);
            if (feature) {
                await feature.disconnect(params);
            }
        } catch (e) {
            console.warn('[SuiInBrowserAdapter] standard:disconnect failed:', e);
        }

        this._connectedAddress = null;
        this._connectedChain = null;
        this._isConnected = false;
        this._userDisconnected = true;
        this.emit('disconnected', this);
    }

    /**
     * Return the Chrome Web Store download URL, or null if not configured.
     * @returns {?string}
     */
    getDownloadURL() {
        if (this._downloadUrls && this._downloadUrls.chrome) {
            return this._downloadUrls.chrome;
        }
        return null;
    }

    /**
     * True when no underlying adapter has been attached (i.e. this is a "not installed" placeholder).
     * @returns {boolean}
     */
    get isDefault() {
        return !this._standardAdapter;
    }

    /** @returns {?string} currently connected Sui address, or null */
    get connectedAddress() {
        return this._connectedAddress;
    }

    /** @returns {?string} currently connected chain identifier (e.g. `'sui:mainnet'`), or null */
    get connectedChain() {
        return this._connectedChain;
    }

    /** @returns {boolean} true if the wallet is connected and an address is available */
    get isConnected() {
        return this._isConnected;
    }

    /**
     * Request connection to the wallet. Errors are swallowed; connection state is refreshed
     * via `connectionUpdated` regardless.
     * @returns {Promise<void>}
     */
    async connect() {
        this._userDisconnected = false;
        try {
            await this.getFeature(Feature.CONNECT).connect();
        } catch (e) {
            console.error(e);
        }

        this.connectionUpdated();
    }

    /**
     * Read the current connection state from the underlying adapter and update
     * `connectedAddress`, `connectedChain`, and `isConnected`. Emits `'connected'` or
     * `'disconnected'` if the state changed.
     */
    connectionUpdated() {
        if (this._userDisconnected) return;

        const wasConnectedAddress = ''+this._connectedAddress;
        const wasConnectedChain = ''+this._connectedChain;

        try {
            if (this._standardAdapter && this._standardAdapter.accounts && this._standardAdapter.accounts.length) {
                this._connectedAddress = this._standardAdapter.accounts[0].address;
                const accountChains = this._standardAdapter.accounts[0].chains;
                const normalize = (c) => c ? c.replace(/^sui:/, '') : c;
                const preferredNorm = normalize(this._preferredChain);
                const match = this._preferredChain && accountChains.find(c => normalize(c) === preferredNorm);
                if (match) {
                    this._connectedChain = match;
                } else {
                    this._connectedChain = accountChains[0];
                }
            } else {
                this._connectedAddress = null;
                this._connectedChain = null;
            }
        } catch (e) {
            this._connectedAddress = null;
            this._connectedChain = null;
        }

        if ((''+this._connectedAddress) != wasConnectedAddress || (''+this._connectedChain) != wasConnectedChain) {
            if (this._connectedAddress && this._connectedChain) {
                this._isConnected = true;
                this.emit('connected', this);
            } else {
                this._isConnected = false;
                this.emit('disconnected', this);
            }
        }
    }

    /**
     * Attach a Wallet Standard adapter to this instance. No-op if already attached.
     * Returns false and does nothing if the adapter has no `sui:` features.
     * Subscribes to adapter `'change'` events to keep connection state up to date.
     *
     * @param {Object} standardAdapter - raw adapter from `@wallet-standard/core`
     * @returns {boolean} false if the adapter lacks Sui features, undefined on success
     */
    setStandartAdapter(standardAdapter) {
        if (this._standardAdapter) {
            // no need to re-attach
            return true;
        }

        // check if it has sui: features
        let hasSuiFeatures = false;
        for (const key in standardAdapter.features) {
            if ((''+key).indexOf('sui:') === 0) {
                hasSuiFeatures = true;
            }
        }

        if (!hasSuiFeatures) {
            return false;
        }

        this._standardAdapter = standardAdapter;
        if (!this.__standardAdapterChangeListener) {
            this.__standardAdapterChangeListener = () => {
                this.connectionUpdated();
            };
        }
        this.getFeature(Feature.EVENTS).on('change', this.__standardAdapterChangeListener);

        this.connectionUpdated();
    }

    /**
     * True if the adapter is installed and supports the minimum required Sui features
     * (`sui:signAndExecuteTransaction` or `sui:signAndExecuteTransactionBlock`, plus `standard:events`).
     * @returns {boolean}
     */
    get okForSui() {
        if (!this.isInstalled) {
            return false;
        }

        return (this.hasFeature(Feature.SUI_SIGN_AND_EXECUTE_TX_BLOCK) || this.hasFeature(Feature.SUI_SIGN_AND_EXECUTE_TX)) && this.hasFeature(Feature.EVENTS);
    }

    /** @returns {boolean} true if a Wallet Standard adapter has been attached */
    get isInstalled() {
        return !!this._standardAdapter;
    }

    /**
     * Feature map from the underlying adapter, or an empty object if not installed.
     * Keys are Wallet Standard feature strings (e.g. `'sui:signAndExecuteTransaction'`).
     * @returns {Object}
     */
    get features() {
        if (this._standardAdapter) {
            return this._standardAdapter.features;
        }
        return {};
    }

    /**
     * Display name — from the adapter if installed, otherwise from the constructor param.
     * @returns {?string}
     */
    get name() {
        if (this._standardAdapter) {
            return this._standardAdapter.name;
        } else {
            return this._name;
        }
    }

    /**
     * Data-URI icon — from the adapter if installed, otherwise from the constructor param.
     * @returns {?string}
     */
    get icon() {
        if (this._standardAdapter) {
            return this._standardAdapter.icon;
        } else {
            return this._icon;
        }
    }

    /**
     * Wallet version string from the adapter, or undefined if not installed.
     * @returns {?string}
     */
    get version() {
        if (this._standardAdapter) {
            return this._standardAdapter.version;
        }
    }

    /**
     * Returns true if this adapter supports the given feature.
     * Accepts either a `Feature` enum key (e.g. `'SUI_SIGN_TX'`) or a raw feature string.
     * @param {string} featureName
     * @returns {boolean}
     */
    hasFeature(featureName) {
        return (!!this.getFeature(featureName));
    }

    /**
     * Return the feature object for `featureName`, or null if not available.
     * Accepts either a `Feature` enum key (e.g. `'SUI_SIGN_TX'`) or a raw feature string.
     * @param {string} featureName
     * @returns {?Object}
     */
    getFeature(featureName) {
        const features = this.features;

        if (features && features[Feature[featureName]]) {
            return features[Feature[featureName]];
        }
        if (features && features[featureName]) {
            return features[featureName];
        }
        return null;
    }
};
