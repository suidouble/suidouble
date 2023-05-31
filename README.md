# suidouble

Set of provider, package and object classes for javascript representation of Sui's smart contracts. Use same code for publishing, upgrading, integration testing, interaction with smart contracts and integration in browser dapps. Very alpha for now.

### installation

```
npm install suidouble --save
```

### usage

Main class to interact with blockchain is SuiMaster:

```javascript
const { SuiMaster } = require('suidouble');
```

You can initialize it directly, if you have keypair, secret phrase and can use it in code (so on node.js side - server side or CLI apps):
```javascript
const suiMaster = new SuiMaster({
    keypair: Ed25519Keypair,
    provider: 'test', // 'test', 'dev', 'local', 'main' or instance of this lib's SuiLocalTestValidator, or instance of Sui's JsonRpcProvider 
});
const suiMaster = new SuiMaster({
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
const suiInBrowser = SuiInBrowser.getSingleton();
/// ...
suiInBrowser.addEventListener('connected', async()=>{
    const connectedSuiMaster = await suiInBrowser.getSuiMaster(); // can post transactions now
    console.log('read-write on', suiInBrowser.getCurrentChain(), 'as', suiMaster.address);
});
suiInBrowser.connect(adapter);
```

### publishing the package

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

    const res = await contract.moveCall('chat', 'post', ['somedata', [3,24,55], 'anotherparam']);
    console.log(res);
    for (const object of res.created) {
        console.log('created', object.address, 'with type of', object.typeName);
    }
});

```
