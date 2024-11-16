'use strict'

import t from 'tap';
import { SuiMaster, SuiLocalTestValidator, Transaction } from '../index.js';
const { test } = t;

let suiLocalTestValidator = null;

/** @type {SuiMaster} */
let suiMaster = null;

test('spawn local test node', async t => {
    suiLocalTestValidator = await SuiLocalTestValidator.launch({ testFallbackEnabled: true, debug: true, });
    t.ok(suiLocalTestValidator.active);

    // SuiLocalTestValidator runs as signle instance. So you can't start it twice with static method
    const suiLocalTestValidatorCopy = await SuiLocalTestValidator.launch();
    t.equal(suiLocalTestValidator, suiLocalTestValidatorCopy);
});

test('init suiMaster and connect it to local test validator', async t => {
    suiMaster = new SuiMaster({client: 'local', as: 'somebody', debug: true});
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
    t.equal(toDisplay1, '1.0');

    const toDisplay2 = suiCoin.amountToString(1); // 1 mist
    t.equal(toDisplay2, '0.000000001');

    const toDisplay1000 = suiCoin.amountToString(1000); // 1000 mist
    t.equal(toDisplay1000, '0.000001');

    const toDisplay3 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) + BigInt(1)); // 1000 SUI + 1 mist
    t.equal(toDisplay3, '1000.000000001');

    const toDisplay4 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) - BigInt(1)); // 1000 SUI - 1 mist
    t.equal(toDisplay4, '999.999999999');
});


test('string representation (withAbbr) works ok', async t => {
    const suiCoin = suiMaster.suiCoins.get('sui');
    await suiCoin.getMetadata();

    // it should dispaly the same on the low amounts:

    const toDisplay1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI, {withAbbr: true});
    t.equal(toDisplay1, '1.0');

    const toDisplay2 = suiCoin.amountToString(1, {withAbbr: true}); // 1 mist
    t.equal(toDisplay2, '0.000000001');

    const toDisplay1000 = suiCoin.amountToString(1000, {withAbbr: true}); // 1000 mist
    t.equal(toDisplay1000, '0.000001');

    const toDisplay3 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) + BigInt(1), {withAbbr: true}); // 1000 SUI + 1 mist
    t.equal(toDisplay3, '1000.000000001');

    const toDisplay4 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) - BigInt(1), {withAbbr: true}); // 1000 SUI - 1 mist
    t.equal(toDisplay4, '999.999999999');

    // things are getting interesting starting from '1001.0'

    const toDisplayK1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1001) + BigInt(1), {withAbbr: true}); // 1000 SUI + 1 mist
    t.equal(toDisplayK1, '1.001K');
    const toDisplayK2 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(2000), {withAbbr: true}); 
    t.equal(toDisplayK2, '2.000K');
    const toDisplayK3 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(999900), {withAbbr: true}); 
    t.equal(toDisplayK3, '999.900K');

    const toDisplayM1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000000) + BigInt(1), {withAbbr: true}); // 1000 SUI + 1 mist
    t.equal(toDisplayM1, '1.000M');
    const toDisplayM2 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(2000000) + BigInt(900), {withAbbr: true}); // 1000 SUI + 1 mist
    t.equal(toDisplayM2, '2.000M');

    const toDisplayB1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000000000) + BigInt(1), {withAbbr: true}); // 1000 SUI + 1 mist
    t.equal(toDisplayB1, '1.000B');

    const toDisplayT1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000000000000) + BigInt(1), {withAbbr: true}); // 1000 SUI + 1 mist
    t.equal(toDisplayT1, '1.000T');
});


test('string representation (separateThousands) works ok', async t => {
    const suiCoin = suiMaster.suiCoins.get('sui');
    await suiCoin.getMetadata();

    // it should dispaly the same on the low amounts:

    const toDisplay1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI, {separateThousands: true});
    t.equal(toDisplay1, '1.0');

    const toDisplay2 = suiCoin.amountToString(1, {separateThousands: true}); // 1 mist
    t.equal(toDisplay2, '0.000000001');

    const toDisplay1000 = suiCoin.amountToString(1000, {separateThousands: true}); // 1000 mist
    t.equal(toDisplay1000, '0.000001');

    const toDisplay3 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) + BigInt(1), {separateThousands: true}); // 1000 SUI + 1 mist
    t.equal(toDisplay3, '1,000.000000001');

    const toDisplay4 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000) - BigInt(1), {separateThousands: true}); // 1000 SUI - 1 mist
    t.equal(toDisplay4, '999.999999999');

    // things are getting interesting starting from '1001.0'

    const toDisplayK1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1001) + BigInt(1), {separateThousands: true});
    t.equal(toDisplayK1, '1,001.000000001');
    const toDisplayK2 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(2000), {separateThousands: true}); 
    t.equal(toDisplayK2, '2,000.0');
    const toDisplayK3 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(999900), {separateThousands: true}); 
    t.equal(toDisplayK3, '999,900.0');

    const toDisplayM1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000000) + BigInt(1), {separateThousands: true});
    t.equal(toDisplayM1, '1,000,000.000000001');
    const toDisplayM2 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(2000000) + BigInt(900), {separateThousands: true}); 
    t.equal(toDisplayM2, '2,000,000.0000009');

    const toDisplayB1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000000000) + BigInt(1), {separateThousands: true}); 
    t.equal(toDisplayB1, '1,000,000,000.000000001');

    const toDisplayT1 = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000000000000) + BigInt(1), {separateThousands: true}); 
    t.equal(toDisplayT1, '1,000,000,000,000.000000001');

    const toDisplayT1q = suiCoin.amountToString(suiMaster.MIST_PER_SUI * BigInt(1000000000000) + BigInt(1), {separateThousands: ' '}); 
    t.equal(toDisplayT1q, '1 000 000 000 000.000000001');
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

test('have some in balance query', async t => {
    const balances = await suiMaster.suiCoins.getAllBalances();

    let ok = false;
    for (const balance of balances) {
        if (balance.coin.isSUI()) {
            if (balance.totalBalance > 0n) {
                ok = true;
            }
        }
    }

    t.ok(ok);
});


test('getting coin objects for a transaction', async t => {
    const suiCoin = suiMaster.suiCoins.get('sui');

    const wasBalance = await suiCoin.getBalance(suiMaster.address);

    const tx = new Transaction();
    const coinInput = await suiCoin.coinOfAmountToTxCoin(tx, suiMaster.address, suiMaster.MIST_PER_SUI); // pick 1 SUI
    tx.transferObjects([coinInput], '0x1d20dcdb2bca4f508ea9613994683eb4e76e9c4ed371169677c1be02aaf0b12a'); // send it anywhere

    const result = await suiMaster.signAndExecuteTransaction({
        transaction: tx,
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