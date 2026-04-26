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
let chatShopId = null;

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

    chatShopId = suiMaster.objectStorage.findMostRecentByTypeName('ChatShop')?.id;
    t.ok(chatShopId, 'ChatShop found after publish');
});

test('module addEventListener — added/created fire for each created object', async t => {
    const moduleAdded   = [];
    const moduleCreated = [];

    const onAdded   = (ev) => moduleAdded.push(ev.detail);
    const onCreated = (ev) => moduleCreated.push(ev.detail);

    contract.modules.suidouble_chat.addEventListener('added',   onAdded);
    contract.modules.suidouble_chat.addEventListener('created', onCreated);

    const result = await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', 'listener test'),
        contract.arg('string', 'meta'),
    ]);

    contract.modules.suidouble_chat.removeEventListener('added',   onAdded);
    contract.modules.suidouble_chat.removeEventListener('created', onCreated);

    t.ok(result.created.length > 0, 'moveCall created at least one object');

    // 'created' fires exactly once per chain-created object
    t.equal(moduleCreated.length, result.created.length,
        `'created' fired ${moduleCreated.length} times — once per created object`);

    // 'added' fires at least once per chain-created object (may include first-seen mutated)
    t.ok(moduleAdded.length >= result.created.length,
        `'added' fired ${moduleAdded.length} times (≥ created count)`);

    // every created object must appear in both listeners
    for (const created of result.created) {
        t.ok(moduleAdded.some((o) => o?.id === created.id),
            `'added' fired for ${created.typeName}`);
        t.ok(moduleCreated.some((o) => o?.id === created.id),
            `'created' fired for ${created.typeName}`);
    }

    // every payload is a SuiObject with a 0x-prefixed id
    for (const obj of moduleAdded) {
        t.ok(obj && typeof obj.id === 'string' && obj.id.startsWith('0x'),
            `'added' payload has a valid id`);
    }
});

test('package addEventListener — added is forwarded from module', async t => {
    const packageAdded = [];
    const moduleAdded  = [];

    const onPackageAdded = (ev) => packageAdded.push(ev.detail);
    const onModuleAdded  = (ev) => moduleAdded.push(ev.detail);

    contract.addEventListener('added', onPackageAdded);
    contract.modules.suidouble_chat.addEventListener('added', onModuleAdded);

    await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', 'package listener test'),
        contract.arg('string', 'meta'),
    ]);

    contract.removeEventListener('added', onPackageAdded);
    contract.modules.suidouble_chat.removeEventListener('added', onModuleAdded);

    t.ok(moduleAdded.length > 0, 'module "added" fired');
    t.equal(packageAdded.length, moduleAdded.length,
        'package "added" forwarded every module "added"');

    for (const obj of packageAdded) {
        t.ok(obj && typeof obj.id === 'string' && obj.id.startsWith('0x'),
            `package 'added' payload has a valid id`);
    }
});

test('removeEventListener — listener stops receiving events after removal', async t => {
    const received = [];
    const onAdded = (ev) => received.push(ev.detail);

    contract.modules.suidouble_chat.addEventListener('added', onAdded);
    contract.modules.suidouble_chat.removeEventListener('added', onAdded);

    await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', 'after removal'),
        contract.arg('string', 'meta'),
    ]);

    t.equal(received.length, 0, 'no events received after removeEventListener');
});

test('module addEventListener — deleted fires for burned object', async t => {
    // create a ChatResponse to burn
    const postResult = await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', 'to be burned'),
        contract.arg('string', 'meta'),
    ]);
    const chatResponse = postResult.created.find((o) => o.typeName === 'ChatResponse');
    t.ok(chatResponse, 'ChatResponse found in created objects');

    // get a reply-owned ChatResponse (burn_response requires an owned ChatResponse)
    const chatTopMessage = postResult.created.find((o) => o.typeName === 'ChatTopMessage');
    const replyResult = await contract.moveCall('suidouble_chat', 'reply', [
        chatTopMessage.id,
        contract.arg('string', 'reply to burn'),
        contract.arg('string', 'meta'),
    ]);
    const replyResponse = replyResult.created.find((o) => o.typeName === 'ChatResponse');
    t.ok(replyResponse, 'reply ChatResponse found');

    const moduleDeleted = [];
    const onDeleted = (ev) => moduleDeleted.push(ev.detail);
    contract.modules.suidouble_chat.addEventListener('deleted', onDeleted);

    const burnResult = await contract.moveCall('suidouble_chat', 'burn_response', [replyResponse.id]);

    contract.modules.suidouble_chat.removeEventListener('deleted', onDeleted);

    t.ok(burnResult.deleted.length > 0, 'burn recorded at least one deleted object');
    t.equal(moduleDeleted.length, burnResult.deleted.length,
        `'deleted' fired ${moduleDeleted.length} times — once per deleted object`);

    for (const obj of moduleDeleted) {
        t.ok(obj && obj.isDeleted, 'deleted payload is marked isDeleted');
        t.ok(typeof obj.id === 'string' && obj.id.startsWith('0x'),
            'deleted payload has a valid id');
    }
});

test('stops local test node', async t => {
    await SuiLocalTestValidator.stop().catch(() => {});
    t.pass('stopped');
});
