'use strict'

import t from 'tap';
import { SuiMaster, MIST_PER_SUI } from '../index.js';

import { fileURLToPath } from 'url';
import path from 'path';

const { test } = t;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



test('initialization', async t => {
	t.plan(2);

    t.ok(true);
    t.equal(1, 1, 'Ready state is (==1)');
});

test('pseudo-random keypairs generation works ok', async t => {
    const suiMaster = new SuiMaster({client: 'test', as: 'somebody'});
    await suiMaster.initialize();

    // pseudo-random generation of 'somebody' is a keypair for a wallet '0x15b9493fb639a3118fed766ca80c1da62fa20493c293f319cc7d136506d2db69'
    // not sure if we need to assert it, as we may change pseudo-random generation algo, still keeping it function, 
    // so lets just check we make different keypairs depending on 'as' input parameter
    // console.log(suiMaster.address);

    t.ok(suiMaster.address); // there should be some address
    t.ok(`${suiMaster.address}`.indexOf('0x') === 0); // adress is string starting with '0x'

    const suiMasterAsAdmin = new SuiMaster({client: 'test', as: 'admin'});
    await suiMasterAsAdmin.initialize();

    t.ok(suiMasterAsAdmin.address); // there should be some address
    t.ok(`${suiMasterAsAdmin.address}`.indexOf('0x') === 0); // adress is string starting with '0x'

    t.not(`${suiMaster.address}`, `${suiMasterAsAdmin.address}`, 'different pseudo randoms should be different');

    /// but if you pass the same string as 'as' - it will generate the same keypair:
    const suiMasterAsAdminAnother =  new SuiMaster({client: 'test', as: 'admin'});
    await suiMasterAsAdminAnother.initialize();

    t.equal(`${suiMasterAsAdminAnother.address}`, `${suiMasterAsAdmin.address}`, 'same string should generate same pseudo-random');
});

test('keypair generation with privateKey works ok', async t => {
    const privateKey = 'suiprivkey1qpwly9xrfsv50mqug706s40l58klez5q6mpchq4f5ldzktjyr4x7yhj9lf2'; 
    const suiMaster = new SuiMaster({client: 'test', privateKey: privateKey});
    await suiMaster.initialize();

    t.equal(`${suiMaster.address}`, `0x4d07e4a382dcb69288a8a4589e8fc0534378dad76b75565fda0c1e9ada45b7d1`, 'by privateKey generated ok');
});


test('keypair generation with seed phrase works ok', async t => {
    // Ed25519
    const phrase = 'seek weekend run rival noodle dog alone mosquito decide hover aerobic fiction'; // 0x2bfe9c35ca9400c42e24e4b424cbd2dfb51bcb7c2487e1b4694ff53d8ca00262
    const suiMaster = new SuiMaster({client: 'test', phrase: phrase});
    await suiMaster.initialize();

    t.equal(`${suiMaster.address}`, `0x2bfe9c35ca9400c42e24e4b424cbd2dfb51bcb7c2487e1b4694ff53d8ca00262`, 'Ed25519 generated ok');

    const suiMasterNextAccount = new SuiMaster({client: 'test', phrase: phrase, accountIndex: 1}); // default = 0
    await suiMasterNextAccount.initialize();

    t.not(`${suiMaster.address}`, `${suiMasterNextAccount.address}`);

    t.equal(`${suiMasterNextAccount.address}`, `0xa6fb5c51b751e07a3e3b3af1f40f3115004702aad5a96263ff0be9078195f43b`, 'Ed25519 next account generated ok');
});

test('keypair generation with seed phrase works ok with secp256r1', async t => {
    // Ed25519
    const phrase = 'seek weekend run rival noodle dog alone mosquito decide hover aerobic fiction'; // 
    const suiMaster = new SuiMaster({client: 'test', phrase: phrase, keypairAlgo: 'secp256r1'});
    await suiMaster.initialize();

    t.equal(`${suiMaster.address}`, `0x444f18d480b4d776d7679fae88ebb4f274941a81c3d98db430f7bd13f82e287d`, 'secp256r1 generated ok');

    const suiMasterNextAccount = new SuiMaster({client: 'test', phrase: phrase, accountIndex: 1, keypairAlgo: 'secp256r1'}); // default = 0
    await suiMasterNextAccount.initialize();

    t.not(`${suiMaster.address}`, `${suiMasterNextAccount.address}`);

    t.equal(`${suiMasterNextAccount.address}`, `0xae496597c64aa6b1aaa03792c0ba0a725b1212adcb0df85d22c447cd57c21c95`, 'secp256r1 next account generated ok');
});


test('keypair generation with seed phrase works ok with secp256k1', async t => {
    // Ed25519
    const phrase = 'seek weekend run rival noodle dog alone mosquito decide hover aerobic fiction'; // 
    const suiMaster = new SuiMaster({client: 'test', phrase: phrase, keypairAlgo: 'secp256k1'});
    await suiMaster.initialize();

    t.equal(`${suiMaster.address}`, `0x86a5dd3def25cab060af90f438842524894c7901839a954b2e9547ecc0f35ef8`, 'secp256k1 generated ok');

    const suiMasterNextAccount = new SuiMaster({client: 'test', phrase: phrase, accountIndex: 1, keypairAlgo: 'secp256k1'}); // default = 0
    await suiMasterNextAccount.initialize();

    t.not(`${suiMaster.address}`, `${suiMasterNextAccount.address}`);

    t.equal(`${suiMasterNextAccount.address}`, `0xc5390344b0344a3e657176eaf72ca00ecf3ed4ec791640b6fc65a11cb680c53f`, 'secp256k1 next account generated ok');
});

test('SuiMaster has MIST_PER_SUI property available as BigInt', async t => {
    const suiMaster = new SuiMaster({client: 'test', as: 'somebody'});

    t.ok(suiMaster.MIST_PER_SUI);

    t.equal(typeof suiMaster.MIST_PER_SUI, 'bigint');
    t.ok(suiMaster.MIST_PER_SUI > BigInt(0));


    t.equal(suiMaster.MIST_PER_SUI, SuiMaster.MIST_PER_SUI);
    t.equal(suiMaster.MIST_PER_SUI, MIST_PER_SUI); // available as global library export too
});

test('connecting to different chains', async t => {
    const suiMaster = new SuiMaster({client: 'test', as: 'somebody'});
    await suiMaster.initialize();

    t.equal(suiMaster.connectedChain, 'sui:testnet');

    const suiMaster2 = new SuiMaster({client: 'dev', as: 'somebody'});
    await suiMaster2.initialize();

    t.equal(suiMaster2.connectedChain, 'sui:devnet');

    const suiMaster3 = new SuiMaster({client: 'main', as: 'somebody'});
    await suiMaster3.initialize();

    t.equal(suiMaster3.connectedChain, 'sui:mainnet');

    const suiMaster4 = new SuiMaster({client: 'local', as: 'somebody'});
    await suiMaster4.initialize();

    t.equal(suiMaster4.connectedChain, 'sui:localnet');
});
