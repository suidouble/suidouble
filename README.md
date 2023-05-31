# suidouble

Set of provider, package and object classes for javascript representation of Sui's smart contracts. Use same code for publishing, upgrading, integration testing, interaction with smart contracts and integration in browser dapps. Very alpha for now.

- [Installation](#installation)
- [Usage](#usage)
    - [Connecting](#connecting)
    - [Attaching a package](#attaching-a-package)
    - [Interacting with smart contract](#interacting-with-smart-contract)
- [Publishing the package](#publishing-the-package)
- [Upgrading the package](#upgrading-the-package)
- [Writing Sue Move intergration tests](#sui-move-integration-testing)
- [Connecting web3 dapps to Sui](#sui-move-connect-in-browser)


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

Take a look at more detailed [web3 connect code](#sui-move-connect-in-browser)

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
