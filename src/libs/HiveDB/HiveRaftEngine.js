const util = require('util')
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
            raft: this,
            group: "global",
            discovery: false,
            hiveCluster: HiveCluster.Nodes
		}, options);

        this.db = {
            metadata: new HiveDBEngine(this.options.group, "metadata", this.options.group),
            data: new HiveDBEngine(this.options.group, "data", this.options.group)
        };

        if(this.options.discovery){
            this.options.discovery.init(this);
        }
    }

    add(nodeID) {
        if(!this.leaderID){
            this.leaderElection(this.promoteLeader.bind(this));
        } else {
            // init metadata and data
            this.initMetadata(nodeID).then(() => {
                this.initData(nodeID).then(() => {
                    if(this.isLeader(nodeID)){
						if(this.options.onNodeAdded)
							this.options.onNodeAdded.call(this, nodeID);
						return false;
					}
                });
            });
        }
        return true;
    }

    remove(nodeID){
        if(this.isLeader(nodeID)){
            this.leaderElection((leader) => {
                if (leader == HiveCluster.id) {
                    this.promoteLeader(leader);
                } else {
                    this.state = HiveRaftStates.FOLLOWER;
                }
            });
            return true;
        }
        // only leaders are allowed to make changes to the DB
		if(this.isLeader()){
            // if the leader changed, we already did this part atomically (remove follower + leader update)
            var query = {
                $pull: {
                    followers: {
                        $in: [nodeID]
                    }
                }
            };
            this.write("metadata", null, query);

            if(this.isGlobal()){
                this.delete({
                    _id: "node/" + nodeID
                });

                if (this.options.onNodeRemoved)
                    this.options.onNodeRemoved.call(this, nodeID, leaderChanged);
            }
		}
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
	}

    delete(query) {
        return this.handle(this.db["data"], this.packet(query._id, query, 'delete'), false);
    }

    handle() {
        console.log("handle:", util.inspect(arguments[1], {showHidden: false, depth: null}));
        return new Promise((resolve) => {
            console.log("should handle now!");
            resolve();
        });
    }

    // TODO: remove this!
    isGlobal() {
        return this.options.group == "global";
    }

    isLeader(nodeID) {
        if(!nodeID)
			return this.state == HiveRaftStates.LEADER;

        return this.leaderID == nodeID;
    }

    leaderElection(cb) {
        if(!HiveClusterModules.Utils.isFunction(cb))
    		return false;

        this.state = HiveRaftStates.CANDIDATE;
        if(this.isGlobal() && !this.leaderID){
             cb(this.options.hiveCluster.getLowestWeightedNode().getID());
             return true;
        }

    	this.getAllNodes((result) => {
    		if(!result){
    			throw new Error("No nodes found!!!");
    			process.exit(-1);
    		}

    		if(!result.followers) {
    			throw new Error("No followers to promote to leader!");
    			process.exit(-1);
    			return false;
    		}

            let nodes = this.options.hiveCluster.getNodes()
    		nodes.sort((a,b) => {
    			return a.getWeight() - b.getWeight();
    		});

    		let getIndex = (arr, id) => {
    			for(let i = 0; i < arr.length; i++){
    				if(arr[i].node.getID() == id)
    					return i;
    			}
    			return false;
    		};

    		(function elector(index){
    			if(index >= nodes.length){
    				throw new Error("No fully ready data nodes available! (metadata ready & data ready)");
    				process.exit(-1);
    			}

    			// console.log(result);

    			let nodeIndex = getIndex(result.followers, nodes[index].getID());
    			if(nodeIndex !== false){
    				if(this.isGlobal()){
    					cb(nodes[index].getID());
    					return true;
    				} else {
    					if(result.followers[nodeIndex].data.groups.indexOf(this.options.group) != -1){
    						cb(nodes[index].getID());
    						return true;
    					}
    				}
    			}
    			elector(index + 1);
    		})(0);
    	});
    }

    promoteLeader(leader) {
		let query;
		Logger.log("Leader elected: " + this.options.group + " - ", leader, leader == HiveCluster.id);
		if(leader == HiveCluster.id){
			this.state = HiveRaftStates.LEADER;
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

			this.write("metadata", null, query).then(() => {
				console.log("wrote after leader election!", this.leaderID, this.options.group);
				if(this.options.onLeader)
					this.options.onLeader.call(this, this.leaderID);
			});
		} else {
			this.state = HiveRaftStates.FOLLOWER;
		}
    }

    getAllNodes(callback){
		if(!HiveClusterModules.Utils.isFunction(callback)){
			return;
		}
		this.db["metadata"].findOne({_id: 'metadata'}, (err, result) => {
			this.errorCatcher(err);

			let nodes = {};
			let promises = [];
			if(!result) {
				callback(null);
				return false;
			}
			if(result.followers){
				for(let i = 0; i < result.followers.length; i++){
					promises.push(
						this.getNode(result.followers[i]).then((node) => {
							if(node == null)
								return;

							if(!nodes.followers)
								nodes.followers = [];
							nodes.followers.push(node);
						})
					);
				}
			}

			if(result.leader){
				promises.push(
					this.getNode(result.leader).then((node) => {
						if(node == null)
							return;
						nodes.leader = node;
					})
				);
			}

			Promise.all(promises).then(() => {
				if(Object.keys(nodes) == 0){
					callback(null);
				} else {
					callback(nodes);
				}
			});
		});
	}

    getNode(nodeID){
        return new Promise((resolve) => {
            let node = this.options.hiveCluster.getNodes((node) => {
				return node.getID() == nodeID;
			});
            if(node) {
                node = node[0];
                this.options.raft.db["data"].findOne({_id: "node/" + node.getID()}, (err, result) => {
                    this.errorCatcher(err);

                    resolve({
                        node: node,
                        data: result
                    });
                });
            }
            else {
                resolve(null);
                // Read this: this warning is normal, if we get a /removed node, we only remove followers instantly, leaders are first elected,
                // and then the old leader is removed!

                // Logger.err("HiveRaft Warning: Found node in DB(global) but not as socket. Id: " + identifier, new Error().stack);
            }
        });
    }

    initMetadata(nodeID) {
        let node = this.options.hiveCluster.getNodes((node) => {
            return node.getID() == nodeID;
        });
        if(node)
            node = node[0];

        return new Promise((resolve) => {
			this.write("metadata", null, {
				$push: {
					followers: node.getID()
				}
			}).then(() => {
				this.db["metadata"].findOne({_id: "metadata"}, (err, item) => {
					this.errorCatcher(err);

					this.send(node, this.db["metadata"], this.packet("metadata", item, "write"), resolve, reject);
				});
			});
		});
    }

    initData() {
        return new Promise((resolve) => {
            HiveClusterModules.Utils.readFromDBCursor(self.db["data"].find({}), function(err, item){
                this.errorCatcher(err);
                if(item == null) {
                    resolve();
                    return;
                }

                this.send(node, self.db["data"],
                    this.packet(item._id, item, "write"), () => {},
                    function(){
                        throw new Error("Failed to deliver part of the init packet: ", arguments);
                    }
                );
            });
        });
    }

    send(node, db, data, resolve, reject) {
		if(!data || !data.data) {
			reject("invalid data");
			return false;
		}

		if(HiveClusterModules.Utils.isArray(node) && node.length == 0 ) {
			resolve();
			return false;
		}

        node.send(new HivePacket()
            .setRequest("/hiveraft/" + db.getCollectionName() + "/" + self.options.group + "/write")
            .setData(data)
            .onReply(resolve)
            .onReplyFail(reject)
        );
    }

    packet(id, data, type){
		return {
			id: id,
			data: data,
			type: type,
			leader: this.leaderID
		};
    }

    errorCatcher(err){
		if(err){
			Logger.err("ERR", err);
			throw new Error("Fatal error when reading from db!");
			process.exit(-1);
		}
	}
}
module.exports = HiveRaftEngine;
