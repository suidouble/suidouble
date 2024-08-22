const SuiMaster = require('./lib/SuiMaster.js');
const SuiInBrowser = require('./lib/SuiInBrowser.js');
const SuiTestScenario = require('./lib/SuiTestScenario.js');
const SuiObject = require('./lib/SuiObject.js');
const SuiUtils = require('./lib/SuiUtils.js');
const SuiLocalTestValidator = require('./lib/SuiLocalTestValidator.js');
const { Transaction, Commands } = require('@mysten/sui/transactions');
const { bcs } = require('@mysten/sui/bcs');

module.exports = {
    SuiMaster,
    SuiObject,
    SuiInBrowser,
    SuiTestScenario,
    SuiLocalTestValidator,
    MIST_PER_SUI: SuiMaster.MIST_PER_SUI,
    Transaction: Transaction,
    Commands: Commands,
    SuiUtils: SuiUtils,
    txInput: SuiUtils.txInput,
    bcs,
};