const HivePlugin = require('libs/core/plugins/HivePlugin');
const HiveRaftEngine = require('libs/HiveDB/HiveRaftEngine');
const HiveRaftDiscoveryGlobal = require('libs/HiveDB/HiveRaftDiscoveryGlobal');

const globalRaft = Symbol("global_raft");
const raftGroups = Symbol("raft_groups");

// TODO: implement HiveCluster forwarding in HivePlugin
module.exports = class HiveDB extends HivePlugin {
    setup() {
        this[globalRaft] = new HiveRaftEngine(
            "HiveDB",
            HiveCluster.Nodes,
            {
                discovery: new HiveRaftDiscoveryGlobal(),
                onLeader: () => {
					this[globalRaft].db.metadata.findOne({_id: "metadata"}, (err, item) => {
						if(item.hiveDBinited)
							return;

						this[globalRaft].write("metadata", null, {
							$set: {
								hiveDBinited: true
							}
						});
					});
                },
				onFollower: () => {

				},
				onNodeAdded: (nodeID) => {
					this[globalRaft].write("data", "node/" + nodeID, {
						_id: "node/" + nodeID
					});
				},
				onNodeRemoved: (nodeID) => {
					this[globalRaft].delete({
						_id: "node/" + nodeID
					});
				}
			}
        );
    }
};
