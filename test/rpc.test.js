'use strict'

import t from 'tap';
import { SuiMaster, SuiLocalTestValidator, Transaction } from '../index.js';

import { fileURLToPath } from 'url';
import path from 'path';

const { test } = t;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


let suiMaster = null;

test('spawn local test node', async t => {
        const rpcClient = SuiMaster.SuiUtils.suiClientForRPC({
                chain: 'mainnet',
                url: 'https://fullnode.mainnet.sui.io',
                rpc: {
                    // headers: {"x-allthatnode-api-key": "xxxxxxxxxx"},
                }
            });
            
        const suiMaster = new SuiMaster({
                client: rpcClient,
                as: 'somebody', // pseudo-address
            });
        await suiMaster.initialize();

        t.ok(suiMaster.address); // there should be some address
        t.ok(`${suiMaster.address}`.indexOf('0x') === 0); // adress is string starting with '0x'


        const suiCoin = suiMaster.suiCoins.get('sui');
        await suiCoin.getMetadata();

        const balance = await suiCoin.getBalance('0xac5bceec1b789ff840d7d4e6ce4ce61c90d190a7f8c4f4ddf0bff6ee2413c33c');
        
        t.ok(balance > 0n);
});

test('stops', async t => {
});