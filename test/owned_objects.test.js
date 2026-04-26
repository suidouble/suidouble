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

test('setup — init, fund, publish, post, fill (creates 60 owned ChatResponse objects)', async t => {
    suiMaster = new SuiMaster({ client: suiLocalTestValidator, as: 'somebody', debug: false });
    await suiMaster.initialize();

    await suiMaster.requestSuiFromFaucet();

    contract = suiMaster.addPackage({
        path: path.join(__dirname, './test_move_contracts/suidouble_chat/'),
    });
    await contract.build();
    await contract.publish();
    t.ok(contract.address, 'contract published');

    const chatShopId = suiMaster.objectStorage.findMostRecentByTypeName('ChatShop')?.id;
    t.ok(chatShopId, 'ChatShop found after publish');

    // post creates a ChatTopMessage (shared) and a ChatResponse (owned)
    await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', 'hello'),
        contract.arg('string', 'meta'),
    ]);

    const chatTopMessage = suiMaster.objectStorage.findMostRecentByTypeName('ChatTopMessage');
    t.ok(chatTopMessage, 'ChatTopMessage found after post');

    // fill creates 60 ChatResponse objects owned by the caller — exceeds the default page limit of 50
    const fillResult = await contract.moveCall('suidouble_chat', 'fill', [
        chatTopMessage.id,
        contract.arg('string', 'fill response'),
        contract.arg('string', 'meta'),
    ]);
    t.ok(fillResult.created.length >= 60, `fill created ${fillResult.created.length} objects (≥ 60)`);
});

test('wait for GraphQL indexer to catch up', async t => {
    await new Promise((res) => setTimeout(res, 1000));
    t.pass('waited');
});

test('getOwnedObjects — no type filter: forEach counts all objects across pages (> 50)', async t => {
    const result = await suiMaster.getOwnedObjects({
        owner: suiMaster.address,
        limit: 50,
    });

    t.ok(Array.isArray(result.data), 'data is an array');

    let total = 0;
    await result.forEach((obj) => {
        t.ok(obj.id, 'obj has an id');
        total++;
    });

    t.ok(total > 50, `total owned objects ${total} > 50 (pagination exercised)`);
});

test('getOwnedObjects — package scope: forEach counts all package objects across pages (> 50)', async t => {
    const result = await contract.getOwnedObjects({ limit: 50 });

    t.ok(Array.isArray(result.data), 'data is an array');

    const originalPackageId = await contract.getOriginalPackageId();
    let total = 0;
    await result.forEach((obj) => {
        t.ok(
            obj.type && obj.type.startsWith(originalPackageId + '::'),
            `"${obj.typeName}" belongs to the package`
        );
        total++;
    });

    t.ok(total > 50, `total package-scoped objects ${total} > 50 (pagination exercised)`);
});

test('getOwnedObjects — module scope: forEach counts module objects across pages (> 50)', async t => {
    const result = await contract.modules.suidouble_chat.getOwnedObjects({ limit: 50 });

    t.ok(Array.isArray(result.data), 'data is an array');

    const originalPackageId = await contract.getOriginalPackageId();
    const modulePrefix = `${originalPackageId}::suidouble_chat::`;
    let total = 0;
    await result.forEach((obj) => {
        t.ok(
            obj.type && obj.type.startsWith(modulePrefix),
            `"${obj.typeName}" belongs to suidouble_chat module`
        );
        total++;
    });

    t.ok(total > 50, `total module-scoped objects ${total} > 50 (pagination exercised)`);
});

test('getOwnedObjects — struct type (ChatResponse): forEach returns only ChatResponse > 50', async t => {
    const originalPackageId = await contract.getOriginalPackageId();

    const result = await contract.modules.suidouble_chat.getOwnedObjects({
        typeName: 'ChatResponse',
        limit: 50,
    });

    t.ok(Array.isArray(result.data), 'data is an array');

    let total = 0;
    await result.forEach((obj) => {
        t.equal(obj.typeName, 'ChatResponse', 'typeName is ChatResponse');
        t.ok(
            obj.type && obj.type.startsWith(`${originalPackageId}::suidouble_chat::ChatResponse`),
            'full type is correct'
        );
        total++;
    });

    t.ok(total > 50, `total ChatResponse objects ${total} > 50 (pagination exercised)`);

    // struct-typed ≤ module-scoped
    const moduleResult = await contract.modules.suidouble_chat.getOwnedObjects({ limit: 50 });
    let moduleTotal = 0;
    await moduleResult.forEach(() => { moduleTotal++; });
    t.ok(total <= moduleTotal, 'ChatResponse count ≤ module-scope count');
});

test('stops local test node', async t => {
    await SuiLocalTestValidator.stop().catch(() => {});
    t.pass('stopped');
});
