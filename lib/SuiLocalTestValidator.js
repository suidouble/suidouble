import SuiCliCommands from "./SuiCliCommands.js";
import SuiCommonMethods from "./SuiCommonMethods.js";
import { SuiClient, getFullnodeUrl, SuiHTTPTransport } from '@mysten/sui/client';
import SuiUtils from "./SuiUtils.js";

export default class SuiLocalTestValidator extends SuiCommonMethods {
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

        this._epochDuration = params.epochDuration || null;

        this._providerName = 'sui:localnet';
    }

    get providerName() {
        return this._providerName;
    }

    get client() {
        if (this._providerName === 'sui:localnet') {
            return new SuiClient({
                    transport: new SuiHTTPTransport({
                        url: getFullnodeUrl('localnet'),
                        WebSocketConstructor: SuiUtils.WebSocketConstructor(),
                    }),
                });
        } else if (this._providerName === 'sui:devnet') {
            // if testFallbackEnabled == true and we can't start local node
            return new SuiClient({
                url: getFullnodeUrl('devnet'),
                WebSocketConstructor: SuiUtils.WebSocketConstructor(),
            });
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

    async isPortThere(port) {
        return await SuiCliCommands.isPortThere(port);
    }

    async waitForPort(port, timeout) {
        this.log('waiting for port', port);
        const startedCheckingAt = (new Date()).getTime();
        let portIsThere = false;
        do {
            portIsThere = await this.isPortThere(port);
            this.log('checking for port', port, 'is there:', portIsThere);
            if (!portIsThere) {
                await new Promise((res)=>setTimeout(res, 500));
            }
        } while (!portIsThere && (startedCheckingAt + timeout) > ((new Date()).getTime()));

        return portIsThere;
    }

    async launch() {
        if (this._active) {
            return this;
        }

        this.log('launching sui-test-validator (sui start)...');

        try {
            this.log('Trying to run "sui start"...');
            const params = [];
            params.push('start');
            params.push('--with-faucet');
            params.push('--force-regenesis');
            this._child = await SuiCliCommands.spawn('sui', params, { RUST_LOG: 'off,sui_node=info' });
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

        this._active = await this.waitForPort(9123, 30000);

        // await this.__readyLaunchedPromise;

        return this;
    }

    async stop() {
        if (this._child) {
            await this._child.kill();
        }
    }
};