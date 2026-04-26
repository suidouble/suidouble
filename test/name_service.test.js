'use strict'

import t from 'tap';
import { SuiMaster } from '../index.js';

const { test } = t;

const KNOWN_ADDRESS = '0x1eb7c57e3f2bd0fc6cb9dcffd143ea957e4d98f805c358733f76dee0667fe0b1';
const KNOWN_NAME = 'adeniyi.sui';

test('defaultNameServiceName — returns null when no address connected', async t => {
    const suiMaster = new SuiMaster({ client: 'mainnet' });
    await suiMaster.initialize();

    const name = await suiMaster.defaultNameServiceName();
    t.equal(name, null, 'returns null in read-only mode (no address connected)');
});

test('defaultNameServiceName — resolves the primary name for a known address', async t => {
    const suiMaster = new SuiMaster({ client: 'mainnet' });
    await suiMaster.initialize();

    suiMaster._address = KNOWN_ADDRESS;

    const name = await suiMaster.defaultNameServiceName();

    t.equal(name, `${KNOWN_NAME}`, `resolved name is exactly "${KNOWN_NAME}"`);
});
