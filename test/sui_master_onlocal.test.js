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

let contractAddressV1 = null;
let contractAddressV2 = null;

let chatShopObjectId = null;

let chatResponseToDelete = null;

test('spawn local test node', async t => {
    suiLocalTestValidator = await SuiLocalTestValidator.launch({ testFallbackEnabled: true });
    t.ok(suiLocalTestValidator.active);

    // SuiLocalTestValidator runs as signle instance. So you can't start it twice with static method
    const suiLocalTestValidatorCopy = await SuiLocalTestValidator.launch();
    t.equal(suiLocalTestValidator, suiLocalTestValidatorCopy);
});

test('init suiMaster and connect it to local test validator', async t => {
    suiMaster = new SuiMaster({client: suiLocalTestValidator, as: 'somebody', debug: true});
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
    suiMaster = new SuiMaster({client: suiLocalTestValidator, as: 'somebody'});
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
    suiMaster = new SuiMaster({client: suiLocalTestValidator, as: 'somebody'});
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

// Event websocket subscriptions are going to be deprecated.
// test('subscribe to module events', async t => {
//     const module = await contract.getModule('suidouble_chat');
//     await module.subscribeEvents();

//     let gotEventChatTopMessageCreated = false;
//     let gotEventChatResponseCreated = false;

//     module.addEventListener('ChatTopMessageCreated', (event)=>{
//         gotEventChatTopMessageCreated = event;
//     });
//     module.addEventListener('ChatResponseCreated', (event)=>{
//         gotEventChatResponseCreated = event.detail; // .detail is reference to event itself. To support CustomEvent pattern
//     });

//     await contract.moveCall('suidouble_chat', 'post', [chatShopObjectId, contract.arg('string', 'the message'), contract.arg('string', 'metadata')]);
//     await new Promise((res)=>setTimeout(res, 300)); // got events without timeout, but just to be sure.

//     t.ok(gotEventChatTopMessageCreated);
//     t.ok(gotEventChatResponseCreated);

//     // just some checks that events have data by contract's architecture
//     t.ok(gotEventChatResponseCreated.parsedJson.top_message_id == gotEventChatTopMessageCreated.parsedJson.id);
//     t.ok(gotEventChatTopMessageCreated.parsedJson.top_response_id == gotEventChatResponseCreated.parsedJson.id);

//     // unsubscribing from events, to close websocket
//     await module.unsubscribeEvents();

//     t.end();
// });

test('execute contract methods', async t => {
    const moveCallResult = await contract.moveCall('suidouble_chat', 'post', [chatShopObjectId, contract.arg('string', 'the message'), contract.arg('string', 'metadata')]);

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
    const moveCallResult2 = await contract.moveCall('suidouble_chat', 'reply', [chatTopMessage.id, contract.arg('string', 'ขอบคุณครับ, 🇺🇦'), contract.arg('string', 'metadata')]);

    // there're at least some object created
    t.ok(moveCallResult2.created.length > 0);

    let responseText = null;
    moveCallResult2.created.forEach((obj)=>{
        if (obj.typeName == 'ChatResponse') {
            responseText = obj.fields.text;

            chatResponseToDelete = obj.id; // ChatResponse is moved to be owned by author, so we can store id to try burn_response later
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
    const moveCallResult = await contract.moveCall('suidouble_chat', 'fill', [chatTopMessage.id, contract.arg('string', 'the message response'), contract.arg('string', 'metadata')]);
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


test('find owned module objects with query', async t => {
    const module = await contract.getModule('suidouble_chat');
    await module.getNormalizedMoveFunction('fill');

    const paginatedResponse = await module.getOwnedObjects();

    let foundCount = 0;
    let foundChatOwnerCap = false;
    // loop through all module objects owned by current wall
    await paginatedResponse.forEach((suiObject)=>{
        if (suiObject.typeName == 'ChatOwnerCap') {
            foundChatOwnerCap = true;
        }

        foundCount++; // total count
    });
    t.ok(foundCount >= 60); // it's 60 in move code, but let's keep chat flexible
    t.ok(foundChatOwnerCap); // it's 60 in move code, but let's keep chat flexible

    /// also lets try querying specific typeName
    const paginatedResponse2 = await module.getOwnedObjects({ typeName: 'ChatOwnerCap' });

    let foundCount2 = 0;
    let foundChatOwnerCap2 = false;

    await paginatedResponse2.forEach(async(suiObject)=>{  // paginatedResponse forEach also accepts async callbacks
        if (suiObject.typeName == 'ChatOwnerCap') {
            foundChatOwnerCap2 = true;
        }
        foundCount2++;
    });

    t.ok(foundChatOwnerCap2); 
    t.ok(foundCount2 == 1); // ChatOwnerCap only
});

test('testing move call with coins', async t => {
    const balanceWas = await suiMaster.getBalance();

    const longMessageYouCanNotPostForFree = ('message ').padEnd(500, 'test');
    // can't post it for free (as per contract design)
    t.rejects(contract.moveCall('suidouble_chat', 'post', [chatShopObjectId, contract.arg('string', longMessageYouCanNotPostForFree), contract.arg('string', 'metadata')]));

    // but can post with with post_pay function sending some sui to it
    const moveCallResult = await contract.moveCall('suidouble_chat', 'post_pay', [chatShopObjectId, {type: 'SUI', amount: 400000000000n}, contract.arg('string', longMessageYouCanNotPostForFree), contract.arg('string', 'metadata')]);

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

    foundText = new TextDecoder().decode(new Uint8Array(foundText));

    t.equal(foundText, longMessageYouCanNotPostForFree);

    const balanceNow = await suiMaster.getBalance();

    t.ok( balanceNow <= (balanceWas - 400000000000n) );
});

test('testing move call with vector<Coin<..>>', async t => {
    const balanceWas = await suiMaster.getBalance();
    const longMessageYouCanNotPostForFree = ('message ').padEnd(500, 'test');

    // you can pass vector of coin, wrapping it's definition in array
    const moveCallResult = await contract.moveCall('suidouble_chat', 'post_pay_with_coin_vector', [chatShopObjectId, [{type: 'SUI', amount: 400000000000n}], contract.arg('string', longMessageYouCanNotPostForFree), contract.arg('string', 'metadata')]);
    // it's the wrapper over the same move function we've already tested, so lets keep the unit simple:
    t.ok(moveCallResult.created.length > 0);

    const balanceNow = await suiMaster.getBalance();
    t.ok( balanceNow <= (balanceWas - 400000000000n) ); // vector<Coin<SUI>> paid
});

test('testing move call deleting object', async t => {

    console.error('chatResponseToDelete', chatResponseToDelete);

    const moveCallResult = await contract.moveCall('suidouble_chat', 'burn_response', [chatResponseToDelete]);

    // there're at least some object created
    t.ok(moveCallResult.deleted.length > 0);

    t.equal(moveCallResult.deleted[0].id, chatResponseToDelete);

    t.ok(moveCallResult.deleted[0].isDeleted);
});

test('stops local test node', async t => {
    await SuiLocalTestValidator.stop();
});