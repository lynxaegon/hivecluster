const HivePlugin = require('libs/core/plugins/HivePlugin');
const HiveDBEngine = require('libs/HiveDB/HiveDBEngine');
const HiveRaftEngine = require('libs/HiveDB/HiveRaftEngine');

const globalRaft = Symbol("global_raft");
const raftGroups = Symbol("raft_groups");

module.exports = class HiveDB extends HivePlugin {
    setup() {
        console.log("HiveDB Started!");
        this[globalRaft] = new HiveRaftEngine();
        this[globalRaft].on("ready", () => {
           console.log("GlobalRaft initialized.");
        });
        // this.dbEngine = (new HiveDBEngine("test.db", "data", "@~@"));
        // this.dbEngine.write({
        //     id: "1234",
        //     data: {
        //         aaa: "bbb"
        //     }
        // }).then(() => {
        //     console.log("write done!");
        //
        // });
    }
};