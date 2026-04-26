export { normalizeSuiAddress };
/** Helpful methods using in different places of suidouble */
export default class SuiUtils extends SuiCommonMethods {
    /**
     * Attach the parameter input into transaction, to be used for moveCall
     * accepts an Inputs.Pure (result of .pureInput) or type + value directly
     *
     * @param {Transaction} tx
     * @param {string | PureInput} typeOrInput - string type name, or already-serialised Pure input `{ Pure: { bytes } }`
     * @param {*} [value]
     * @returns {Argument}
     */
    static txInput(tx: Transaction, typeOrInput: string | PureInput, value?: any): Argument;
    /**
     * Returns and Inputs.Pure for a given type
     *   to be used as moveCall parameters
     *   type is 'u8', 'u16', 'u32', 'u64', 'u128', 'u256', 'address', 'bool', 'string', 'vector<u8>' ... 'vector<u256>'
     *
     * result may be passed as arguments to SuiPackage or SuiPackageModule moveCall functions params array:
     *     contract.moveCall('suidouble_chat', 'reply', [
     *         SuiUtils.pureInput('string', 'metadata')
     *         SuiUtils.pureInput('string', 'metadata')
     *     ]);
     *
     * if you are going to construct tx yourself, you'd better use SuiUtils.txInput static method
     *
     * @param {string} type
     * @param {*} value
     * @returns {CallArg}
     */
    static pureInput(type: string, value: any): CallArg;
    /**
     * Convert sui's PureInput into bcs serialized bytes
     * @param {PureInput} pureInput
     */
    static pureInputToBytes(pureInput: PureInput): Uint8Array<ArrayBuffer>;
    /**
     * Decode a Move `vector<u8>` field into a UTF-8 string.
     *
     * Accepts the shapes SUI returns across representations:
     *   - base64 string (v2 gRPC/GraphQL JSON representation for byte vectors)
     *   - Uint8Array
     *   - array of numbers (legacy JSON-RPC shape)
     *
     * @param {string | Uint8Array | number[]} value
     * @returns {string}
     */
    static bytesFieldToString(value: string | Uint8Array | number[]): string;
    /**
     * Wrapper for sui's utils normalizeSuiAddress
     * Perform the following operations:
     * <pre>
     * 1. Make the address lower case
     * 2. Prepend `0x` if the string does not start with `0x`.
     * 3. Add more zeros if the length of the address(excluding `0x`) is less than `SUI_ADDRESS_LENGTH`
     * </pre>
     *
     * @param {string} address
     * @returns string
     */
    static normalizeSuiAddress(address: string): string;
    /**
     * Makes an instance of SuiGrpcClient pointed at a custom gRPC-web endpoint.
     *
     * `transportOptions` is passed through to GrpcWebFetchTransport — the same shape
     * as `@protobuf-ts/grpcweb-transport`'s GrpcWebOptions:
     *   - baseUrl   : string   — required, the gRPC-web endpoint
     *   - format    : 'text' | 'binary' — wire format, defaults to 'text'
     *   - fetchInit : RequestInit-ish — extra fetch options (credentials, cache, ...); `body`/`headers`/`method`/`signal` are reserved
     *   - fetch     : typeof fetch — custom fetch implementation (useful for proxies, auth, logging)
     *
     * @example
     * const client = SuiUtils.suiClientForRPC('mainnet', {
     *     baseUrl: 'https://fullnode.mainnet.sui.io:443',
     *     format: 'binary',
     *     fetchInit: { credentials: 'include' },
     *     fetch: (url, init) => fetch(url, { ...init, headers: { ...init.headers, 'x-api-key': 'xxx' } }),
     * });
     *
     * @param {SuiClientTypes.Network} network
     * @param {GrpcWebOptions} transportOptions
     * @returns {SuiGrpcClient}
     */
    static suiClientForRPC(network: SuiClientTypes.Network, transportOptions: GrpcWebOptions): SuiGrpcClient;
    /**
     * Build a SuiGraphQLClient reusing the network of an existing SuiGrpcClient.
     *
     * Picks the default Sui GraphQL endpoint for the network unless `overrides.url` is set.
     * `overrides` is forwarded to SuiGraphQLClient (fetch, headers, queries, mvr, url).
     *
     * @param {SuiGrpcClient} grpcClient
     * @param {Object} [overrides]
     * @param {?string} [overrides.url]
     * @param {?typeof fetch} [overrides.fetch]
     * @param {?Object.<string, string>} [overrides.headers]
     * @returns {SuiGraphQLClient}
     */
    static suiGraphQLClientFromGrpc(grpcClient: SuiGrpcClient, overrides?: {
        url?: string | null;
        fetch?: typeof fetch | null;
        headers?: {
            [x: string]: string;
        } | null;
    }): SuiGraphQLClient;
    /**
     * Makes an instance for SuiGrpcClient for a specific chain, eg: 'mainnet' | 'testnet' | 'devnet' | 'localnet'
     * @param {SuiClientTypes.Network} network
     * @returns {SuiGrpcClient}
     */
    static suiClientFor(network: SuiClientTypes.Network): SuiGrpcClient;
    /**
     * Normalize client parameter into a SuiGrpcClient, accepting:
     *   - an existing SuiGrpcClient instance
     *   - a SuiLocalTestValidator instance
     *   - a string chain name: 'local' | 'localnet' | 'dev' | 'devnet' | 'test' | 'testnet' | 'main' | 'mainnet'
     *   - a legacy client object (sniffs network from endpoint / connection.fullnode / providerName)
     *
     * @param {SuiGrpcClient | string | Object} clientParam
     * @returns {SuiGrpcClient | null}
     */
    static normalizeClient(clientParam: SuiGrpcClient | string | any): SuiGrpcClient | null;
    /**
     * Strip an optional "sui:" prefix and map short aliases ('local', 'dev', 'test', 'main')
     * to full network names. Returns null if the string doesn't match a known network.
     *
     * @param {string} s
     * @returns {SuiClientTypes.Network | null}
     */
    static normalizeNetworkString(s: string): SuiClientTypes.Network | null;
    /**
     * Extracts a SuiClientTypes.Network string from various inputs used historically by suidouble.
     *
     * @param {string | Object} clientParam
     * @returns {SuiClientTypes.Network | null}
     */
    static _sniffNetwork(clientParam: string | any): SuiClientTypes.Network | null;
}
export type Argument = import("@mysten/sui/transactions").Argument;
export type CallArg = import("@mysten/sui/transactions").CallArg;
export type PureInput = {
    Pure: {
        bytes: string;
    };
};
export type SuiGrpcClientOptions = import("@mysten/sui/grpc").SuiGrpcClientOptions;
export type GrpcWebOptions = import("@mysten/sui/grpc").GrpcWebOptions;
import { normalizeSuiAddress } from '@mysten/sui/utils';
import SuiCommonMethods from './SuiCommonMethods.js';
import { Transaction } from '@mysten/sui/transactions';
import type { SuiClientTypes } from "@mysten/sui/client";
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
