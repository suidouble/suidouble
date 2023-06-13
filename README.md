# suidouble

Set of provider, package and object classes for javascript representation of Sui's smart contracts. Use same code for publishing, upgrading, integration testing, interaction with smart contracts and integration in browser dapps. Very alpha for now.

- [Installation](#installation)
- [Usage](#usage)
    - [Connecting](#connecting)
    - [Attaching a package](#attaching-a-package)
    - [Interacting with smart contract](#interacting-with-smart-contract)
    - [SuiObject](#suiobject)
    - [Fetching Events](#fetching-events)
    - [Subscribe to Events](#subscribing-to-events)
    - [Executing smart contract method](#executing-smart-contract-method)
    - [Fetching objects](#fetching-objects)
- [Publishing the package](#publishing-the-package)
- [Upgrading the package](#upgrading-the-package)
- [Writing Sue Move intergration tests](#sui-move-integration-testing)
- [Connecting web3 dapps to Sui](#sui-move-connect-in-browser)
- [Todo](#todo)

### Sample applications

| Name     |      Stack    |  Online | Github |
|----------|---------------|---------|--------|
| suidouble-sample-app |  Vue + suidouble | [suidouble-sample-app](https://suidouble-sample-app.herokuapp.com/)  | [source code](https://github.com/suidouble/suidouble-sample-app) |
| suidouble-color |  Vue + suidouble | [suidouble-color](https://suidouble-color.herokuapp.com/)  | [source code](https://github.com/suidouble/suidouble-sample-app) |

Also take a look at sample Vue dapp application [source code](https://github.com/suidouble/suidouble-sample-app) or [check it online](https://suidouble-sample-app.herokuapp.com/).

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

If you need to transfer some SUI as part of executing contract method, you can use a magic parameter in form of {type: 'SUI', amount: 400000000000n} where 400000000000 is the amount of MIST you want to send. SuiPackageModule will convert this amount to Coin object using Transactions.SplitCoins method.

`amount: 400000000000n`, `amount: '400000000000'`, `amount: 400000000000` will work too

```javascript
const moveCallResult = await contract.moveCall('suidouble_chat', 'post_pay', [chatShopObjectId, {type: 'SUI', amount: 400000000000n}, messageText, 'metadata']);
```

@todo: sending other Coins

##### fetching objects

There's instance of SuiMemoryObjectStorage attached to every SuiMaster instance. Every smart contract method call adds created and mutated objects to it. You can also attach any object with it's address (id).

```javascript
contract.modules.modulename.pushObject('0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2');
await contract.modules.modulename.fetchObjects(); // fetch objects fields etc
const object = contract.modules.modulename.objectStorage.byAddress('0x10cded4f9df05e37b44e3be2ffa9004dec77786950719fad6083694fdca45bf2');
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

const provider = 'local';// or await SuiLocalTestValidator.launch({debug: true});

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

- subscribe to events
- sending other coins as contract methods execution
- suiobject invalidation/fetching optimization
- better documentation
- unit tests coverage to 90%+