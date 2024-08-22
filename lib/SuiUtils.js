const SuiCommonMethods = require('./SuiCommonMethods.js');
const { Inputs, Transaction, Argument } = require('@mysten/sui/transactions');
const { bcs } = require('@mysten/sui/bcs');
const { fromB64 } = require('@mysten/bcs');
const { SuiClient, getFullnodeUrl, SuiHTTPTransport } = require('@mysten/sui/client');
const { normalizeSuiAddress } = require('@mysten/sui/utils');

const WebSocketClient = require('websocket').w3cwebsocket;

/** Helpful methods using in different places of suidouble */
class SuiUtils extends SuiCommonMethods {

    /**
     * Attach the parameter input into transaction, to be used for moveCall
     * accepts an Inputs.Pure (result of .pureInput) or type + value directly
     * 
     * @param {Transaction} tx 
     * @param {string | Inputs.Pure} typeOrInput 
     * @param {?Argument} value 
     * @returns Argument
     */
    static txInput(tx, typeOrInput, value = null) {
        if (typeOrInput && typeOrInput.Pure && typeOrInput.Pure.bytes) {
            return tx.pure(SuiUtils.pureInputToBytes(typeOrInput));
        } else {
            return tx.pure(SuiUtils.pureInputToBytes(SuiUtils.pureInput(typeOrInput, value)));
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
     * @param {value} value 
     * @returns Inputs.Pure
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
    }

    /**
     * Convert sui's PureInput into bcs serialized bytes
     * @param {Inputs.Pure} pureInput 
     */
    static pureInputToBytes(pureInput) {
        return fromB64(pureInput.Pure.bytes);
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
     * As SUI removed websocket dependency for a node, we'll have it here as constructor wrapper
     *   returning native WebSocket in browser and websocket's w3cwebsocket in node
     * @returns WebSocketClient
     */
    static WebSocketConstructor() {
        return WebSocketClient;
    }

    /**
     * Makes an instance for SuiClient for a specific chain, eg: 'mainnet'
     * @param {string} chainname 
     * @returns SuiClient
     */
    static suiClientFor(chainname) {
        return new SuiClient({
            transport: new SuiHTTPTransport({
                url: getFullnodeUrl(chainname),
                WebSocketConstructor: SuiUtils.WebSocketConstructor(),
            }),
        });
    }

    /**
     * Normalize SuiClient parameter, accepting:
     *   - different previous versions of sui.js library, 
     *   - object of SuiClient class
     *   - object of SuiLocalTestValidator class
     *   - string of the chain name to connect to
     * 
     * @param {SuiClient} client 
     */
    static normalizeClient(clientParam) {
        let client = null;
        let providerName = null;
        
        if (clientParam) {
            if (clientParam == 'local' || (clientParam.constructor && clientParam.constructor.name && clientParam.constructor.name == 'SuiLocalTestValidator')) {
                if (clientParam == 'local') {
                    client = SuiUtils.suiClientFor('localnet');
                    providerName = 'sui:localnet'; 
                } else {
                    // SuiLocalTestValidator
                    providerName = clientParam.providerName;
                    client = clientParam.client;
                }
            } else if (clientParam == 'test' || clientParam == 'testnet') {
                client = SuiUtils.suiClientFor('testnet');
                providerName = 'sui:testnet';
            } else if (clientParam == 'dev' || clientParam == 'devnet') {
                client = SuiUtils.suiClientFor('devnet');
                providerName = 'sui:devnet';
            } else if (clientParam == 'main' || clientParam == 'mainnet') {
                client = SuiUtils.suiClientFor('mainnet');
                providerName = 'sui:mainnet';
            } else {
                if (clientParam && clientParam.constructor && (clientParam.endpoint || clientParam.transport)) {
                    client = clientParam;
                    let url = '';
                    if (clientParam.endpoint) {
                        // workaround set in SuiInBrowserAdapter
                        url = clientParam.endpoint;
                    } else if (clientParam.transport && clientParam.transport.websocketClient && clientParam.transport.websocketClient.endpoint) {
                        url = clientParam.transport.websocketClient.endpoint;
                    }

                    if (url.indexOf('devnet') !== -1) {
                        providerName = 'sui:devnet';
                    } else if (url.indexOf('testnet') !== -1) {
                        providerName = 'sui:testnet';
                    } else if (url.indexOf('mainnet') !== -1) {
                        providerName = 'sui:mainnet';
                    } else if (url.indexOf('127.0.0.1') !== -1) {
                        providerName = 'sui:localnet';
                    } else {
                        // just keep provider name as unique to fullnode URL to keep separate ObjectStorage instances
                        providerName = url.split('//')[1];
                    }
                } else if (clientParam && clientParam.connection && clientParam.connection.fullnode) {
                    client = clientParam;

                    if (clientParam.connection.fullnode.indexOf('devnet') !== -1) {
                        providerName = 'sui:devnet';
                    } else if (clientParam.connection.fullnode.indexOf('testnet') !== -1) {
                        providerName = 'sui:testnet';
                    } else if (clientParam.connection.fullnode.indexOf('mainnet') !== -1) {
                        providerName = 'sui:mainnet';
                    } else if (clientParam.connection.fullnode.indexOf('127.0.0.1') !== -1) {
                        providerName = 'sui:localnet';
                    } else {
                        // just keep provider name as unique to fullnode URL to keep separate ObjectStorage instances
                        providerName = clientParam.connection.fullnode;
                    }
                }
            }
        }

        if (client) {
            client.providerName = providerName;
            return client;
        }

        return null;
    }

};

module.exports = SuiUtils;