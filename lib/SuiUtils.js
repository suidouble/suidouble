import SuiCommonMethods from './SuiCommonMethods.js';
import { Inputs, Transaction } from '@mysten/sui/transactions';
import { bcs } from '@mysten/sui/bcs';
import { fromBase64 } from '@mysten/bcs';
import { SuiGrpcClient, GrpcWebFetchTransport } from '@mysten/sui/grpc';
import { SuiGraphQLClient } from '@mysten/sui/graphql';
import { normalizeSuiAddress } from '@mysten/sui/utils';

/**
 * @import { SuiClientTypes } from "@mysten/sui/client"
 * @typedef {import("@mysten/sui/transactions").Argument} Argument
 * @typedef {import("@mysten/sui/transactions").CallArg} CallArg
 * @typedef {{ Pure: { bytes: string } }} PureInput
 * @typedef {import("@mysten/sui/grpc").SuiGrpcClientOptions} SuiGrpcClientOptions
 * @typedef {import("@mysten/sui/grpc").GrpcWebOptions} GrpcWebOptions
 */

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
    static txInput(tx, typeOrInput, value = null) {
        if (typeOrInput && /** @type {any} */ (typeOrInput).Pure && /** @type {any} */ (typeOrInput).Pure.bytes) {
            return tx.pure(SuiUtils.pureInputToBytes(/** @type {PureInput} */ (typeOrInput)));
        } else {
            return tx.pure(SuiUtils.pureInputToBytes(/** @type {any} */ (SuiUtils.pureInput(/** @type {string} */ (typeOrInput), value))));
        }
    }

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
    static pureInput(type, value) {
        let typeNormalized = type;
        if (typeNormalized.toLowerCase() == 'address') {
            typeNormalized = 'Address';
        }

        if (bcs[typeNormalized]) {
            //
            if (typeof(bcs[typeNormalized]) == 'object') {
                // sui/bcs
                return Inputs.Pure(bcs[typeNormalized].serialize(value));
            } else {
                // bcs
                return Inputs.Pure(bcs[typeNormalized]().serialize(value));
            }
        } else {
            // may it be a "vector<x>" ?
            const splet = (''+typeNormalized).split('<');
            if (splet[0] == 'vector' && splet[1]) {
                const second = splet[1].split('>');
                if (second[0] && bcs[second[0]]) {
                    return Inputs.Pure(bcs.vector(bcs[second[0]]()).serialize(value));
                }
            }
        }

        throw new Error(`pureInput: unsupported type "${typeNormalized}"`);
    }

    /**
     * Convert sui's PureInput into bcs serialized bytes
     * @param {PureInput} pureInput
     */
    static pureInputToBytes(pureInput) {
        return fromBase64(pureInput.Pure.bytes);
    }

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
    static bytesFieldToString(value) {
        if (value == null) return '';
        if (typeof value === 'string') {
            return new TextDecoder().decode(fromBase64(value));
        }
        if (value instanceof Uint8Array) {
            return new TextDecoder().decode(value);
        }
        if (Array.isArray(value)) {
            return new TextDecoder().decode(new Uint8Array(value));
        }
        throw new Error('bytesFieldToString: unsupported value type');
    }

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
    static normalizeSuiAddress(address) {
        return normalizeSuiAddress(address);
    }

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
    static suiClientForRPC(network, transportOptions) {
        const transport = new GrpcWebFetchTransport(transportOptions);
        return new SuiGrpcClient({ network, transport });
    }

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
    static suiGraphQLClientFromGrpc(grpcClient, overrides = {}) {
        if (!grpcClient || !grpcClient.network) {
            throw new Error('grpcClient with a network is required');
        }

        const defaultUrls = {
            mainnet: 'https://sui-mainnet.mystenlabs.com/graphql',
            testnet: 'https://graphql.testnet.sui.io/graphql',
            devnet: 'https://graphql.devnet.sui.io/graphql',
            localnet: 'http://127.0.0.1:9125/graphql',
        };

        const url = overrides.url || defaultUrls[grpcClient.network];
        if (!url) {
            throw new Error(`no default GraphQL url for network "${grpcClient.network}" — pass overrides.url`);
        }

        return new SuiGraphQLClient({
            ...overrides,
            url,
            network: grpcClient.network,
        });
    }

    /**
     * Makes an instance for SuiGrpcClient for a specific chain, eg: 'mainnet' | 'testnet' | 'devnet' | 'localnet'
     * @param {SuiClientTypes.Network} network
     * @returns {SuiGrpcClient}
     */
    static suiClientFor(network) {
        // strip optional 'sui:' prefix so both 'mainnet' and 'sui:mainnet' work
        const normalized = SuiUtils.normalizeNetworkString(network) ?? network;
        const baseUrls = {
            mainnet: 'https://fullnode.mainnet.sui.io:443',
            testnet: 'https://fullnode.testnet.sui.io:443',
            devnet: 'https://fullnode.devnet.sui.io:443',
            localnet: 'http://127.0.0.1:9000',
        };
        return SuiUtils.suiClientForRPC(normalized, { baseUrl: baseUrls[normalized] });
    }

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
    static normalizeClient(clientParam) {
        if (!clientParam) {
            return null;
        }

        if (clientParam instanceof SuiGrpcClient) {
            return clientParam;
        }

        const network = SuiUtils._sniffNetwork(clientParam);
        if (!network) {
            return null;
        }

        return SuiUtils.suiClientFor(network);
    }

    /**
     * Strip an optional "sui:" prefix and map short aliases ('local', 'dev', 'test', 'main')
     * to full network names. Returns null if the string doesn't match a known network.
     *
     * @param {string} s
     * @returns {SuiClientTypes.Network | null}
     */
    static normalizeNetworkString(s) {
        if (typeof s !== 'string') return null;
        const normalized = s.toLowerCase().replace(/^sui:/, '');
        if (normalized === 'local' || normalized === 'localnet') return 'localnet';
        if (normalized === 'dev' || normalized === 'devnet') return 'devnet';
        if (normalized === 'test' || normalized === 'testnet') return 'testnet';
        if (normalized === 'main' || normalized === 'mainnet') return 'mainnet';
        return null;
    }

    /**
     * Extracts a SuiClientTypes.Network string from various inputs used historically by suidouble.
     *
     * @param {string | Object} clientParam
     * @returns {SuiClientTypes.Network | null}
     */
    static _sniffNetwork(clientParam) {
        if (typeof clientParam === 'string') {
            return SuiUtils.normalizeNetworkString(clientParam);
        }

        if (clientParam.constructor && clientParam.constructor.name === 'SuiLocalTestValidator') {
            return SuiUtils.normalizeNetworkString(clientParam.providerName) || 'localnet';
        }

        const fromNetwork = SuiUtils.normalizeNetworkString(clientParam.network);
        if (fromNetwork) return fromNetwork;

        const fromProvider = SuiUtils.normalizeNetworkString(clientParam.providerName);
        if (fromProvider) return fromProvider;

        const url = clientParam.endpoint
            || (clientParam.transport && clientParam.transport.websocketClient && clientParam.transport.websocketClient.endpoint)
            || (clientParam.connection && clientParam.connection.fullnode)
            || '';

        if (url.indexOf('devnet') !== -1) return 'devnet';
        if (url.indexOf('testnet') !== -1) return 'testnet';
        if (url.indexOf('mainnet') !== -1) return 'mainnet';
        if (url.indexOf('127.0.0.1') !== -1 || url.indexOf('localhost') !== -1) return 'localnet';

        return null;
    }

};
