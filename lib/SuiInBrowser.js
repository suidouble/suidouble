import SuiCommonMethods from './SuiCommonMethods.js';
import SuiInBrowserAdapter from './SuiInBrowserAdapter.js';
import { getWallets } from '@wallet-standard/core';
import { SuiClient } from '@mysten/sui/client';
import SuiMaster from './SuiMaster.js';

import icons from './data/icons.js';

const DEFAULT_CHAIN = 'sui:devnet';

export default class SuiInBrowser extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._adapters = {};

        this._defaultChain = params.defaultChain || DEFAULT_CHAIN;

        this._activeAdapter = null;
        this._connectedAddress = null;
        this._connectedChain = null;
        this._isConnected = false;
        this._isConnecting = false;

        this._client = null;
        this._suiMaster = null;

        this._rpcSettings = null;

        setTimeout(()=>{
            this.initialize();
        }, 50);
    }

    get activeAdapter() {
        return this._activeAdapter;
    }

    getAddress() {
        return this._connectedAddress;
    }

    async signAndExecuteTransactionBlock(params) {
        return await this._activeAdapter.signAndExecuteTransactionBlock(params);
    }

    async signAndExecuteTransaction(params) {
        return await this._activeAdapter.signAndExecuteTransaction(params);
    }

    get client() {
        return this._client;
    }

    async getClient() {
        await this.initClient();
        return this._client;
    }

    async getSuiMaster() {
        await this.initClient();
        return this._suiMaster;
    }

    get suiMaster() {
        return this._suiMaster;
    }

    get isConnected() {
        return this._isConnected;
    }

    get connectedAddress() {
        return this._connectedAddress;
    }

    get connectedChain() {
        return this._connectedChain;
    }

    static _singleInstances = {};
    static getSingleton(params = {}) {
        let defaultChainKey = params.defaultChain || DEFAULT_CHAIN;

        if (SuiInBrowser._singleInstances[defaultChainKey]) {
            return SuiInBrowser._singleInstances[defaultChainKey];
        }

        SuiInBrowser._singleInstances[defaultChainKey] = new SuiInBrowser(params);
        return SuiInBrowser._singleInstances[defaultChainKey];
    }

    get adapters() {
        return this._adapters;
    }

    async connect(adapterOrAdapterName) {
        let adapterName = adapterOrAdapterName;
        if (adapterOrAdapterName.name) {
            adapterName = adapterOrAdapterName.name;
        }

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

    adapterConnected(suiInBrowserAdapter) {
        this._activeAdapter = suiInBrowserAdapter;
        this._isConnected = suiInBrowserAdapter.isConnected;
        this._connectedAddress = suiInBrowserAdapter.connectedAddress;
        const wasConnectedToChain = this._connectedChain;
        this._connectedChain = suiInBrowserAdapter.connectedChain;

        if (this._connectedChain == 'sui:unknown') {
            this._connectedChain = 'sui:mainnet'; // custom RPC in Sui Wallet
        }

        this._client = null;
        this._suiMaster = null;

        this.initClient();

        this.emit('connected');
    }

    /**
     * Switch connection to use custom RPC endpoint
     * @param {Object} params parameters
     * @param {string} params.url rpc url
     * @param {Object} params.rpc rpc settings
     * @param {Object.<string, string>} params.rpc.headers rpc headers
     */
    async setRPC(params = {}) {
        this._rpcSettings = params;
        this._client = null;
        this._suiMaster = null;

        await this.initClient();

        this.emit('rpc');
    }

    adapterDisconnected(suiInBrowserAdapter) {
        this._isConnected = false;
        this._connectedAddress = null;

        this.emit('disconnected');
    }

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
                this.adapterConnected(e.detail);
            });
            this._adapters[adapterName].addEventListener('disconnected', (e)=>{
                this.adapterDisconnected(e.detail);
            });
            this.emit('adapter', adapter);
        }
    }

    getCurrentChain() {
        return this._connectedChain ? this._connectedChain : this._defaultChain;
    }

    async initClient() {
        if (this._client) {
            return true;
        }

        let chainName = this.getCurrentChain();
        const chainSettings = SuiInBrowser.getChainsSettings();
        // https://github.com/MystenLabs/sui/blob/827f1138a09190975172ec99389751ca95cce5df/sdk/typescript/src/rpc/connection.ts#L32

        if (this._rpcSettings) {
            this._rpcSettings.providerName = chainName.split('sui:').join('');
            this._client = SuiMaster.SuiUtils.suiClientForRPC(this._rpcSettings);
        } else if (!chainSettings[chainName]) {
            this.log('error', 'invalid chain', chainName);
            throw new Error('invalid chain: '+chainName);
        } else {
            this._client = new SuiClient({url: chainSettings[chainName].fullnode});
            this._client.endpoint = chainSettings[chainName].fullnode;
        }

        this._suiMaster = new SuiMaster({
            debug: this._debug,
            signer: this,
            client: this._client,
        });
    }

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

    static getChainsSettings() {
        return {
            'sui:devnet': {
                fullnode: 'https://fullnode.devnet.sui.io:443/',
                websocket: 'https://fullnode.devnet.sui.io:443/',
                faucet: 'https://faucet.devnet.sui.io/gas',
            },
            'sui:testnet': {
                fullnode: 'https://fullnode.testnet.sui.io:443/',
                websocket: 'https://fullnode.testnet.sui.io:443/',
                faucet: 'https://faucet.testnet.sui.io/gas',
            },
            'sui:mainnet': {
                fullnode: 'https://fullnode.mainnet.sui.io:443/',
                websocket: 'https://fullnode.mainnet.sui.io:443/',
            },
            'sui:localnet': {
                websocket: 'http://127.0.0.1:9000',
                fullnode: 'http://127.0.0.1:9000',
                websocket: 'http://127.0.0.1:9000',
                faucet: 'http://127.0.0.1:9123/gas',
            },
        };
    }

    static getPossibleWallets() {
        return [
            {
                name: 'Sui Wallet',
                icon: icons['SUI'],
                downloadUrls: {
                    chrome: 'https://chrome.google.com/webstore/detail/sui-wallet/opcgpfmipidbgpenhmajoajpbobppdil',
                },
            },
            {
                name: 'Suiet',
                icon: icons['SUIET'],
                downloadUrls: {
                    chrome: 'https://chrome.google.com/webstore/detail/suiet-sui-wallet/khpkpbbcccdmmclmpigdgddabeilkdpd',
                },
            },
            {
                name: 'GlassWallet',
                icon: icons['GLASS'],
                downloadUrls: {
                    chrome: 'https://chrome.google.com/webstore/detail/glass-wallet-sui-wallet/loinekcabhlmhjjbocijdoimmejangoa',
                },
            },
            {
                name: 'Ethos Wallet',
                icon: icons['ETHOS'],
                downloadUrls: {
                    chrome: 'https://chrome.google.com/webstore/detail/ethos-sui-wallet/mcbigmjiafegjnnogedioegffbooigli',
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
