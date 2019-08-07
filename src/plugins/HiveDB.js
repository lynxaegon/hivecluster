const HivePlugin = require('libs/core/plugins/HivePlugin');
const HiveDBEngine = require('libs/HiveDB/HiveDBEngine');

module.exports = class HiveDB extends HivePlugin {
    setup() {
        console.log("HiveDB Started!");
        // this.dbEngine = (new HiveDBEngine())
    }
};