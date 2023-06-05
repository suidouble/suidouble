'use strict'

// just a basic test of InBrowser classes. No real interaction, just structure and events

const t = require('tap');
const { test } = t;

const { SuiInBrowser } = require('..');

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

    const suiWalletAdapter = gotAdapters.find((adapter)=>(adapter.name == 'Sui Wallet')); // there're few, but lets test one

    t.ok(suiWalletAdapter);

    t.equal(suiWalletAdapter.name, 'Sui Wallet');
    t.ok(!suiWalletAdapter.isInstalled);
    t.ok(suiWalletAdapter.icon);
    t.ok(suiWalletAdapter.icon.indexOf('data:image/') != -1); // icon is data-url

    t.ok(suiWalletAdapter.getDownloadURL()); // url to install extension
    t.ok(suiWalletAdapter.getDownloadURL().indexOf('https://') != -1);

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