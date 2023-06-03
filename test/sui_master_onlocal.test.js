'use strict'

const t = require('tap');
const { test } = t;

const { SuiMaster, SuiLocalTestValidator } = require('..');

let suiLocalTestValidator = null;
let suiMaster = null;

test('spawn local test node', async t => {
    suiLocalTestValidator = await SuiLocalTestValidator.launch();
    t.ok(suiLocalTestValidator.active);

    // SuiLocalTestValidator runs as signle instance. So you can't start it twice with static method
    const suiLocalTestValidatorCopy = await SuiLocalTestValidator.launch();
    t.equal(suiLocalTestValidator, suiLocalTestValidatorCopy);
});

test('init suiMaster and connect it to local test validator', async t => {
    suiMaster = new SuiMaster({provider: suiLocalTestValidator, as: 'somebody'});
    await suiMaster.initialize();

    t.ok(suiMaster.address); // there should be some address
    t.ok(`${suiMaster.address}`.indexOf('0x') === 0); // adress is string starting with '0x'
});

test('request sui from faucet', async t => {
    const balanceBefore = await suiMaster.getBalance();
    await suiMaster.requestSuiFromFaucet();

    const balanceAfter = await suiMaster.getBalance();

    t.ok(balanceAfter > balanceBefore);
});

test('stops local test node', async t => {
    SuiLocalTestValidator.stop();
});