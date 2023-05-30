const SuiCommonMethods = require('./SuiCommonMethods.js');
// const WalletsStandardCore = require('@wallet-standard/core');
// const icons = require('./data/icons.json');

const Feature = {
    DISCONNECT: 'standard:disconnect',
    CONNECT: 'standard:connect',
    EVENTS: 'standard:events',
    SUI_SIGN_AND_EXECUTE_TX_BLOCK: 'sui:signAndExecuteTransactionBlock',
    SUI_SIGN_TX_BLOCK: 'sui:signTransactionBlock',
    SUI_SIGN_MESSAGE: 'sui:signMessage'
};

class SuiInBrowserAdapter extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._standartAdapter = null;
        //  params.standartAdapter || null; // instance returned from '@wallet-standard/core'
        if (params.standartAdapter) {
            this.setStandartAdapter(params.standartAdapter);
        }
        
        this._name = params.name || null;
        this._icon = params.icon || null;
        this._downloadUrls = params.downloadUrls || {};

        this._connectedAddress = null;
        this._connectedChain = null;
        this._isConnected = false;
    }

    getDownloadURL() {
        if (this._downloadUrls && this._downloadUrls.chrome) {
            return this._downloadUrls.chrome;
        }
        return null;
    }

    get isDefault() {
        if (!this._standartAdapter) {
            return true;
        }
        return false;
    }

    get connectedAddress() {
        return this._connectedAddress;
    }

    get connectedChain() {
        return this._connectedChain;
    }

    get isConnected() {
        return this._isConnected;
    }

    async connect() {
        try {
            await this.getFeature(Feature.CONNECT).connect();
        } catch (e) {
            console.error(e);
        }

        this.connectionUpdated();
    }

    connectionUpdated() {
        const wasConnectedAddress = ''+this._connectedAddress;
        const wasConnectedChain = ''+this._connectedChain;

        try {
            if (this._standartAdapter && this._standartAdapter.accounts && this._standartAdapter.accounts.length) {
                this._connectedAddress = this._standartAdapter.accounts[0].address;
                this._connectedChain = this._standartAdapter.accounts[0].chains[0];
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


    setStandartAdapter(standartAdapter) {
        if (this._standartAdapter) {
            // no need to re-attach
            return true;
        }

        this._standartAdapter = standartAdapter;
        if (!this.__standartAdapterChangeListener) {
            this.__standartAdapterChangeListener = (e) => {
                this.connectionUpdated();
            };
        }
        this.getFeature(Feature.EVENTS).on('change', this.__standartAdapterChangeListener);

        this.connectionUpdated();
    }

    async signAndExecuteTransactionBlock(params) {
        return await this.getFeature(Feature.SUI_SIGN_AND_EXECUTE_TX_BLOCK).signAndExecuteTransactionBlock(params);
        // console.log(this.getFeature(Feature.SUI_SIGN_AND_EXECUTE_TX_BLOCK));
    }

    get okForSui() {
        if (!this.isInstalled) {
            return false;
        }

        return this.hasFeature(Feature.SUI_SIGN_AND_EXECUTE_TX_BLOCK) && this.hasFeature(Feature.EVENTS);
    }

    get isInstalled() {
        if (this._standartAdapter) {
            return true;
        }
        return false;
    }

    get features() {
        if (this._standartAdapter) {
            return this._standartAdapter.features;
        }
        return {};
    }

    get name() {
        if (this._standartAdapter) {
            return this._standartAdapter.name;
        } else {
            return this._name;
        }
    }

    get icon() {
        if (this._standartAdapter) {
            return this._standartAdapter.icon;
        } else {
            return this._icon;
        }
    }

    get version() {
        if (this._standartAdapter) {
            return this._standartAdapter.version;
        }
    }

    hasFeature(featureName) {
        return (!!this.getFeature(featureName));
    }

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

module.exports = SuiInBrowserAdapter;