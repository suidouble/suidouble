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

test('moveCall rejects with a readable error message when transaction aborts', async t => {
    // 500 chars exceeds suidouble_chat's free-post limit → Move abort (FailedTransaction).
    // Using 10000 chars would exceed the gRPC transaction size limit instead, producing a
    // transport-level error rather than a Move execution error.
    const tooLongText = 'x'.repeat(500);

    let thrownError = null;
    await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', tooLongText),
        contract.arg('string', 'metadata'),
    ]).catch(e => { thrownError = e; });

    t.ok(thrownError, 'moveCall rejected on aborted transaction');
    t.ok(thrownError instanceof Error, 'thrown value is an Error');
    t.ok(typeof thrownError.message === 'string' && thrownError.message.length > 0, 'error has a non-empty message');


    // the message should carry something useful from the RPC — an abort code or description
    const msg = thrownError.message.toLowerCase();
    const hasUsefulInfo = msg.includes('abort') || msg.includes('error') || msg.includes('failed') || msg.includes('overflow');
    t.ok(hasUsefulInfo, `error message is readable: "${thrownError.message}"`);

    // digest — present if the transaction was committed on chain (may be null for pre-consensus failures)
    t.ok(thrownError.hasOwnProperty('digest'), 'error has a digest property');
    if (thrownError.digest) {
        t.ok(typeof thrownError.digest === 'string' && thrownError.digest.length > 0,
            `error carries the failed tx digest: "${thrownError.digest}"`);
    } else {
        t.pass('digest is null — transaction did not reach consensus (expected for some abort types)');
    }

    // executionError — full SDK error object
    t.ok(thrownError.executionError !== undefined, 'error has executionError property');
    t.ok(thrownError.executionError !== null, 'executionError is not null');
    t.ok(typeof thrownError.executionError.message === 'string',
        'executionError.message is a string');

    // suidouble_chat abort code for oversized text — should be a MoveAbort
    if (thrownError.executionError.MoveAbort) {
        const abort = thrownError.executionError.MoveAbort;
        t.ok(typeof abort === 'object', 'MoveAbort is an object');
        console.log('MoveAbort details:', JSON.stringify(abort));
    }

    // command index — tells which PTB command aborted (if present)
    if (thrownError.executionError.command != null) {
        t.ok(typeof thrownError.executionError.command === 'number',
            `executionError.command is a number: ${thrownError.executionError.command}`);
    }
});

test('objectStorage is not updated after a failed moveCall', async t => {
    const tooLongText = 'x'.repeat(500);
    const countBefore = suiMaster.objectStorage.asArray().length;

    await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', tooLongText),
        contract.arg('string', 'metadata'),
    ]).catch(() => {});

    const countAfter = suiMaster.objectStorage.asArray().length;
    t.equal(countAfter, countBefore, 'objectStorage unchanged after failed transaction');
});

test('module "added" event is not emitted after a failed moveCall', async t => {
    const tooLongText = 'x'.repeat(500);
    const emitted = [];
    const onAdded = (ev) => emitted.push(ev.detail);
    contract.modules.suidouble_chat.addEventListener('added', onAdded);

    await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', tooLongText),
        contract.arg('string', 'metadata'),
    ]).catch(() => {});

    contract.modules.suidouble_chat.removeEventListener('added', onAdded);
    t.equal(emitted.length, 0, '"added" event not emitted after failed transaction');
});

test('executeTransaction rejects when the built tx aborts', async t => {
    const tooLongText = 'x'.repeat(500);
    const tx = new Transaction();
    tx.moveCall({
        target: `${contract.address}::suidouble_chat::post`,
        arguments: [
            tx.object(chatShopId),
            txInput(tx, 'string', tooLongText),
            txInput(tx, 'string', 'metadata'),
        ],
    });

    await t.rejects(
        contract.modules.suidouble_chat.executeTransaction(tx),
        'executeTransaction rejects on aborted transaction'
    );
});

test('gRPC transport error — extremely large input rejected before simulation', async t => {
    // 10Mb causes the gRPC transport to reject the request before it reaches the node.
    // This is a different failure path from Move abort (SimulationError) and FailedTransaction:
    //   - no executionError (no Move execution took place)
    //   - no digest (tx was never submitted)
    //   - error is typically a gRPC StatusError (RESOURCE_EXHAUSTED or INVALID_ARGUMENT)
    const giantText = 'x'.repeat(10_000_000);

    let thrownError = null;
    await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', giantText),
        contract.arg('string', 'metadata'),
    ]).catch(e => { thrownError = e; });

    t.ok(thrownError, 'moveCall rejected with a giant input');
    t.ok(thrownError instanceof Error, 'thrown value is an Error');
    t.ok(typeof thrownError.message === 'string' && thrownError.message.length > 0,
        'error has a message');

    // gRPC transport errors don't carry executionError — it never reached Move execution
    t.equal(thrownError.executionError, undefined,
        'no executionError — tx was rejected by transport, not by Move VM');

    // similarly no digest
    t.equal(thrownError.digest, undefined,
        'no digest — tx was never submitted to the network');

    console.log(`gRPC error type: ${thrownError.constructor.name}, message: ${thrownError.message}`);
});

test('a succeeding moveCall still works after a failed one', async t => {
    const result = await contract.moveCall('suidouble_chat', 'post', [
        chatShopId,
        contract.arg('string', 'short valid message'),
        contract.arg('string', 'metadata'),
    ]);

    t.ok(result.isSuccessful(), 'transaction is successful');
    t.ok(result.created.length > 0, 'objects created by the successful call');
});

test('stops local test node', async t => {
    await SuiLocalTestValidator.stop().catch(() => {});
    t.pass('stopped');
});
