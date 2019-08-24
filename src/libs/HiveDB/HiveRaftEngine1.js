const EventEmitter = require('events').EventEmitter;
const HiveDBEngine = require('./HiveDBEngine');
const HiveRaftStates = Object.freeze({
    CANDIDATE: 1,
    FOLLOWER: 2,
    LEADER: 3
});

class HiveRaftEngine extends EventEmitter {
    constructor(options) {
        super();
        this.state = HiveRaftStates.CANDIDATE;
        this.leaderID = false;

        this.options = HiveClusterModules.Utils.extend({
			global: true,
            group: "global"
		}, options);

        this.db = {
            metadata: new HiveDBEngine(this.options.group, "metadata", this.options.group),
            data: new HiveDBEngine(this.options.group, "data", this.options.group)
        };

        this.setup();
    }

    setup() {
        HiveCluster.Nodes.on("/system/hivenetwork/node/removed", (packet) => {
            Logger.log("Node removed", self.options.group, "leader", self.isLeader(packet.node.getID()));
            if(self.isLeader(packet.node.getID())){
                self.state = RaftStates.CANDIDATE;
            }
            self.db['metadata'].findOne({_id: 'metadata'}, function(err, item){
                self._errorCatcher(err);

                if(self.isLeader(packet.node.getID())){
                    this.leaderElection((leader) => {
                        if (leader == HiveCluster.id) {
                            self.promoteLeader(leader, packet.node.getID());
                        } else {
                            self.state = RaftStates.FOLLOWER;
                        }
                    });
                } else {
                    self.remove(packet.node.getID());
                }
            });
        });

        HiveCluster.on("/system/hiveraft/node/ready/" + this.options.group, (packet) => {
			if(packet.data && packet.data.sync){
				if(!this.isLeader()) {
					this.state = RaftStates.FOLLOWER;
					if(this.options.onFollower)
						this.options.onFollower.call(this, this.leaderID);
				}
			}
			if(this.isGlobal() && !this.leaderID){
				this.leaderElection(null, this.promoteLeader.bind(this));
				return;
			}

			if (!self.isLeader())
				return;

			this.initMetadata(packet.node).then(() => {
				this.initData(packet.node).then(() => {
					if(this.isLeader(packet.node.getID())){
						if(this.options.onNodeAdded)
							this.options.onNodeAdded.call(this, packet.node.getID());
						return false;
					}

                    packet.node.send(new HivePacket()
                        .setRequest("/system/hiveraft/node/ready/" + self.options.group)
                        .setData({
                            sync: true
                        })
                    ).then(() => {
                        if(this.options.onNodeAdded)
							this.options.onNodeAdded.call(this, packet.node.getID());
                    });
				});
			});
		});
    }

    add() {

    }

    remove(nodeID, leaderChanged){
        leaderChanged = leaderChanged || false;
        // only leaders are allowed to make changes to the DB
		if(this.isLeader()){
            // if the leader changed, we already did this part atomically (remove follower + leader update)
            if(!leaderChanged){
    			var query = {
    				$pull: {
    					followers: {
    						$in: [nodeID]
    					}
    				}
    			};
    			this.write("metadata", null, query);
            }

            if(this.isGlobal()){
                this.delete({
                    _id: "node/" + nodeID
                });

                if (this.options.onNodeRemoved)
                    this.options.onNodeRemoved.call(this, nodeID, leaderChanged);
            }
		}
    }

    isGlobal() {
        return this.options.group == "global";
    }

    isLeader(nodeID){
        return this.leaderID == nodeID;
    }

    setLeader(nodeID){
        this.promoteLeader(nodeID);
    }

    /**
	 *
	 * @param type
	 * @param id
	 * @param data
	 * @return {*}
	 */
	write(type, id, data){
		if(HiveClusterModules.Utils.isObject(id)){
			data = id;
			id = false;
		}

        if(type == "metadata"){
            id = "metadata";
        }
        if(!id){
            id = Utils.uuidv4();
        }

		return this.handle(this.db[type], this.packet(id, data, 'write'), false);
	},

    delete(query) {
        return this.handle(this.db["data"], this.packet(query._id, query, 'delete'), false);
    }

    handle(){

    }

    forward(){

    }

    send(){

    }

    getLeader() {

    }

    getFollowers(){

    }

    // TODO: check if needed
    getNodes(){

    }

    // TODO: check if needed
    getAllNodes() {

    }

    // TODO: check if needed
    getNode(){

    }

    promoteLeader(leader, removeFollower) {
        var query;
        Logger.log("Leader elected: " + this.options.group + " - ", leader, leader == HiveCluster.id);
        this.state = RaftStates.LEADER;
        this.leaderID = leader;

        query = {
            $pull: {
                followers: {
                    $in: []
                }
            },
            $set: {
                leader: leader
            }
        };
        query.$pull.followers.$in.push(leader);
        if(removeFolower)
            query.$pull.followers.$in.push(removeFolower);

        this.remove(removeFolower, true);

        this.write("metadata", null, query).then(() => {
            if(this.options.onLeader)
                this.options.onLeader.call(this, this.leaderID);
        });
    }

    packet(id, data, type){
        return {
            id: id,
            data: data,
            type: type,
            leader: this.leaderID
        };
    }

    _errorCatcher(err) {
		if(err){
			Logger.err("ERR", err);
			throw new Error("Fatal error when reading from db!");
			process.exit(-1);
		}
	}
}
module.exports = HiveRaftEngine;
