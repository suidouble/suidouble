'use strict'

const t = require('tap');
const { test } = t;

const { SuiMaster, SuiLocalTestValidator, TransactionBlock } = require('..');

let suiLocalTestValidator = null;
let suiMaster = null;

test('spawn local test node', async t => {
    suiLocalTestValidator = await SuiLocalTestValidator.launch({ testFallbackEnabled: true });
    t.ok(suiLocalTestValidator.active);

    // SuiLocalTestValidator runs as signle instance. So you can't start it twice with static method
    const suiLocalTestValidatorCopy = await SuiLocalTestValidator.launch();
    t.equal(suiLocalTestValidator, suiLocalTestValidatorCopy);
});

test('init suiMaster and connect it to local test validator', async t => {
    suiMaster = new SuiMaster({provider: 'local', as: 'somebody', debug: true});
    await suiMaster.initialize();

    t.ok(suiMaster.address); // there should be some address
    t.ok(`${suiMaster.address}`.indexOf('0x') === 0); // adress is string starting with '0x'
});

test('type is normalized for SUI', async t => {
    // eveything should be the same:
    const suiCoin1 = suiMaster.suiCoins.get('sui');
    const suiCoin2 = suiMaster.suiCoins.get('SUI');
    const suiCoin3 = suiMaster.suiCoins.get('0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI');
    const suiCoin4 = suiMaster.suiCoins.get('0x2::sui::SUI');
    const suiCoin5 = suiMaster.suiCoins.get('2::sui::SUI');
    const suiCoin6 = suiMaster.suiCoins.get('0000000000000000000000000000000000000000000000000000000000000002::sui::SUI');

    t.ok(suiCoin1.coinType == suiCoin2.coinType);
    t.ok(suiCoin1.coinType == suiCoin3.coinType);
    t.ok(suiCoin1.coinType == suiCoin4.coinType);
    t.ok(suiCoin1.coinType == suiCoin5.coinType);
    t.ok(suiCoin1.coinType == suiCoin6.coinType);

    // moreover, it should be the same instance
    t.ok(Object.keys(suiMaster.suiCoins.coins).length == 1);
});

test('amount normalization works ok', async t => {
    const suiCoin = suiMaster.suiCoins.get('sui');
    t.ok((await suiCoin.lazyNormalizeAmount('1.0')) == suiMaster.MIST_PER_SUI); // lazy - loads metadata to get decimals
    t.ok((await suiCoin.lazyNormalizeAmount(suiMaster.MIST_PER_SUI)) == suiMaster.MIST_PER_SUI); // can pass BigInt
    t.ok((await suiCoin.lazyNormalizeAmount(Number(suiMaster.MIST_PER_SUI))) == suiMaster.MIST_PER_SUI); // can pass Number, it will return BigInt of if
});

test('string representation works ok', async t => {
    const suiCoin = suiMaster.suiCoins.get('sui');
    await suiCoin.getMetadata();

    const toDisplay1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI);
    t.equals(toDisplay1, '1.0');

    const toDisplay2 = suiCoin.amountToString(1); // 1 mist
    t.equals(toDisplay2, '0.000000001');

    const toDisplay3 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) + BigInt(1)); // 1000 SUI + 1 mist
    t.equals(toDisplay3, '1000.000000001');

    const toDisplay4 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) - BigInt(1)); // 1000 SUI - 1 mist
    t.equals(toDisplay4, '999.999999999');
});

test('you have no SUI on the fresh node', async t => {
    const suiCoin = suiMaster.suiCoins.get('sui');
    const balance = await suiCoin.getBalance(suiMaster.address);
    t.ok(balance == BigInt(0));
});

test('have some after requesting from faucet', async t => {
    await suiMaster.requestSuiFromFaucet();

    const suiCoin = suiMaster.suiCoins.get('sui');
    const balance = await suiCoin.getBalance(suiMaster.address);
    t.ok(balance > BigInt(0));
});

test('getting coin objects for a transaction', async t => {
    const suiCoin = suiMaster.suiCoins.get('sui');

    const wasBalance = await suiCoin.getBalance(suiMaster.address);

    const txb = new TransactionBlock();
    const coinInput = await suiCoin.coinOfAmountToTxCoin(txb, suiMaster.address, suiMaster.MIST_PER_SUI); // pick 1 SUI
    txb.transferObjects([coinInput], txb.pure('0x1d20dcdb2bca4f508ea9613994683eb4e76e9c4ed371169677c1be02aaf0b12a')); // send it anywhere

    const result = await suiMaster.signAndExecuteTransactionBlock({
        transactionBlock: txb,
        requestType: 'WaitForLocalExecution',
        options: {
        },
    });

    const nowBalance = await suiCoin.getBalance(suiMaster.address);

    t.ok(nowBalance < wasBalance);  /// would be better to calculate everthing + fees + storage rebate, but let's just assume it works for now.
    // @todo : cover better
});



test('stops local test node', async t => {
    await SuiLocalTestValidator.stop();
});