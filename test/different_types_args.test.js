'use strict'

const t = require('tap');
const { test } = t;
const path = require('path');

const { SuiMaster, SuiLocalTestValidator } = require('..');

let suiLocalTestValidator = null;
let suiMaster = null;
let contract = null;

let store = null;

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
        path: path.join(__dirname, './test_move_contracts/different_types/'),
    });
    await contract.build();
    await contract.publish();

    store = suiMaster.objectStorage.findMostRecentByTypeName('Store'); // should be in local objectStorage after publish
    await store.fetchFields();
    t.ok(store.fields.numbers == 0); // values on init
});

test('try to update store with different types', async t => {
    await contract.moveCall('different_types', 'put_u8', [ store.id, contract.arg('u8', 77) ]);
    await contract.moveCall('different_types', 'put_u16', [ store.id, contract.arg('u16', 77) ]);
    await contract.moveCall('different_types', 'put_u32', [ store.id, contract.arg('u32', 77) ]);
    await contract.moveCall('different_types', 'put_u64', [ store.id, contract.arg('u64', 77) ]);
    await contract.moveCall('different_types', 'put_u128', [ store.id, contract.arg('u128', 77) ]);
    await contract.moveCall('different_types', 'put_u256', [ store.id, contract.arg('u256', 77) ]);

    await store.fetchFields();
    t.ok(store.fields.numbers == 6 * 77); // incremented 6 times by 77

    await contract.moveCall('different_types', 'put_vector_u16', [ store.id, contract.arg('vector<u16>', [77,77,77,77]) ]);

    await store.fetchFields();
    t.ok(store.fields.numbers == 10 * 77); // plus 4 more times by 77

    await contract.moveCall('different_types', 'put_bool', [ store.id, contract.arg('bool', true) ]);
    await contract.moveCall('different_types', 'put_address', [ store.id, contract.arg('address', store.id) ]);

    await store.fetchFields();
    t.ok(store.fields.v_bool == true); 
    t.ok(store.fields.v_address == store.id); 

    await contract.moveCall('different_types', 'put_string', [ store.id, contract.arg('string', 'test') ]);

    await store.fetchFields();
    t.ok(store.fields.v_string == 'test'); 
});

test('module has same methods for args', async t => {
    const mod = contract.modules.different_types;
    await mod.moveCall('put_string', [ store.id, mod.arg('string', 'another test') ]);

    await store.fetchFields();
    t.ok(store.fields.v_string == 'another test'); 
});

test('passing typeArguments parameters', async t => {
    const mod = contract.modules.different_types;

    await mod.moveCall('put_type', [ store.id ], [ 'bool' ]);

    await store.fetchFields();
    t.ok(store.fields.v_string == 'bool'); 


    await mod.moveCall('put_type', [ store.id ], [ store.type ]);
    await store.fetchFields();

    // it's '_____packageid____::different_types::Store'
    t.ok(store.fields.v_string.indexOf('::different_types::Store') > 0); 
});


test('stops local test node', async t => {
    await SuiLocalTestValidator.stop();
});