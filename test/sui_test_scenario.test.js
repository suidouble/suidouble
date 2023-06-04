'use strict'

const t = require('tap');
const { test } = t;
const path = require('path');

const { SuiTestScenario } = require('..');

let testScenario = null;

test('initialization', async t => {
    testScenario = new SuiTestScenario({
        path: path.join(__dirname, './test_move_contracts/suidouble_chat/'),
        debug: false,
    });

    await testScenario.begin('admin');
    await testScenario.init();

    t.equal(testScenario.currentAs, 'admin');
});

test('checking takeShared', async t => {
	t.plan(4);

    await testScenario.nextTx('admin', async()=>{
        const chatShop = testScenario.takeShared('ChatShop');

        t.ok(chatShop.address); // there should be some address
        t.ok(`${chatShop.address}`.indexOf('0x') === 0); // adress is string starting with '0x'

        await testScenario.moveCall('suidouble_chat', 'post', [chatShop.address, 'posting a message', 'metadata']);
        const chatTopMessage = testScenario.takeShared('ChatTopMessage');

        t.ok(chatTopMessage.address); // there should be some address
        t.ok(`${chatTopMessage.address}`.indexOf('0x') === 0); // adress is string starting with '0x'
    });
});

test('checking takeOwned', async t => {
	t.plan(3);

    await testScenario.nextTx('somebody', async()=>{
        const chatTopMessage = testScenario.takeShared('ChatTopMessage');
        t.ok(chatTopMessage.address); // there should be some address

        await testScenario.moveCall('suidouble_chat', 'reply', [chatTopMessage.address, 'posting a response', 'metadata']);
        const chatResponse = testScenario.takeFromSender('ChatResponse');

        t.ok(chatResponse.address); // there should be some address
        t.ok(`${chatResponse.address}`.indexOf('0x') === 0); // adress is string starting with '0x'
    });
})

test('finishing the test scenario', async t => {
    await testScenario.end();
});
