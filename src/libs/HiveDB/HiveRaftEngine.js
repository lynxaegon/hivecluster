const EventEmitter = require('events').EventEmitter;
const HiveDBEngine = require('./HiveDBEngine');
const HiveRaftStates = Object.freeze({
    CANDIDATE: 1,
    FOLLOWER: 2,
    LEADER: 3
});
const HiveQueue = require('libs/queues/HiveQueue');

class HiveRaftEngine extends EventEmitter {
    constructor(raftID, hiveCluster, options) {
        super();

        this.nodeList = [];
		this.handleQueue = false;
        this.hiveCluster = hiveCluster;
		this.state = HiveRaftStates.CANDIDATE;
        this.leaderID = false;

        this.raftID = raftID;
        this.options = HiveClusterModules.Utils.extend({
            raft: this,
			collection: "default",
            group: "__global__",
            discovery: false
		}, options);

        this.db = {
            metadata: new HiveDBEngine(this.options.collection, "metadata", this.options.group),
            data: new HiveDBEngine(this.options.collection, "data", this.options.group)
        };

		setInterval(() => {
        	console.log("===============");
			this.db.metadata.findOne({_id: "metadata"}, (err, item) => {
				this.errorCatcher(err);

				if(item !== null) {
					console.log("metadata", item);
				}
			});
			HiveClusterModules.Utils.readFromDBCursor(this.db["data"].find({}), (err, item) => {
				this.errorCatcher(err);

				if(item !== null) {
					console.log("data", item);
				}
			});
		}, 1000);

        this.setup();

        if(this.options.discovery){
            this.options.discovery.init(this);
        }
    }

    setup() {
		this.hiveCluster.on("/system/node/removed", (node) => {
			this.removeNode(node);
		});

		this.hiveCluster.on("/hiveraft/" + this.raftID + "/ready/" + this.options.group, (packet) => {
			if(this.options.onFollower)
				this.options.onFollower.call(this, this.leaderID);
		});
		this.hiveCluster.on("/hiveraft/" + this.raftID + "/" + this.db.metadata.getType() + "/" + this.options.group + "/write", (packet) => {
			this.handle(this.db.metadata, packet.data, packet.node.getID()).then(() => {
				packet.reply();
			});
		});
		this.hiveCluster.on("/hiveraft/" + this.raftID + "/" + this.db.data.getType() + "/" + this.options.group + "/write", (packet) => {
			this.handle(this.db.data, packet.data, packet.node.getID()).then(() => {
				packet.reply();
			});
		});
	}

	addNodes(nodes){
    	if(!nodes)
    		return;

    	if(!HiveClusterModules.Utils.isArray(nodes))
    		nodes = [nodes];

		let idx;
		for(let node of nodes){
			idx = this.nodeList.indexOf(node);
			if(idx !== -1){
				nodes.splice(idx, 1);
			}
		}

		this.nodeList = this.nodeList.concat(nodes);
		for(let node of nodes){
			this.processNode(node.getID());
		}

	}

	processNode(nodeID) {
    	if(!this.leaderID){
			this.leaderElection(this.promoteLeader.bind(this));
		} else if(this.isLeader()) {
            // init metadata and data
            this.initMetadata(nodeID).then(() => {
                this.initData(nodeID).then((node) => {
					node.send(new HivePacket()
						.setRequest("/hiveraft/" + this.raftID + "/ready/" + this.options.group)
						.setData({
							sync: true
						})
					);
					if (this.options.onNodeAdded)
						this.options.onNodeAdded.call(this, node.getID());
                });
            });
        }

		return true;
    }

    removeNode(node, leaderChanged){
		let idx = this.nodeList.indexOf(node);
		if(idx !== -1){
			this.nodeList.splice(idx, 1);
		}

        if(this.isLeader(node.getID())) {
            this.leaderElection((leader) => {
                if (leader == HiveCluster.id) {
                    this.promoteLeader(leader, node.getID());

                    // if the leader changed, reapply the change so the leader knows about the removal
                    this.removeNode(node, true);
                } else {
                	this.changeState(HiveRaftStates.FOLLOWER);
                }
            });
            return true;
        }

        // only leaders are allowed to make changes to the DB
		if(this.isLeader()){
            // if the leader changed, we already did this part atomically (remove follower + leader update)
			if(!leaderChanged) {
				let query = {
					$pull: {
						followers: {
							$in: [node.getID()]
						}
					}
				};
				this.write("metadata", null, query);
			}

			if (this.options.onNodeRemoved)
				this.options.onNodeRemoved.call(this, node.getID());
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
            id = HiveClusterModules.Utils.uuidv4();
        }

		return this.handle(this.db[type], this.packet(id, data, 'write'), false);
	}

    delete(query) {
        return this.handle(this.db["data"], this.packet(query._id, query, 'delete'), false);
    }

    handle(db, packet, from, resolveFnc, rejectFnc) {
		// console.log("handle:", util.inspect(arguments[1], {showHidden: false, depth: null}));
        if(!this.handleQueue){
			this.handleQueue = new HiveQueue((item) => {
				return new Promise((resolve, reject) => {
					item.db[item.packet.type](item.packet).then(() => {
						this.getAllNodes((result) => {
							if(!result || !result.followers) {
								if(item.resolve)
									item.resolve();

								resolve();
								return;
							}

							let nodes = [];
							for(let node of result.followers){
								nodes.push(node.node);
							}
							this.send(nodes, item.db, item.packet, () => {
								if(item.resolve)
									item.resolve();

								resolve();
							}, () => {
								if(item.reject)
									item.reject();

								reject();
							});
						});
					});
				});
			});
		}

        return new Promise((resolve) => {
        	if(!resolveFnc)
        		resolveFnc = resolve;
			this.leaderID = packet.leader;
			switch(this.state){
				case HiveRaftStates.LEADER:
					this.handleQueue.queue({
						db: db,
						packet: packet,
						resolve: resolveFnc,
						reject: rejectFnc
					});
					break;
				case HiveRaftStates.FOLLOWER:
					if(from == packet.leader){
						db[packet.type](packet).then(resolveFnc);
					} else {
						return this.forward(db, packet).catch(function(){
							// on fail retry
							process.nextTick(function(){
								Logger.log("[forward failed] retrying", db, packet, from);
								this.handle(db, packet, from, resolveFnc);
							}, db, packet, from, resolveFnc);
						});
					}
					break;
				case HiveRaftStates.CANDIDATE:
					console.log("[HIVEDB][CANDIDATE] Missed packet", packet.data, packet.leader);
					break;
				default:
					throw new Error("Received data while in unknown state '"+ this.state +"'");
			}
			// console.log("should handle now!");
        });
    }

    isLeader(nodeID) {
        if(!nodeID)
			return this.state == HiveRaftStates.LEADER;

        return this.leaderID == nodeID;
    }

    leaderElection(cb) {
        if(!HiveClusterModules.Utils.isFunction(cb))
    		return false;

        this.changeState(HiveRaftStates.CANDIDATE);
        if(!this.leaderID){
			cb(this.getLowestWeightedNode().getID());
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

            let nodes = this.nodeList;
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

    			let nodeIndex = getIndex(result.followers, nodes[index].getID());
    			if(nodeIndex !== false){
					cb(nodes[index].getID());
					return true;
    			}
    			elector(index + 1);
    		}.bind(this))(0);
    	});
    }

    promoteLeader(leader, removedNode) {
		let query;
		Logger.log("Leader elected: " + this.options.group + " - ", leader, leader == HiveCluster.id);
		this.leaderID = leader;
		if(leader == HiveCluster.id){
			this.changeState(HiveRaftStates.LEADER);
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

			if(removedNode){
				query.$pull.followers.$in.push(removedNode);
			}

			this.write("metadata", null, query).then(() => {
				if(this.options.onLeader)
					this.options.onLeader.call(this, this.leaderID);
				if(this.options.onNodeAdded)
					this.options.onNodeAdded.call(this, this.leaderID);
			});
		} else {
			this.changeState(HiveRaftStates.FOLLOWER);
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
            let node = this.nodeList.find((node) => {
				return node.getID() == nodeID;
			});

            if(node) {
                this.options.raft.db["data"].findOne({_id: "node/" + node.getID()}, (err, result) => {

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
        let node = this.nodeList.find((node) => {
            return node.getID() == nodeID;
        });

        return new Promise((resolve, reject) => {
			this.write("metadata", null, {
				$push: {
					followers: node.getID()
				}
			}).then(() => {
				this.db["metadata"].findOne({_id: "metadata"}, (err, item) => {
					this.errorCatcher(err);

					if(item !== null) {
						this.send(node, this.db["metadata"], this.packet("metadata", item, "write"), resolve, reject);
					}
				});
			});
		});
    }

    initData(nodeID) {
		let node = this.nodeList.find((node) => {
			return node.getID() == nodeID;
		});

        return new Promise((resolve) => {
            HiveClusterModules.Utils.readFromDBCursor(this.db["data"].find({}), (err, item) => {
                this.errorCatcher(err);
                if(item == null) {
                    resolve(node);
                    return;
                }

                this.send(node, this.db["data"],
                    this.packet(item._id, item, "write"), () => {},
                    function(){
                        throw new Error("Failed to deliver part of the init packet: ", arguments);
                    }
                );
            });
        });
    }

    send(nodes, db, data, resolve, reject) {
		if(!data || !data.data) {
			reject("invalid data");
			return false;
		}

		if(!nodes){
			resolve();
			return false;
		}

		if(HiveClusterModules.Utils.isArray(nodes)) {
			if(nodes.length == 0) {
				resolve();
				return false;
			}
		} else {
			nodes = [nodes];
		}

		for(let node of nodes) {
			node.send(new HivePacket()
				.setRequest("/hiveraft/" + this.raftID + "/" + db.getType() + "/" + this.options.group + "/write")
				.setData(data)
				.onReply(resolve)
				.onReplyFail(reject)
			);
		}
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

	getLowestWeightedNode() {
		let minWeight = Number.MAX_SAFE_INTEGER;
		let lowestWeightedNode = null;
		for(let node of this.nodeList){
			if(node.getWeight() < minWeight) {
				minWeight = node.getWeight();
				lowestWeightedNode = node;
			}
		}

		return lowestWeightedNode;
	}

	changeState(state){
		switch (state){
			case HiveRaftStates.LEADER:
				break;
			case HiveRaftStates.FOLLOWER:
				break;
			case HiveRaftStates.CANDIDATE:
				break;
			default:
				throw new Error("Invalid state: '"+state+"'");
		}

    	this.state = state;
		let stateKeys = Object.keys(HiveRaftStates);
		console.log("---------------------------------------------------------------------- Changed State to:", stateKeys[state - 1]);
	}
}
module.exports = HiveRaftEngine;
