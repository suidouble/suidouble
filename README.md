# suidouble

Set of provider, package and object classes for javascript representation of Sui's smart contracts. Use same code for publishing, upgrading, integration testing, interaction with smart contracts and integration in browser dapps. Very alpha for now.

- [Installation](#installation)
- [Usage](#usage)
    - [Connecting](#connecting)
    - [Attaching a package](#attaching-a-package)
    - [Interacting with smart contract](#interacting-with-smart-contract)
    - [SuiObject](#suiobject)
    - [Fetching objects](#fetching-objects)
    - [Fetching Events](#fetching-events)
    - [Subscribe to Events](#subscribing-to-events)
    - [Executing smart contract method](#executing-smart-contract-method)
    - [Sending sui / coins with smart contract methods](#sending-sui--coins-with-smart-contract-methods)
    - [Composing transaction block yourself](#composing-transaction-block-yourself)
- [Publishing the package](#publishing-the-package)
- [Upgrading the package](#upgrading-the-package)
- [Writing Sue Move intergration tests](#sui-move-integration-testing)
- [Connecting web3 dapps to Sui](#sui-move-connect-in-browser)
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
const { SuiMaster } = require('suidouble');
```

You can initialize it directly, if you have keypair, secret phrase and can use it in code (so on node.js side - server side or CLI apps):
```javascript
const suiMaster = new SuiMaster({
    keypair: Ed25519Keypair,
    debug: true,    // echo testing messages to console
    provider: 'test', // 'test', 'dev', 'local', 'main' or instance of this lib's SuiLocalTestValidator, or instance of Sui's JsonRpcProvider 
});
const suiMaster = new SuiMaster({
    debug: false,
    phrase: 'thrive mean two thrive mean two thrive mean two thrive mean two', // secret phrase to generate keypair
    provider: 'dev', 
});
const suiMaster = new SuiMaster({
    debug: false,
    phrase: 'thrive mean two thrive mean two thrive mean two thrive mean two', // secret phrase to generate keypair
    accountIndex: 1, // derive path index (you can generate few addresses with same seed phrase)
    provider: 'dev', 
});
```

Also, there's option to generate pseudo-random phrases and wallets from strings, works like a charm for testing:
```javascript
const suiMasterAsAdmin = new SuiMaster({ as: 'admin', provider: 'dev', });
const suiMasterAsUser = new SuiMaster({ as: 'user', provider: 'dev', });
```

On browser side, you'd probably want to use Sui wallets extensions adapters to sign message and don't store any keypairs or secret phrases in your code. So there's SuiInBrowser class for this, which can setup suiMaster instance for you. See 'Sui Move Connect in browser' section or sample UI application's code for more details.
```javascript
const { SuiInBrowser } = require('suidouble');
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

Yes, it can find it's address on chain, by comparing Move's module names with package you own on chain. Works ok if you want to test upgrading or something. Also, you can attach the package only by modules names. This will work in browser too (note: you have to own this package, its UpgradeCap):

```javascript
const contract = suiMaster.addPackage({
    modules: ['chat', 'anothermodulename'],
});
await contract.isOnChain();  
```

#### interacting with smart contract

##### SuiObject

Everyhing in Sui is an object. So is in suidouble. SuiObject's instance class follows:

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
/// past versions:
await suiObject.getPastObject(version); // get instance of object from the past
await suiObject.getPastObject(); // try to get previous
/// object-related transactions:
await suiObject.queryTransactionBlocks(); // returns instance of SuiPaginatedResponse
```

@todo: better SuiObject documentation

##### fetching events

```javascript
const events = await contract.fetchEvents('modulename', {eventTypeName: 'ChatResponseCreated', order: 'descending'});
// events is instance of SuiPaginatedResponse. Data is stored in .data, has method to fetch next page - .nextPage();
while (events.hasNextPage) {
    for (const event of events.data) {
        // event is instance of SuiEvent 
        console.log('event', event.parsedJson); // data on blockchain
        console.log('timestamp', event.timestampMs); // time event emited
    }
    await events.nextPage();
}
// const events = await contract.fetchEvents('modulename', {order: 'descending'}); // or all module events
```

##### subscribing to events

You can subscribe to Sui's contract events on package's module level. No types-etc filters for now ( @todo? )

```javascript
const module = await contract.getModule('suidouble_chat');
await module.subscribeEvents();
module.addEventListener('ChatResponseCreated', (suiEvent)=>{
    // received message emited by 
    // emit(ChatResponseCreated { id: object::uid_to_inner(&chat_response_id), top_message_id: object::uid_to_inner(&id), seq_n: 0 });
    // in suidouble_chat 's smart contract
    console.log(suiEvent.typeName); // == 'ChatResponseCreated'
    console.log(suiEvent.parsedJson);
});
module.addEventListener('ChatTopMessageCreated', (suiEvent)=>{
    // received message emited by 
    // emit(ChatTopMessageCreated { id: object::uid_to_inner(&id), top_response_id: object::uid_to_inner(&chat_response_id),  });
    // in suidouble_chat 's smart contract
    console.log(suiEvent.typeName); // == 'ChatTopMessageCreated'
    console.log(suiEvent.parsedJson);
});
```

Don't forget to unsubscribe from events when you don't need them anymore:

```javascript
await module.unsubscribeEvents();
```

##### executing smart contract method

```javascript
// executing method with parameters of (chat_shop: &ChatShop, metadata: vector<u8>, text: vector<u8>)
const res = await contract.moveCall('chat', 'post', ['0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2', [3,24,55], 'anotherparam']);
// or await contract.modules.chat.moveCall('methodname', ['somedata', [3,24,55], 'anotherparam']);
    console.log(res);
    for (const object of res.created) {
        console.log('created', object.address, 'with type of', object.typeName); // instances of SuiObject (@todo: write documentation for it)
    }
    for (const object of res.mutated) {
        console.log('mutated', object.address, 'with type of', object.typeName); 
    }
    for (const object of res.deleted) {
        console.log('deleted', object.address, 'with type of', object.typeName, object.isDeleted);
    }
```

##### sending sui / coins with smart contract methods

If you need to transfer some SUI/coins as part of executing contract method, you can use a magic parameter in form of:

```javascript
{type: 'SUI', amount: 400000000000n} 
// 400000000000 MISTs, if amount is BigInt, it's used in decimal items
{type: 'SUI', amount: '0.2'}         
// 0.2 SUI           , if amount is String, it's translated to decimals, using coin metadata in a lazy way
{type: '0x5d4b302506645c37ff133b98c4b50a5ae14841659738d6d733d59d0d217a93bf::coin::COIN', amount: '1.0'}
// 1 USDC, note it should have a dot even if it's '0' after. You may want to use `Number(var).toFixed(decimals)` as a conversion
{type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN', amount: '99.99'}
// 99.99 USDT
```

So executing

```javascript
const params = [
    chatShopObjectId,
    {type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN', amount: '9.99'},
    messageText,
];
const moveCallResult = await contract.moveCall('suidouble_chat', 'post_pay', params);
```

will send 9.99 USDT as the second parameter of the package method. Suidouble will convert needed coins using Sui's SplitCoins and MergeCoins internally to match amount you expect to send.

Some smart contracts requires clients to send coins in form of vectors. This is covered too, just pass magic parameter if the form of an array with one element:

```javascript
const params = [
    chatShopObjectId,
    [{type: '0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN', amount: '9.99'}],
    messageText,
];
```

Don't forget to test transactions sending real money on devnet/testnet first!


##### composing transaction block yourself

If you need more flexebility, there's always an option to construct the transaction block yourself:

```javascript
const { TransactionBlock, Transactions } = require('suidobule'); // this exposes classes from the "@mysten/sui.js", so you don't have to import them separately

const txb = new TransactionBlock();
txb.moveCall({
    target: `package_id::module_id::method_name`,
    arguments: [
        txb.pure(something),
        txb.object(someid),
    ],
});
const moveCallResult = await contract.moveCall('suidouble_chat', 'post_pay', {tx: txb});
```


##### fetching objects

There's instance of SuiMemoryObjectStorage attached to every SuiMaster instance. Every smart contract method call adds created and mutated objects to it. You can also attach any object with it's address (id).

```javascript
contract.modules.modulename.pushObject('0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2');
await contract.modules.modulename.fetchObjects(); // fetch objects fields etc
const object = contract.modules.modulename.objectStorage.byAddress('0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2');
```

Another option (if you don't know the object id) is to query current wallet owned module's objects from blockchain:

```javascript
const module = await contract.getModule('suidouble_chat');
const paginatedResponse = await module.getOwnedObjects();   // all module objects owned by you
const paginatedResponse2 = await module.getOwnedObjects({ typeName: 'ChatResponse' });  // specific type objects owned by you

await paginatedResponse.forEach(async(suiObject)=>{
    console.log(suiObject.id, suiObject.typeName, suiObject.fields);
}, maxLimit); // optional maxLimit, if (!maxLimit) - it will fetch and call callback for all available objects
```

@todo: move pushing/fetching to SuiMemoryObjectStorage directly, as there's nothing package or module related?
@todo: invalidation? No need to re-fetch all objects each time


### publishing the package

Builds a package and publish it to blockchain. CLI thing, as it needs `execSync` to run `sui move build`. Tested on Ubuntu, works good. If you have some issues with other platforms - please feel free to let me know or post Pull Request.

```javascript
const { SuiMaster } = require('suidouble');

const provider = 'dev';
const suiMaster = new SuiMaster({ debug: true, as: 'admin', provider: provider, });

await suiMaster.requestSuiFromFaucet();
await suiMaster.getBalance();

const package = suiMaster.addPackage({
    path: '../path_to_move_project_root/',
});

await package.publish();
console.log('published as', package.address);
```

### upgrading the package

Same, it's for CLI as it re-builds the package.

```javascript
const { SuiMaster } = require('suidouble');

const provider = 'local';// or await SuiLocalTestValidator.launch({debug: true, epochDuration: 30000});

const suiMaster = new SuiMaster({ debug: true, as: 'admin', provider: provider, });
await suiMaster.requestSuiFromFaucet();
await suiMaster.getBalance();

const package = suiMaster.addPackage({
    path: '../path_to_move_project_root/',
});

if (!(await package.isOnChain())) { // suidouble tries to find package with needed modules in UpgradeCaps owned by you
    await package.publish();
} else {
    await package.upgrade();
}
```

### Sui Move Integration Testing

CLI integration tests, it runs local testing node (has to be installed), build and deploy a Move package into it and run unit tests over.
suidouble try to mimic Sui Move's testing framework:

```javascript
const SuiTestScenario = require('./lib/SuiTestScenario.js');

const testScenario = new SuiTestScenario({
    path: '../path_to_move_project_root/',
    debug: true,
});

await testScenario.begin('admin');
await testScenario.init();

await testScenario.nextTx('admin', async()=>{
    const chatShop = testScenario.takeShared('ChatShop');
    await testScenario.moveCall('chat', 'post', [chatShop.address, 'posting a message', 'metadata']);
    const chatTopMessage = testScenario.takeShared('ChatTopMessage');

    assert(chatTopMessage != null);
    assert(chatTopMessage.id != null);
});

await testScenario.nextTx('somebody', async()=>{
    const chatTopMessage = testScenario.takeShared('ChatTopMessage');
    await testScenario.moveCall('chat', 'reply', [chatTopMessage.address, 'posting a response', 'metadata']);
    const chatResponse = testScenario.takeFromSender('ChatResponse');

    assert(chatResponse != null);
    assert(chatResponse.id != null);
});

await testScenario.end();
```

### Sui Move Connect in browser

Check out [suidouble Vue component](https://www.npmjs.com/package/vue-sui) to connect your dapp to the Sui blockchain.

Or write the one manually, code is framework independed:

```javascript
const { SuiInBrowser } = require('suidouble');

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

    const events = await contract.fetchEvents('chat', {eventTypeName: 'ChatResponseCreated', order: 'descending'});
    for (const event of events.data) {
        // instances of SuiEvent (@todo: write documentation for it)
        console.log('event', event.parsedJson);
    }

    const res = await contract.moveCall('chat', 'post', ['somedata', [3,24,55], 'anotherparam']);
    console.log(res);
    for (const object of res.created) {
        console.log('created', object.address, 'with type of', object.typeName); // instances of SuiObject (@todo: write documentation for it)
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