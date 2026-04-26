'use strict'

import t from 'tap';
import { SuiMaster, SuiLocalTestValidator, Transaction, txInput } from '../index.js';

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

test('executeTransaction — custom Transaction built with suiMaster.Transaction', async t => {
    // build the tx using the Transaction class exposed via suiMaster
    const tx = new suiMaster.Transaction();

    tx.moveCall({
        target: `${contract.address}::suidouble_chat::post`,
        arguments: [
            tx.object(chatShopId),
            txInput(tx, 'string', 'custom tx message'),
            txInput(tx, 'string', 'custom tx metadata'),
        ],
    });

    // execute via module.executeTransaction so objectStorage + events are synced
    const result = await contract.modules.suidouble_chat.executeTransaction(tx);

    t.ok(result.created.length > 0, 'transaction created at least one object');

    let foundTopMessage = false;
    let foundResponse = false;
    for (const obj of result.created) {
        if (obj.typeName === 'ChatTopMessage') foundTopMessage = true;
        if (obj.typeName === 'ChatResponse')   foundResponse = true;
    }
    t.ok(foundTopMessage, 'ChatTopMessage created');
    t.ok(foundResponse, 'ChatResponse created');
});

test('executeTransaction — custom Transaction built with imported Transaction class', async t => {
    // same test using the directly imported Transaction from suidouble
    const tx = new Transaction();

    tx.moveCall({
        target: `${contract.address}::suidouble_chat::post`,
        arguments: [
            tx.object(chatShopId),
            txInput(tx, 'string', 'imported Transaction message'),
            txInput(tx, 'string', 'meta'),
        ],
    });

    const result = await contract.modules.suidouble_chat.executeTransaction(tx);

    t.ok(result.created.length > 0, 'transaction created objects');
    t.ok(result.isSuccessful(), 'transaction is marked successful');
});

test('executeTransaction — objectStorage is updated after custom tx', async t => {
    const before = suiMaster.objectStorage.asArray().length;

    const tx = new Transaction();
    tx.moveCall({
        target: `${contract.address}::suidouble_chat::post`,
        arguments: [
            tx.object(chatShopId),
            txInput(tx, 'string', 'storage sync test'),
            txInput(tx, 'string', 'meta'),
        ],
    });

    await contract.modules.suidouble_chat.executeTransaction(tx);

    const after = suiMaster.objectStorage.asArray().length;
    t.ok(after > before, `objectStorage grew from ${before} to ${after} after custom tx`);

    // created objects should be findable in objectStorage by type
    const topMessage = suiMaster.objectStorage.findMostRecentByTypeName('ChatTopMessage');
    t.ok(topMessage, 'ChatTopMessage is findable in objectStorage after custom tx');
});

test('suiMaster.signAndExecuteTransaction — low-level path, no objectStorage or event sync', async t => {
    // module.executeTransaction(tx) is the recommended high-level path:
    //   - signs and executes the transaction
    //   - pushes created/mutated objects into suiMaster.objectStorage
    //   - emits 'added' / 'created' / 'deleted' events on the module
    //
    // suiMaster.signAndExecuteTransaction(options) is the raw path underneath it:
    //   - only signs and submits — returns a SuiTransaction
    //   - does NOT update objectStorage
    //   - does NOT emit module events
    //   - use this when you want full control (e.g. multi-step PTBs, custom include flags)

    const storeBefore = suiMaster.objectStorage.asArray().length;

    const addedViaRaw = [];
    const onAdded = (ev) => addedViaRaw.push(ev.detail);
    contract.modules.suidouble_chat.addEventListener('added', onAdded);

    const tx = new Transaction();
    tx.moveCall({
        target: `${contract.address}::suidouble_chat::post`,
        arguments: [
            tx.object(chatShopId),
            txInput(tx, 'string', 'raw signAndExecute message'),
            txInput(tx, 'string', 'meta'),
        ],
    });

    const suiTransaction = await suiMaster.signAndExecuteTransaction({
        transaction: tx,
        include: {
            effects: true,
            objectTypes: true,
        },
    });

    contract.modules.suidouble_chat.removeEventListener('added', onAdded);

    // the transaction itself succeeded and has a digest
    t.ok(suiTransaction, 'signAndExecuteTransaction returned a SuiTransaction');
    t.ok(typeof suiTransaction.digest === 'string' && suiTransaction.digest.length > 0,
        'SuiTransaction has a digest');

    // created objects are accessible on the result
    t.ok(suiTransaction.created.length > 0, 'SuiTransaction.created is populated');

    // objectStorage was NOT updated — raw path skips that
    const storeAfter = suiMaster.objectStorage.asArray().length;
    t.equal(storeAfter, storeBefore, 'objectStorage was NOT updated by signAndExecuteTransaction');

    // module 'added' event was NOT emitted — raw path skips that too
    t.equal(addedViaRaw.length, 0, 'module "added" event was NOT emitted by signAndExecuteTransaction');
});

test('stops local test node', async t => {
    await SuiLocalTestValidator.stop().catch(() => {});
    t.pass('stopped');
});
