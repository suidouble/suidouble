'use strict'

import t from 'tap';
import { SuiMaster, SuiLocalTestValidator } from '../index.js';

import { fileURLToPath } from 'url';
import path from 'path';

const { test } = t;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PACKAGE_PATH = path.join(__dirname, './test_move_contracts/suidouble_chat/');

let suiLocalTestValidator = null;
let suiMaster = null;
let contract = null;


test('getModulesNamesFromBuild — reads module names from compiled artifacts', async t => {
    suiMaster = new SuiMaster({ client: 'local', as: 'somebody' });
    contract = suiMaster.addPackage({ path: PACKAGE_PATH });
    await contract.build();

    const names = await contract.getModulesNamesFromBuild();

    // returns an array
    t.ok(Array.isArray(names), 'returns an array');

    // at least one module
    t.ok(names.length > 0, 'at least one module found');

    // expected module is present
    t.ok(names.includes('suidouble_chat'), 'includes suidouble_chat');

    // every entry is a non-empty string with no .mv suffix
    for (const name of names) {
        t.ok(typeof name === 'string' && name.length > 0, `module name "${name}" is a non-empty string`);
        t.notOk(name.endsWith('.mv'), `module name "${name}" has no .mv suffix`);
    }
});
