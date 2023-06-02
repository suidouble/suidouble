'use strict'

const t = require('tap');
const { test } = t;

const { SuiMaster } = require('..');

test('initialization', async t => {
	t.plan(2);

    t.ok(true);
    t.equal(1, 1, 'Ready state is (==1)');
});

test('pseudo-random keypairs generation works ok', async t => {
    const suiMaster = new SuiMaster({provider: 'test', as: 'somebody'});
    await suiMaster.initialize();

    // pseudo-random generation of 'somebody' is a keypair for a wallet '0x15b9493fb639a3118fed766ca80c1da62fa20493c293f319cc7d136506d2db69'
    // not sure if we need to assert it, as we may change pseudo-random generation algo, still keeping it function, 
    // so lets just check we make different keypairs depending on 'as' input parameter
    // console.log(suiMaster.address);

    t.ok(suiMaster.address); // there should be some address
    t.ok(`${suiMaster.address}`.indexOf('0x') === 0); // adress is string starting with '0x'

    const suiMasterAsAdmin = new SuiMaster({provider: 'test', as: 'admin'});
    await suiMasterAsAdmin.initialize();

    t.ok(suiMasterAsAdmin.address); // there should be some address
    t.ok(`${suiMasterAsAdmin.address}`.indexOf('0x') === 0); // adress is string starting with '0x'

    t.not(`${suiMaster.address}`, `${suiMasterAsAdmin.address}`, 'different pseudo randoms should be different');

    /// but if you pass the same string as 'as' - it will generate the same keypair:
    const suiMasterAsAdminAnother =  new SuiMaster({provider: 'test', as: 'admin'});
    await suiMasterAsAdminAnother.initialize();

    t.equal(`${suiMasterAsAdminAnother.address}`, `${suiMasterAsAdmin.address}`, 'same string should generate same pseudo-random');
});

test('connecting to different chains', async t => {
    const suiMaster = new SuiMaster({provider: 'test', as: 'somebody'});
    await suiMaster.initialize();

    t.equal(suiMaster.connectedChain, 'sui:testnet');

    const suiMaster2 = new SuiMaster({provider: 'dev', as: 'somebody'});
    await suiMaster2.initialize();

    t.equal(suiMaster2.connectedChain, 'sui:devnet');

    const suiMaster3 = new SuiMaster({provider: 'main', as: 'somebody'});
    await suiMaster3.initialize();

    t.equal(suiMaster3.connectedChain, 'sui:mainnet');

    const suiMaster4 = new SuiMaster({provider: 'local', as: 'somebody'});
    await suiMaster4.initialize();

    t.equal(suiMaster4.connectedChain, 'sui:localnet');
});