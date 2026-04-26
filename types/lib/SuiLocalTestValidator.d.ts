/** @typedef {import("@mysten/sui/grpc").SuiGrpcClient} SuiGrpcClient */
/**
 * Manages a local `sui start` test-validator process. The singleton pattern (`launch` / `stop`)
 * means only one validator runs per test suite even when called from multiple test files.
 *
 * When `testFallbackEnabled` is true and `sui start` fails (e.g. Sui CLI not installed),
 * the instance transparently switches to `sui:devnet` so tests can still run against a live node.
 */
export default class SuiLocalTestValidator extends SuiCommonMethods {
    /** @type {?SuiLocalTestValidator} */
    static __instance: SuiLocalTestValidator | null;
    /**
     * Launch the local sui node (singleton). If already running, returns the existing instance.
     * Don't forget to call `.stop()` after usage.
     *
     * @param {Object} [params]
     * @param {boolean} [params.testFallbackEnabled]
     * @param {?number} [params.epochDuration]
     * @returns {Promise<SuiLocalTestValidator>}
     */
    static launch(params?: {
        testFallbackEnabled?: boolean;
        epochDuration?: number | null;
    }): Promise<SuiLocalTestValidator>;
    /**
     * Stop the singleton local sui node if running.
     * @returns {Promise<void>}
     */
    static stop(): Promise<void>;
    /**
     * @param {Object} [params]
     * @param {boolean} [params.testFallbackEnabled] - fall back to devnet if the local node can't start
     * @param {?number} [params.epochDuration] - custom epoch duration in ms (only valid with `--force-regenesis`)
     * @param {boolean} [params.debug]
     */
    constructor(params?: {
        testFallbackEnabled?: boolean;
        epochDuration?: number | null;
        debug?: boolean;
    });
    /** @type {?Object} spawned child process */
    _child: any | null;
    /** @type {boolean} */
    _active: boolean;
    /**
     * When true, falls back to sui:devnet if the local node can't be started.
     * @type {boolean}
     */
    _testFallbackEnabled: boolean;
    /** @type {?number} */
    _epochDuration: number | null;
    /** @type {string} */
    _providerName: string;
    /** @returns {string} active chain identifier, e.g. `'sui:localnet'` or `'sui:devnet'` after fallback */
    get providerName(): string;
    /**
     * gRPC client for the currently active chain.
     * @returns {SuiGrpcClient}
     */
    get client(): SuiGrpcClient;
    /** @returns {boolean} true once the node is up and accepting transactions */
    get active(): boolean;
    /**
     * @param {number} port
     * @returns {Promise<boolean>} true if the port accepts a TCP connection within 3 seconds
     */
    isPortThere(port: number): Promise<boolean>;
    /**
     * Poll `isPortThere` every 500 ms until the port is open or the timeout elapses.
     * @param {number} port
     * @param {number} timeout - total wait time in ms
     * @returns {Promise<boolean>}
     */
    waitForPort(port: number, timeout: number): Promise<boolean>;
    /**
     * Start `sui start --with-faucet --with-indexer --with-graphql --force-regenesis`,
     * wait for the faucet (port 9123) and GraphQL (port 9125) to come up,
     * then return this instance with `active === true`.
     *
     * If `testFallbackEnabled` is set and the spawn fails, silently switches to devnet.
     *
     * @returns {Promise<SuiLocalTestValidator>}
     */
    launch(): Promise<SuiLocalTestValidator>;
    /**
     * Kill the child `sui start` process if it is running.
     * @returns {Promise<void>}
     */
    stop(): Promise<void>;
}
export type SuiGrpcClient = import("@mysten/sui/grpc").SuiGrpcClient;
import SuiCommonMethods from "./SuiCommonMethods.js";
