// const { spawn } = require('child_process');
const SuiCliCommands = require('./SuiCliCommands.js');
const SuiCommonMethods = require('./SuiCommonMethods.js');

class SuiLocalTestValidator extends SuiCommonMethods {
    constructor(params = {}) {
        super(params);

        this._child = null;
        this._active = false;
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
        if (this._child && this._active) {
            return true;
        }

        this.log('launching sui-test-validator ...');

        this._child = await SuiCliCommands.spawn('sui-test-validator', { RUST_LOG: 'consensus=off' });
        
        // spawn('sui-test-validator', [], {
        //     env: {
        //         ...process.env,
        //         RUST_LOG: 'consensus=off',
        //     }
        // });

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