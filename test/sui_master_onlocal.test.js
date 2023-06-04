'use strict'

const t = require('tap');
const { test } = t;
const path = require('path');

const { SuiMaster, SuiLocalTestValidator } = require('..');

let suiLocalTestValidator = null;
let suiMaster = null;
let contract = null;

let contractAddressV1 = null;
let contractAddressV2 = null;

let chatShopObjectId = null;

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

test('attach a local package', async t => {
    contract = suiMaster.addPackage({
        path: path.join(__dirname, './test_move_contracts/suidouble_chat/'),
    });
    // there's nothing in contract yet, it's not built, not published (don't know it's id on chain)
    //
    // we can check that contract's objectStorage is the same instance as on master. Reminder, it's shared between all connections to same chain
    t.equal(contract.objectStorage, suiMaster.objectStorage);

    // lets try to build it
    await contract.build();

    t.ok(contract.isBuilt);

    // and publish

    await contract.publish();

    t.ok(contract.address); // there should be some address
    t.ok(contract.id); // same as id
    t.ok(`${contract.address}`.indexOf('0x') === 0); // adress is string starting with '0x'

    t.equal(contract.version, 1);

    // there should be module 'suidouble_chat' on the contract we published
    t.ok(contract.modules.suidouble_chat);

    // we can check that contract's objectStorage is the same instance as on master. Reminder, it's shared between all connections to same chain
    t.equal(contract.modules.suidouble_chat.objectStorage, suiMaster.objectStorage);

    contractAddressV1 = contract.address;

    // we'd need to .build() again after changes here. But it lets you upgrade package with very same code
    await contract.upgrade();

    t.not(contract.address, contractAddressV1);
    t.equal(contract.version, 2);

    contractAddressV2 = contract.address;

    // let's quickly check it worked, there should be event ChatShopCreated created and we can fetch it from contract's module
    const eventsResponse = await contract.modules.suidouble_chat.fetchEvents();
    // response is an instance of SuiPaginatedResponse
    let foundChatShopCreatedEvent = false;
    for (const event of eventsResponse.data) {
        if (event.typeName === 'ChatShopCreated') {
            foundChatShopCreatedEvent = true;
        }
    }

    t.ok(foundChatShopCreatedEvent);
});

test('attach a package by address on the blockchain', async t => {
    suiMaster = new SuiMaster({provider: suiLocalTestValidator, as: 'somebody'});
    await suiMaster.initialize();

    contract = await suiMaster.addPackage({
        id: contractAddressV2,
    });
    const eventsResponse = await contract.fetchEvents('suidouble_chat');

    let foundChatShopCreatedEvent = false;
    for (const event of eventsResponse.data) {
        if (event.typeName === 'ChatShopCreated') {
            foundChatShopCreatedEvent = true;
            chatShopObjectId = event.parsedJson.id;
        }
    }

    // there should be ChatShopCreated event
    t.ok(foundChatShopCreatedEvent);

    // it should have id of ChatShop object
    t.ok(chatShopObjectId);

    // there should be module 'suidouble_chat' on the contract
    t.ok(contract.modules.suidouble_chat);
});

test('can find a package on the blockchain by expected module name (in owned)', async t => {
    suiMaster = new SuiMaster({provider: suiLocalTestValidator, as: 'somebody'});
    await suiMaster.initialize();

    contract = await suiMaster.addPackage({
        modules: ['suidouble_chat'],
    });
    const eventsResponse = await contract.fetchEvents('suidouble_chat');

    let foundChatShopCreatedEvent = false;
    for (const event of eventsResponse.data) {
        if (event.typeName === 'ChatShopCreated') {
            foundChatShopCreatedEvent = true;
            chatShopObjectId = event.parsedJson.id;
        }
    }

    // there should be ChatShopCreated event
    t.ok(foundChatShopCreatedEvent);
    // it should have id of ChatShop object
    t.ok(chatShopObjectId);

    // there should be module 'suidouble_chat' on the contract
    t.ok(contract.modules.suidouble_chat);

    // it should find most recent version of the package
    t.equal(contract.version, 2);
});

test('execute contract methods', async t => {
    const moveCallResult = await contract.moveCall('suidouble_chat', 'post', [chatShopObjectId, 'the message', 'metadata']);

    // there're at least some object created
    t.ok(moveCallResult.created.length > 0);

    // by suidouble_chat contract design, ChatTopMessage is an object representing a thread,
    // it always has at least one ChatResponse (with text of the very first message in thread)
    let foundChatTopMessage = null;
    let foundChatResponse = null;
    let foundText = null;
    moveCallResult.created.forEach((obj)=>{
        if (obj.typeName == 'ChatTopMessage') {
            foundChatTopMessage = true;
        }
        if (obj.typeName == 'ChatResponse') {
            foundChatResponse = true;
            foundText = obj.fields.text;
        }
    });

    t.ok(foundChatTopMessage);
    t.ok(foundChatResponse);
    
    // messageTextAsBytes = [].slice.call(new TextEncoder().encode(messageText)); // regular array with utf data
    // suidouble_chat contract store text a bytes (easier to work with unicode things), let's convert it back to js string
    foundText = new TextDecoder().decode(new Uint8Array(foundText));

    t.equal(foundText, 'the message');

    // now lets post a reply to the thread
    // we need a ChatTopMessage to pass to move's 'reply' function
    // we can find it via ChatTopMessageCreated events or from previous method execution results
    // find from local objectStorage (where previous results are stored)
    const chatTopMessage = contract.objectStorage.findMostRecentByTypeName('ChatTopMessage');
    t.ok(chatTopMessage);

    const dynamicFields = await chatTopMessage.getDynamicFields();
    // as per sample move contract design, after the thread posted, chatResponse is attached to chatTopMessage as a dynamic object field
    // it's there till the very first response to thread is posted
    t.ok(dynamicFields.data.length === 1);

    const responseTextAsBytes = [].slice.call(new TextEncoder().encode('ขอบคุณครับ, 🇺🇦')); // regular array with utf data
    const moveCallResult2 = await contract.moveCall('suidouble_chat', 'reply', [chatTopMessage.id, responseTextAsBytes, 'metadata']);

    // there're at least some object created
    t.ok(moveCallResult2.created.length > 0);

    let responseText = null;
    moveCallResult2.created.forEach((obj)=>{
        if (obj.typeName == 'ChatResponse') {
            responseText = obj.fields.text;
        }
    });
    // messageTextAsBytes = [].slice.call(new TextEncoder().encode(messageText)); // regular array with utf data
    // suidouble_chat contract store text a bytes (easier to work with unicode things), let's convert it back to js string
    responseText = new TextDecoder().decode(new Uint8Array(responseText));

    t.equal(responseText, 'ขอบคุณครับ, 🇺🇦');
});

test('testing paginatedResponse', async t => {
    const chatTopMessage = contract.objectStorage.findMostRecentByTypeName('ChatTopMessage');
    t.ok(chatTopMessage);

    // fill method create a lot of responses ( check out contract's code )
    const moveCallResult = await contract.moveCall('suidouble_chat', 'fill', [chatTopMessage.id, 'the message response', 'metadata']);
    t.ok(moveCallResult.created.length >= 60); // it's 60 in move code, but let's keep chat flexible

    const eventsResponse = await contract.fetchEvents('suidouble_chat');
    const idsInEventsDict = {};
    let responsesInEventsCount = 0;
    do {
        for (const event of eventsResponse.data) {
            if (!idsInEventsDict[event.parsedJson.id]) {
                idsInEventsDict[event.parsedJson.id] = true;
                responsesInEventsCount++;
            }
        }
    } while(await eventsResponse.nextPage());

    t.ok(responsesInEventsCount >= 60); // it's 60 in move code, but let's keep chat flexible

    // or using SuiPaginatedResponse forEach itterator:
    const anotherEventsResponse = await contract.fetchEvents('suidouble_chat');
    let loopsInForEach = 0;
    const idsInLoopDict = {};
    await anotherEventsResponse.forEach(async (event)=>{ // 
        if (!idsInLoopDict[event.parsedJson.id]) {
            idsInLoopDict[event.parsedJson.id] = true;
            loopsInForEach++;
        }
    });

    t.ok(loopsInForEach >= 60); // it's 60 in move code, but let's keep chat flexible
});

test('testing move call with coins', async t => {
    const balanceWas = await suiMaster.getBalance();

    const longMessageYouCanNotPostForFree = ('message ').padEnd(500, 'test');
    // can't post it for free (as per contract design)
    t.rejects(contract.moveCall('suidouble_chat', 'post', [chatShopObjectId, longMessageYouCanNotPostForFree, 'metadata']));

    // but can post with with post_pay function sending some sui to it
    const moveCallResult = await contract.moveCall('suidouble_chat', 'post_pay', [chatShopObjectId, '<SUI>400000000000', longMessageYouCanNotPostForFree, 'metadata']);

    // there're at least some object created
    t.ok(moveCallResult.created.length > 0);

    // by suidouble_chat contract design, ChatTopMessage is an object representing a thread,
    // it always has at least one ChatResponse (with text of the very first message in thread)
    let foundChatTopMessage = null;
    let foundChatResponse = null;
    let foundText = null;
    moveCallResult.created.forEach((obj)=>{
        if (obj.typeName == 'ChatTopMessage') {
            foundChatTopMessage = true;
        }
        if (obj.typeName == 'ChatResponse') {
            foundChatResponse = true;
            foundText = obj.fields.text;
        }
    });

    t.ok(foundChatTopMessage);
    t.ok(foundChatResponse);
    
    // messageTextAsBytes = [].slice.call(new TextEncoder().encode(messageText)); // regular array with utf data
    // suidouble_chat contract store text a bytes (easier to work with unicode things), let's convert it back to js string
    foundText = new TextDecoder().decode(new Uint8Array(foundText));

    t.equal(foundText, longMessageYouCanNotPostForFree);

    const balanceNow = await suiMaster.getBalance();

    t.ok( balanceNow <= (balanceWas - 400000000000n) );
});

test('stops local test node', async t => {
    SuiLocalTestValidator.stop();
});