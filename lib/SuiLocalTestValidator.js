import SuiCliCommands from "./SuiCliCommands.js";
import SuiCommonMethods from "./SuiCommonMethods.js";
import SuiUtils from "./SuiUtils.js";

/** @typedef {import("@mysten/sui/grpc").SuiGrpcClient} SuiGrpcClient */

/**
 * Manages a local `sui start` test-validator process. The singleton pattern (`launch` / `stop`)
 * means only one validator runs per test suite even when called from multiple test files.
 *
 * When `testFallbackEnabled` is true and `sui start` fails (e.g. Sui CLI not installed),
 * the instance transparently switches to `sui:devnet` so tests can still run against a live node.
 */
export default class SuiLocalTestValidator extends SuiCommonMethods {
    /**
     * @param {Object} [params]
     * @param {boolean} [params.testFallbackEnabled] - fall back to devnet if the local node can't start
     * @param {?number} [params.epochDuration] - custom epoch duration in ms (only valid with `--force-regenesis`)
     * @param {boolean} [params.debug]
     */
    constructor(params = {}) {
        super(params);

        /** @type {?Object} spawned child process */
        this._child = null;
        /** @type {boolean} */
        this._active = false;

        /**
         * When true, falls back to sui:devnet if the local node can't be started.
         * @type {boolean}
         */
        this._testFallbackEnabled = !!params.testFallbackEnabled;

        /** @type {?number} */
        this._epochDuration = params.epochDuration || null;

        /** @type {string} */
        this._providerName = 'sui:localnet';
    }

    /** @returns {string} active chain identifier, e.g. `'sui:localnet'` or `'sui:devnet'` after fallback */
    get providerName() {
        return this._providerName;
    }

    /** @type {?SuiLocalTestValidator} */
    static __instance = null;

    /**
     * gRPC client for the currently active chain.
     * @returns {SuiGrpcClient}
     */
    get client() {
        if (this._providerName === 'sui:localnet') {
            return SuiUtils.suiClientFor('localnet');
        } else if (this._providerName === 'sui:devnet') {
            // if testFallbackEnabled == true and we can't start local node
            return SuiUtils.suiClientFor('devnet');
        }
    }

    /** @returns {boolean} true once the node is up and accepting transactions */
    get active() {
        return this._active;
    }

    /**
     * Launch the local sui node (singleton). If already running, returns the existing instance.
     * Don't forget to call `.stop()` after usage.
     *
     * @param {Object} [params]
     * @param {boolean} [params.testFallbackEnabled]
     * @param {?number} [params.epochDuration]
     * @returns {Promise<SuiLocalTestValidator>}
     */
    static async launch(params = {}) {
        if (SuiLocalTestValidator.__instance) {
            return await SuiLocalTestValidator.__instance.launch();
        }

        SuiLocalTestValidator.__instance = new SuiLocalTestValidator(params);
        return await SuiLocalTestValidator.__instance.launch();
    }

    /**
     * Stop the singleton local sui node if running.
     * @returns {Promise<void>}
     */
    static async stop() {
        if (SuiLocalTestValidator.__instance) {
            return await SuiLocalTestValidator.__instance.stop();
        }
    }

    /**
     * @param {number} port
     * @returns {Promise<boolean>} true if the port accepts a TCP connection within 3 seconds
     */
    async isPortThere(port) {
        return await SuiCliCommands.isPortThere(port);
    }

    /**
     * Poll `isPortThere` every 500 ms until the port is open or the timeout elapses.
     * @param {number} port
     * @param {number} timeout - total wait time in ms
     * @returns {Promise<boolean>}
     */
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

    /**
     * Start `sui start --with-faucet --with-indexer --with-graphql --force-regenesis`,
     * wait for the faucet (port 9123) and GraphQL (port 9125) to come up,
     * then return this instance with `active === true`.
     *
     * If `testFallbackEnabled` is set and the spawn fails, silently switches to devnet.
     *
     * @returns {Promise<SuiLocalTestValidator>}
     */
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
            params.push('--with-indexer');
            params.push('--with-graphql');
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

        // @ts-ignore — process is a Node.js global; not available in TypeScript without @types/node
        process.on('exit', ()=>{
            if (this._child) {
                this._child.kill();
            }
        });
        // @ts-ignore
        const cleanExit = function() { process.exit() };
        // @ts-ignore
        process.on('SIGINT', cleanExit); // catch ctrl-c
        // @ts-ignore
        process.on('SIGTERM', cleanExit); // catch kill

        this._active = await this.waitForPort(9123, 30000);

        if (this._active) {
            const graphqlUp = await this.waitForPort(9125, 30000);
            if (!graphqlUp) {
                this.log('warning: GraphQL port 9125 did not come up in time');
            }
        }

        // await this.__readyLaunchedPromise;

        return this;
    }

    /**
     * Kill the child `sui start` process if it is running.
     * @returns {Promise<void>}
     */
    async stop() {
        if (this._child) {
            await this._child.kill();
        }
    }
};