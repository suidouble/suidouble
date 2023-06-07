// const { spawn } = require('child_process');
const SuiCliCommands = require('./SuiCliCommands.js');
const SuiCommonMethods = require('./SuiCommonMethods.js');
const { JsonRpcProvider, localnetConnection, devnetConnection } = require('@mysten/sui.js');

class SuiLocalTestValidator extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._child = null;
        this._active = false;

        this._testFallbackEnabled = false;
        if (params.testFallbackEnabled) { 
            // option for unit tests to fallback to sui:dev network in case 
            // there is no local validator installed
            this._testFallbackEnabled = true;
        }

        this._providerName = 'sui:localnet';
    }

    get providerName() {
        return this._providerName;
    }

    get provider() {
        if (this._providerName === 'sui:localnet') {
            return new JsonRpcProvider(localnetConnection);
        } else if (this._providerName === 'sui:devnet') {
            // if testFallbackEnabled == true and we can't start local node
            return new JsonRpcProvider(devnetConnection);
        }
    }

    get active() {
        return this._active;
    }

    static async launch(params = {}) {
        if (SuiLocalTestValidator.__instance) {
            return await SuiLocalTestValidator.__instance.launch();
        }

        SuiLocalTestValidator.__instance = new SuiLocalTestValidator(params);
        return await SuiLocalTestValidator.__instance.launch();
    }

    static async stop() {
        if (SuiLocalTestValidator.__instance) {
            return await SuiLocalTestValidator.__instance.stop();
        }
    }

    async launch() {
        if (this._active) {
            return this;
        }

        this.log('launching sui-test-validator ...');

        try {
            this._child = await SuiCliCommands.spawn('sui-test-validator', { RUST_LOG: 'consensus=off' });
        } catch (e) {
            if (this._testFallbackEnabled) {
                // can't start local node. Let's switch to sui:dev
                this.log('can not start local node. Fallback to sui:dev...');

                this._child = null;
                this._active = true;
                this._providerName = 'sui:devnet';

                return this;
            } else {
                throw e;
            }
        }

        this.__readyLaunchedPromiseResolver = null;
        this.__readyLaunchedPromise = new Promise((res)=>{
            this.__readyLaunchedPromiseResolver = res;
        });

        this._child.stdout.on('data', (data) => {
            this.log(`stdout:\n${data}`);
            if ((`${data}`).indexOf('Fullnode RPC URL') !== -1) {
                this._active = true;

                this.log('sui-test-validator launched');
                this.__readyLaunchedPromiseResolver();
            }
        });
        
        this._child.stderr.on('data', (data) => {
            this.log(`stderr: ${data}`);
        });
        
        this._child.on('error', (error) => {
            this.log(`error: ${error.message}`);
        });
        
        this._child.on('close', (code) => {
            this._active = false;
            this.log(`child process exited with code ${code}`);
        });

        process.on('exit', ()=>{
            if (this._child) {
                this._child.kill();
            }
        });
        const cleanExit = function() { process.exit() };
        process.on('SIGINT', cleanExit); // catch ctrl-c
        process.on('SIGTERM', cleanExit); // catch kill

        await this.__readyLaunchedPromise;

        return this;
    }

    async stop() {
        if (this._child) {
            await this._child.kill();
        }
    }
}

module.exports = SuiLocalTestValidator;