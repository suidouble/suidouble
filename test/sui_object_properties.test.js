'use strict'

import t from 'tap';
import { SuiMaster, SuiLocalTestValidator } from '../index.js';

import { fileURLToPath } from 'url';
import path from 'path';

const { test } = t;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let suiLocalTestValidator = null;
let suiMaster = null;
let contract = null;

test('spawn local test node', async t => {
    suiLocalTestValidator = await SuiLocalTestValidator.launch({ testFallbackEnabled: true });
    t.ok(suiLocalTestValidator.active);
});

test('setup — init, fund, publish', async t => {
    suiMaster = new SuiMaster({ client: suiLocalTestValidator, as: 'somebody', debug: false });
    await suiMaster.initialize();

    await suiMaster.requestSuiFromFaucet();

    contract = suiMaster.addPackage({
        path: path.join(__dirname, './test_move_contracts/suidouble_chat/'),
    });
    await contract.build();
    await contract.publish();
    t.ok(contract.address, 'contract published');
});

test('localProperties — stores arbitrary data without touching the chain', async t => {
    const chatShop = suiMaster.objectStorage.findMostRecentByTypeName('ChatShop');
    t.ok(chatShop, 'ChatShop found in objectStorage');

    // initial state — empty object
    t.type(chatShop.localProperties, 'object', 'localProperties is an object');
    t.notOk(chatShop.localProperties.myKey, 'myKey not set initially');

    // write
    chatShop.localProperties.myKey = 'hello';
    chatShop.localProperties.count  = 42;

    // read back from the same instance
    t.equal(chatShop.localProperties.myKey, 'hello', 'myKey persists on the instance');
    t.equal(chatShop.localProperties.count, 42, 'count persists on the instance');

    // does NOT affect the object on chain — the object's fields are unrelated
    t.notOk(chatShop.fields.myKey, 'myKey is not in on-chain fields');

    // clear
    delete chatShop.localProperties.myKey;
    t.notOk(chatShop.localProperties.myKey, 'myKey removed after delete');
});

test('isImmutable — published package object is immutable', async t => {
    // packages are always frozen / immutable on Sui after publishing
    const packageObj = await suiMaster.getObject(contract.address);
    t.ok(packageObj, 'package object fetched');
    t.ok(packageObj.isImmutable, 'package object isImmutable is true');
    t.notOk(packageObj.isShared, 'package object isShared is false');
});

test('display — fetchFields populates display property', async t => {
    const chatShop = suiMaster.objectStorage.findMostRecentByTypeName('ChatShop');
    t.ok(chatShop, 'ChatShop found');

    await chatShop.fetchFields();

    // display is always an object — {} when no Display template, otherwise keyed values
    t.type(chatShop.display, 'object', 'display is an object after fetchFields');

    // suidouble_chat has no Display template so we expect an empty map —
    // but the field must exist and not throw
    t.doesNotThrow(() => { void chatShop.display; }, 'accessing display does not throw');
});

test('stops local test node', async t => {
    await SuiLocalTestValidator.stop().catch(() => {});
    t.pass('stopped');
});
