const SuiMaster = require('./lib/SuiMaster.js');
const SuiInBrowser = require('./lib/SuiInBrowser.js');
const SuiTestScenario = require('./lib/SuiTestScenario.js');
const SuiObject = require('./lib/SuiObject.js');
const SuiLocalTestValidator = require('./lib/SuiLocalTestValidator.js');
const sui = require('@mysten/sui.js');

module.exports = {
    SuiMaster,
    SuiObject,
    SuiInBrowser,
    SuiTestScenario,
    SuiLocalTestValidator,
    MIST_PER_SUI: SuiMaster.MIST_PER_SUI,

    TransactionBlock: sui.TransactionBlock,
    Transactions: sui.Transactions,
};