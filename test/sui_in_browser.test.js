'use strict'

// just a basic test of InBrowser classes. No real interaction, just structure and events

import t from 'tap';
import { SuiInBrowser } from '../index.js';

import { fileURLToPath } from 'url';
import path from 'path';

const { test } = t;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


test('as single instance', async t => {
    // probably you'd want a single instance of SuiInBrowser class on your dapp,
    // so initialize it via class' static method:
    const suiInBrowser = SuiInBrowser.getSingleton();
    const suiInBrowserCopy = SuiInBrowser.getSingleton();

    t.equal(suiInBrowser, suiInBrowserCopy);
});

test('initialization', async t => {
    const suiInBrowser = new SuiInBrowser({});

    t.ok(suiInBrowser);

    const gotAdapters = [];
    // it should emit 'adapter' events, even though they are not installed (remember, we are in node.js now)
    // adapter has propery of .isInstalled
    suiInBrowser.addEventListener('adapter', (e)=>{
        gotAdapters.push(e.detail);
    });

    // emit is not instant, but on *nextTick*
    await new Promise((res)=>setTimeout(res, 100));

    t.ok(gotAdapters.length > 0);

    const suietWalletAdapter = gotAdapters.find((adapter)=>(adapter.name == 'Suiet')); // there're few, but lets test one

    t.ok(suietWalletAdapter);

    t.equal(suietWalletAdapter.name, 'Suiet');
    t.ok(!suietWalletAdapter.isInstalled);
    t.ok(suietWalletAdapter.icon);
    t.ok(suietWalletAdapter.icon.indexOf('data:image/') != -1); // icon is data-url

    t.ok(suietWalletAdapter.getDownloadURL()); // url to install extension
    t.ok(suietWalletAdapter.getDownloadURL().indexOf('https://') != -1);

    // we can get instance of suiMaster out of suiInBrowser even if we are not connected to wallet
    // it will work without signer, but you can read data from chain
    const suiMaster = await suiInBrowser.getSuiMaster();

    t.ok(suiMaster);
    t.ok(!suiMaster.connectedAddress); // nothing
    t.ok(suiMaster.connectedChain);     // but there's chain

    // by default, SuiInBrowser gets you devnet connection (it's overloaded by Wallet Extension current chain)
    t.equal(suiMaster.connectedChain, 'sui:devnet'); 

});

test('initialization via mainnet', async t => {
    const suiInBrowser = new SuiInBrowser({defaultChain: 'sui:mainnet'});
    const suiMaster = await suiInBrowser.getSuiMaster();
    t.equal(suiMaster.connectedChain, 'sui:mainnet'); 
});