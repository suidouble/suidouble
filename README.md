# suidouble

Set of provider, package and object classes for JavaScript representation of Sui Move smart contracts. Use the same code for publishing, upgrading, integration testing, interacting with contracts, and building browser dApps.

- [Installation](#installation)
- [Usage](#usage)
    - [Connecting](#connecting)
    - [Attaching a package](#attaching-a-package)
    - [Interacting with smart contract](#interacting-with-smart-contract)
        - [SuiObject](#suiobject)
        - [Fetching events](#fetching-events)
        - [Executing smart contract method](#executing-smart-contract-method)
        - [Move method argument types](#move-method-argument-types)
        - [Move methods with type parameters](#move-methods-with-type-parameters)
        - [Sending SUI / coins](#sending-sui--coins-with-smart-contract-methods)
        - [Composing a transaction yourself](#composing-a-transaction-yourself)
        - [Fetching objects](#fetching-objects)
        - [Fetching object fields](#fetching-object-fields)
        - [Fetching objects by id](#fetching-objects-by-id)
        - [Querying owned objects](#querying-owned-objects)
        - [Fetching transaction history for an object](#fetching-transaction-history-for-an-object)
        - [Resolving a Sui Name Service name](#resolving-a-sui-name-service-suins-name)
- [Publishing the package](#publishing-the-package)
- [Upgrading the package](#upgrading-the-package)
- [Writing Sui Move integration tests](#sui-move-integration-testing)
- [Connecting web3 dApps to Sui](#sui-move-connect-in-browser)
- [Unit tests](#unit-tests)
- [Todo](#todo)

### Sample applications

| Name     |      Stack    |  Online | Github |
|----------|---------------|---------|--------|
| sui-bot-score |  Vue + suidouble | [sui-bot-score](https://sui-bot-score-04f61376a410.herokuapp.com/)  | [source code](https://github.com/suidouble/suidouble-bot-score) |
| suidouble-sample-app |  Vue + suidouble | [suidouble-sample-app](https://suidouble-sample-app.herokuapp.com/)  | [source code](https://github.com/suidouble/suidouble-sample-app) |
| suidouble-color |  Vue + suidouble | [suidouble-color](https://suidouble-color.herokuapp.com/)  | [source code](https://github.com/suidouble/suidouble-sample-color) |



### installation

```
npm install suidouble --save
```

### usage

#### connecting

Main class to interact with blockchain is SuiMaster:

```javascript
import { SuiMaster } from 'suidouble';
```

You can initialize it directly, if you have keypair, secret phrase, or privateKey and can use it in code (so on node.js side - server side or CLI apps):
```javascript
const suiMaster = new SuiMaster({
    keypair: Ed25519Keypair || Secp256r1Keypair || Secp256k1Keypair,
    debug: true,    // echo testing messages to console
    client: 'testnet', // 'testnet', 'devnet', 'localnet', 'mainnet' or instance of this lib's SuiLocalTestValidator
});
const suiMaster = new SuiMaster({
    debug: false,
    privateKey: 'suiprivkey1qpwly9xrfsv50mqug706s40l58klez5q6mpchq4f5ldzktjyr4x7yhj9lf2',
    client: 'devnet', 
});
const suiMaster = new SuiMaster({
    debug: false,
    phrase: 'thrive mean two thrive mean two thrive mean two thrive mean two', // secret phrase to generate keypair
    client: 'devnet', 
});
const suiMaster = new SuiMaster({
    debug: false,
    phrase: 'thrive mean two thrive mean two thrive mean two thrive mean two', // secret phrase to generate keypair
    accountIndex: 1, // derive path index (you can generate few addresses with same seed phrase)
    client: 'devnet', 
});
const suiMaster = new SuiMaster({
    debug: false,
    phrase: 'thrive mean two thrive mean two thrive mean two thrive mean two', // secret phrase to generate keypair
    keypairAlgo: 'secp256k1', // 'secp256k1' or 'secp256r1' or 'ed25519' default is ed25519
    client: 'devnet', 
});
```

Also, there's option to generate pseudo-random phrases and wallets from strings, works like a charm for testing:
```javascript
const suiMasterAsAdmin = new SuiMaster({ as: 'admin', client: 'dev', });
const suiMasterAsUser = new SuiMaster({ as: 'user', client: 'dev', });
```

On browser side, you'd probably want to use Sui wallets extensions adapters to sign message and don't store any keypairs or secret phrases in your code. So there's SuiInBrowser class for this, which can setup suiMaster instance for you. See 'Sui Move Connect in browser' section or sample UI application's code for more details.
```javascript
import { SuiInBrowser } from 'suidouble';
const suiInBrowser = SuiInBrowser.getSingleton(); // you probably don't want to keep few connections, so there's singleton
/// ...
suiInBrowser.addEventListener('connected', async()=>{
    const connectedSuiMaster = await suiInBrowser.getSuiMaster(); // can post transactions now
    console.log('read-write on', suiInBrowser.getCurrentChain(), 'as', suiMaster.address);
});
suiInBrowser.connect(adapter);
```

Take a look at more detailed [web3 connect code](#sui-move-connect-in-browser), sample application [source code](https://github.com/suidouble/suidouble-sample-app) or [check it online](https://suidouble-sample-app.herokuapp.com/).

#### attaching a package

By default, suiMaster doesn't know of any smart contracts. There're 3 ways to attach one for interaction. 

You can do it directly if you know contract's address (id). This is the option for browser apps and testing existing package:

```javascript
const contract = suiMaster.addPackage({
    id: '0x20cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2',
});
await contract.isOnChain();  
```

On node.js side, if you have Move's project with package code, you can attach it with path. This is the option for TDD and package publishing.

```javascript
const contract = suiMaster.addPackage({
    path: '../path_to_move_project_root/',
});
await contract.isOnChain();  
```

Yes, it can find its address on chain, by comparing Move's module names with package you own on chain. Works ok if you want to test upgrading or something. Also, you can attach the package only by modules names. This will work in browser too (note: you have to own this package, its UpgradeCap):

```javascript
const contract = suiMaster.addPackage({
    modules: ['chat', 'anothermodulename'],
});
await contract.isOnChain();  
```

#### interacting with smart contract

##### SuiObject

Everything in Sui is an object. So is in suidouble. SuiObject's instance class follows:

```javascript
suiObject.id; // '0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2' or something
suiObject.address; // very same, '0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2'
suiObject.isShared; // boolean. Is object shared (see Sui docs)
suiObject.isImmutable; // boolean. Is object immutable (see Sui docs)
suiObject.isDeleted;   // marked as removed from blockchain in result of Sui Move contract method call
suiObject.type;        // full type name, with package-module prefix, '0x20cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2::chat::ChatResponse'
suiObject.typeName;    // type name with no prefixes, eg 'ChatResponse'
suiObject.fields;      // {}, object. Fields stored on blockchain
suiObject.display;     // display object stored on blockchain
suiObject.localProperties;  // {} object. Any local properties you want to attach to object. No interaction with blockchain. May be helpful to store some temp data
suiObject.isOwnedBy('0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2'); // is object owned by somebody or some object
/// object-related transactions:
await suiObject.fetchTransactions(); // returns instance of SuiPaginatedResponse
```

##### fetching events

```javascript
// fetch events for a specific module (all events or filtered by type):
const events = await contract.modules.modulename.fetchEvents({eventTypeName: 'ChatResponseCreated', order: 'descending'});
// events is instance of SuiPaginatedResponse. Data is stored in .data, has method to fetch next page - .nextPage();
while (events.hasNextPage) {
    for (const event of events.data) {
        // event is instance of SuiEvent 
        console.log('event', event.parsedJson); // data on blockchain
        console.log('timestamp', event.timestampMs); // time event emited
    }
    await events.nextPage();
}
// const events = await contract.modules.modulename.fetchEvents({order: 'descending'}); // all module events
// const events = await contract.fetchEvents({order: 'descending'}); // all events across all modules in the package
```


##### executing smart contract method

Both `SuiPackage` and `SuiPackageModule` expose a `moveCall` method. After execution the result is a `SuiTransaction` with `created`, `mutated`, and `deleted` arrays of `SuiObject` instances. Created and mutated objects are also pushed into `suiMaster.objectStorage` automatically.

```javascript
// via SuiPackage (module name is the first argument):
const res = await contract.moveCall('suidouble_chat', 'post', [
    '0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2', // object id string
    contract.arg('string', 'hello'),
    contract.arg('string', 'metadata'),
]);

// or directly via SuiPackageModule:
const res = await contract.modules.suidouble_chat.moveCall('post', [
    '0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2',
    contract.arg('string', 'hello'),
    contract.arg('string', 'metadata'),
]);

// inspect results — all SuiObject instances
for (const object of res.created) {
    // Note: fields are NOT populated from effects. Call fetchFields() first if you need them.
    await object.fetchFields();
    console.log('created', object.address, object.typeName, object.fields);
}
for (const object of res.mutated) {
    console.log('mutated', object.address, object.typeName);
}
for (const object of res.deleted) {
    console.log('deleted', object.address, object.isDeleted); // true
}
```

The returned `SuiTransaction` also exposes transaction-level metadata:

```javascript
res.digest;           // Base58-encoded transaction digest
res.isSuccessful();   // boolean — true if the transaction executed without errors
res.gasUsed;          // bigint — net gas cost in MIST (computationCost + storageCost − storageRebate)
res.executedEpoch;    // number — epoch the transaction was finalised in
res.timestampMs;      // number | null — checkpoint timestamp in ms (only for GraphQL-fetched transactions)
res.events;           // SuiEvent[] — events emitted (requires include: { events: true })
```

##### move method argument types

`SuiPackage` and `SuiPackageModule` both expose an `arg(type, value)` helper that builds a BCS-serialised Pure input:

```javascript
contract.arg('bool', true)
contract.arg('u8', 222)
contract.arg('u16', 2222)
contract.arg('u32', 3333)
contract.arg('u64', 4444n)
contract.arg('u128', 5555n)
contract.arg('u256', 6666n)
contract.arg('address', '0xd9a95d7cc137f71dd7766f02791536453062a7509e9f461620cc4f583b09134c')
contract.arg('string', 'some utf-8 💧string')
contract.arg('vector<u8>', [222, 111, 211]) // also works for other primitive vectors
```

Take a look at the unit test covering all argument types [here](test/different_types_args.test.js).

##### move methods with type parameters

For Move methods declared as `public entry fun method<T>(...)`, pass type arguments as a third parameter to `module.moveCall` or fourth to `contract.moveCall`:

```javascript
await contract.modules.module_name.moveCall(
    'test_method',
    [ store.id ],
    [ '0xca90beae66f23df1a830357c92e0a4348b6164d142c96b06936c5f28fdeaa99f::different_types::Store' ],
);
await contract.moveCall(
    'module_name',
    'test_method',
    [ store.id ],
    [ '0xca90beae66f23df1a830357c92e0a4348b6164d142c96b06936c5f28fdeaa99f::different_types::Store' ],
);
```

##### sending SUI / coins with smart contract methods

Pass a coin magic object in place of the coin argument. The amount can be a `BigInt` (raw MIST) or a decimal string (e.g. `'0.2'`):

```javascript
{ type: 'SUI', amount: 400000000000n }   // 400 SUI in MIST
{ type: 'SUI', amount: '0.2' }           // 0.2 SUI — converted via coin metadata
{ type: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN', amount: '1.0' }  // 1 USDC
```

```javascript
const moveCallResult = await contract.moveCall('suidouble_chat', 'post_pay', [
    chatShopObjectId,
    { type: 'SUI', amount: 400000000000n },
    contract.arg('string', messageText),
]);
```

Coin selection, merging, and splitting are handled by the SDK's `tx.coin({ balance })` intent at build time.

For contracts that require `vector<Coin<T>>`, wrap the magic object in a single-element array:

```javascript
await contract.moveCall('suidouble_chat', 'post_pay_with_coin_vector', [
    chatShopObjectId,
    [{ type: 'SUI', amount: 400000000000n }],  // vector<Coin<SUI>>
    contract.arg('string', messageText),
]);
```

Don't forget to test transactions sending real money on devnet/testnet first!

##### composing a transaction yourself

For full control, build a `Transaction` manually and execute it via `module.executeTransaction(tx)`. This method signs, submits, and then syncs `objectStorage` and fires module events — just like `moveCall` does internally.

```javascript
import { Transaction, txInput } from 'suidouble';

const tx = new Transaction();
tx.moveCall({
    target: `${contract.address}::suidouble_chat::post`,
    arguments: [
        tx.object(chatShopObjectId),
        txInput(tx, 'string', 'hello'),
        txInput(tx, 'string', 'metadata'),
    ],
});

// high-level: signs + submits + syncs objectStorage + emits events
const res = await contract.modules.suidouble_chat.executeTransaction(tx);
console.log('created', res.created.length, 'objects');
```

If you want only signing and submission without the storage/event sync (e.g. you're building a multi-step PTB and managing state yourself), call the lower-level method directly:

```javascript
const suiTransaction = await suiMaster.signAndExecuteTransaction({
    transaction: tx,
    include: { effects: true, objectTypes: true },
});
// objectStorage is NOT updated; module events are NOT emitted
console.log(suiTransaction.digest);
```


##### fetching objects

`SuiMemoryObjectStorage` is attached to every `SuiMaster` instance. Every `moveCall` automatically pushes created and mutated objects into it.

```javascript
// find the most recently created ChatTopMessage in local storage:
const chatTopMessage = suiMaster.objectStorage.findMostRecentByTypeName('ChatTopMessage');

// look up by address:
const object = suiMaster.objectStorage.byAddress('0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2');
```

##### fetching object fields

Objects returned from `moveCall` have their `id`, `version`, and `type` populated but `fields` is empty until you call `fetchFields()`. This fetches content from chain and populates `fields`, `display`, `owner`, etc.

```javascript
const result = await contract.moveCall('suidouble_chat', 'post', [...]);
const chatResponse = result.created.find(o => o.typeName === 'ChatResponse');

await chatResponse.fetchFields();
console.log(chatResponse.fields.text); // now populated
```

##### fetching objects by id

Use `suiMaster.getObject(id)` for a single object or `suiMaster.getObjects(ids)` for a batch. Both return fully-populated `SuiObject` instances. `getObjects` also accepts existing `SuiObject` instances and updates them in-place.

```javascript
// single fetch:
const obj = await suiMaster.getObject('0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2');
console.log(obj.typeName, obj.fields);

// batch fetch — accepts ids, SuiObject instances, or a mix:
const objects = await suiMaster.getObjects([id1, id2, existingSuiObject]);
for (const o of objects) {
    console.log(o.id, o.typeName, o.fields);
}
```

##### querying owned objects

Use `getOwnedObjects` to query owned objects from the chain, scoped to the whole address, a package, a module, or a specific struct type:

```javascript
// all objects owned by the connected address:
const all = await suiMaster.getOwnedObjects({ owner: suiMaster.address, limit: 50 });

// all objects from this package owned by you (uses GraphQL — supports package/module prefixes):
const pkgObjects = await contract.getOwnedObjects();

// all objects of a specific module owned by you:
const modObjects = await contract.modules.suidouble_chat.getOwnedObjects();

// objects of a specific struct type (uses gRPC — full struct type required):
const responses = await contract.modules.suidouble_chat.getOwnedObjects({ typeName: 'ChatResponse' });

// iterate across all pages with forEach:
await responses.forEach(async (suiObject) => {
    await suiObject.fetchFields();
    console.log(suiObject.id, suiObject.fields);
});
```

##### fetching transaction history for an object

```javascript
const txs = await chatTopMessage.fetchTransactions({ limit: 20, order: 'desc' });
for (const tx of txs.data) {
    console.log(tx.digest, tx.timestampMs);
}
```

##### resolving a Sui Name Service (SuiNS) name

Returns the primary `.sui` name registered for the connected wallet address, or `null` if none. Uses the v2 gRPC client — works on mainnet and testnet.

Each call hits the network, so **cache the result yourself** if you plan to display it repeatedly (e.g. in a UI that re-renders often).

```javascript
const name = await suiMaster.defaultNameServiceName();
// e.g. 'adeniyi.sui', or null if no name is registered
if (name) {
    console.log('connected as', name);
}
```



### publishing the package

Builds a package and publish it to blockchain. CLI thing, as it needs `execSync` to run `sui move build`. Tested on Ubuntu, works good. If you have some issues with other platforms - please feel free to let me know or post Pull Request.

```javascript
import { SuiMaster } from 'suidouble'; 


const suiMaster = new SuiMaster({ debug: true, as: 'admin', client: 'devnet', });

await suiMaster.requestSuiFromFaucet();
await suiMaster.getBalance();

const contract = suiMaster.addPackage({
    path: '../path_to_move_project_root/',
});

await contract.publish();
console.log('published as', contract.address);
```

Optionally, you can switch sui's env of `sui client switch` for the build (useful for Automated Address Management of dependencies via their Move.lock)

```javascript
const contract = suiMaster.addPackage({
    path: '../path_to_move_project_root/',
});
await contract.build({ env: 'testnet', });
await contract.publish();

```

### upgrading the package

Same, it's for CLI as it re-builds the package.

```javascript
import { SuiMaster } from 'suidouble'; 

const suiMaster = new SuiMaster({ debug: true, as: 'admin', client: 'localnet', });
// or: client: await SuiLocalTestValidator.launch({debug: true, epochDuration: 30000})
await suiMaster.requestSuiFromFaucet();
await suiMaster.getBalance();

const contract = suiMaster.addPackage({
    path: '../path_to_move_project_root/',
});

if (!(await contract.isOnChain())) { // suidouble tries to find package with needed modules in UpgradeCaps owned by you
    await contract.publish();
} else {
    await contract.upgrade();
}
```

### Sui Move Integration Testing

CLI integration tests, it runs local testing node (has to be installed), build and deploy a Move package into it and run unit tests over.
suidouble try to mimic Sui Move's testing framework:

```javascript
import { SuiTestScenario } from 'suidouble'; 

const testScenario = new SuiTestScenario({
    path: '../path_to_move_project_root/',
    debug: true,
});

await testScenario.begin('admin');
await testScenario.init();

await testScenario.nextTx('admin', async()=>{
    const chatShop = testScenario.takeShared('ChatShop');
    await testScenario.moveCall('chat', 'post', [chatShop.address, testScenario.arg('string', 'posting a message'), testScenario.arg('string', 'metadata') ]);
    const chatTopMessage = testScenario.takeShared('ChatTopMessage');

    assert(chatTopMessage != null);
    assert(chatTopMessage.id != null);
});

await testScenario.nextTx('somebody', async()=>{
    const chatTopMessage = testScenario.takeShared('ChatTopMessage');
    await testScenario.moveCall('chat', 'reply', [chatTopMessage.address, testScenario.arg('string', 'posting a response'), testScenario.arg('string', 'metadata') ]);
    const chatResponse = testScenario.takeFromSender('ChatResponse');

    assert(chatResponse != null);
    assert(chatResponse.id != null);
});

await testScenario.end();
```

### Sui Move Connect in browser

Check out [suidouble Vue component](https://www.npmjs.com/package/vue-sui) to connect your dapp to the Sui blockchain.

Or write it manually — the code is framework-independent:

```javascript
import { SuiInBrowser } from 'suidouble'; 

const suiInBrowser = SuiInBrowser.getSingleton();
const suiMaster = await suiInBrowser.getSuiMaster(); // not yet connected, works in read-only mode (no signing-posting txs).
console.log('read-only on', suiInBrowser.getCurrentChain());

suiInBrowser.addEventListener('adapter', (adapter)=>{
    console.log(adapter.name);
    console.log(adapter.icon);
    console.log(adapter.getDownloadURL());

    if (adapter.name == 'Sui Wallet') {
        suiInBrowser.connect(adapter);
    }
});

suiInBrowser.addEventListener('connected', async()=>{
    const connectedSuiMaster = await suiInBrowser.getSuiMaster(); // can post transactions now
    console.log('read-write on', suiInBrowser.getCurrentChain(), 'as', suiMaster.address);

    const contract = connectedSuiMaster.addPackage({
        id: '0x20cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2',
    });

    await contract.isOnChain();

    const events = await contract.modules.chat.fetchEvents({eventTypeName: 'ChatResponseCreated', order: 'descending'});
    for (const event of events.data) {
        console.log('event', event.parsedJson);
    }

    const res = await contract.moveCall('chat', 'post', [contract.arg('string', 'somedata'), contract.arg('vector<u8>', [1, 2, 3]) ]);
    for (const object of res.created) {
        console.log('created', object.address, 'with type of', object.typeName);
    }
});

```

### Unit tests

```bash
npm install
npm run tests
```

Take a look at [unit tests](test) code for some inspiration.

### Todo

- suiobject invalidation/fetching optimization
- better documentation
- unit tests coverage to 90%+