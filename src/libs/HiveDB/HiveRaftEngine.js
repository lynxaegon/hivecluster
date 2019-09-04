const util = require("util");
const EventEmitter = require('events').EventEmitter;
const HiveDBEngine = require('./HiveDBEngine');
const HiveRaftStates = Object.freeze({
    CANDIDATE: 1,
    FOLLOWER: 2,
    LEADER: 3
});
const HiveQueue = require('libs/queues/HiveQueue');

class HiveRaftEngine extends EventEmitter {
    constructor(raftID, hiveNetwork, raftImplementation, options) {
        super();

		this.handleQueue = false;
        this.hiveNetwork = hiveNetwork;
		this.state = HiveRaftStates.CANDIDATE;
        this.leaderID = false;
        this.raftImplementation = raftImplementation;
        if(!this.raftImplementation){
        	throw new Error("Invalid HiveRaft implementation!");
		}

        this.options = HiveClusterModules.Utils.extend({
			collection: "default",
            group: "__global__"
		}, options);
		this.raftID = raftID;
		// console.log(this.raftID);

        this.db = {
            metadata: new HiveDBEngine(this.options.collection, "metadata", this.options.group),
            data: new HiveDBEngine(this.options.collection, "data", this.options.group)
        };

        this.setup();

        this.raftImplementation.init(this);
        this.raftImplementation.on("nodeReady", (...args) => {
			this.emit.call(this, "nodeReady", ...args);
		});
		this.raftImplementation.on("newLeader", (...args) => {
			this.emit.call(this, "newLeader", ...args);
		});
    }

    printDebugInfo() {
		console.log("===============");
		this.db.metadata.findOne({_id: "metadata"}, (err, item) => {
			this.errorCatcher(err);

			if(item !== null) {
				console.log("metadata", item);
			}
		});
		HiveClusterModules.Utils.readFromDBCursor(this.db.data.find({}), (err, item) => {
			this.errorCatcher(err);

			if(item !== null) {
				console.log("["+this.options.group+"]","data", item);
			}
		});
	}

    onInit(initFnc) {
    	this.raftImplementation.onInit(initFnc);
	}

    setup() {
		this.hiveNetwork.on("/system/node/removed", (node) => {
			this.removeNode(node);

		});

		this.hiveNetwork.on("/hiveraft/" + this.options.collection + "/" + this.raftID + "/nodeReady/" + this.options.group, (packet) => {
			if(this.raftImplementation.onNodeReady)
				this.raftImplementation.onNodeReady(packet.data.id);
		});

		this.hiveNetwork.on("/hiveraft/" + this.options.collection + "/" + this.raftID + "/ready/" + this.options.group, (packet) => {
			if(this.raftImplementation.onFollower)
				this.raftImplementation.onFollower(this.leaderID);

			packet.reply();
		});
		this.hiveNetwork.on("/hiveraft/" + this.options.collection + "/" + this.raftID + "/" + this.db.metadata.getType() + "/" + this.options.group + "/write", (packet) => {
			// console.log("got write for", this.options.group);
			this.handle(this.db.metadata, packet.data, packet.node.getID()).then(() => {
				packet.reply();
			});
		});
		this.hiveNetwork.on("/hiveraft/" + this.options.collection + "/" + this.raftID + "/" + this.db.data.getType() + "/" + this.options.group + "/write", (packet) => {
			// console.log("got write for", this.options.group);
			this.handle(this.db.data, packet.data, packet.node.getID()).then(() => {
				packet.reply();
			});
		});

		this.hiveNetwork.on("/hiveraft/" + this.options.collection + "/" + this.raftID + "/" + this.db.data.getType() + "/" + this.options.group + "/read", (packet) => {
			this.findOne({_id: packet.data.id}, (err, item) => {
				packet.reply({
					err: err,
					result: item
				});
			});
		});
	}

	addNode(nodeID) {
    	return new Promise((resolve, reject) => {
			if(!this.leaderID){
				this.raftImplementation.leaderElection((...args) => {
					this.promoteLeader.call(this, ...args);
					resolve();
				});
			} else if(this.isLeader() && nodeID != this.leaderID) {
				// init metadata and data
				this.initMetadata(nodeID).then(() => {
					this.initData(nodeID).then((node) => {
						node.send(new HivePacket()
							.setRequest("/hiveraft/" + this.options.collection + "/" + this.raftID + "/ready/" + this.options.group)
							.setData({
								sync: true
							})
							.onReply(() => {
								resolve();
							})
							.onReplyFail(reject)
						);

						if (this.raftImplementation.onNodeAdded)
							this.raftImplementation.onNodeAdded(node.getID());
					});
				});
			} else {
				resolve();
			}
		});
    }

    removeNode(node, leaderChanged){
		if(this.isLeader(node.getID())) {
			this.changeState(HiveRaftStates.CANDIDATE);

			this.raftImplementation.leaderElection((leader) => {
				this.promoteLeader(leader, node.getID());
				// if the leader changed, reapply the change so the leader knows about the removal
				this.removeNode(node, true);
            }, true);
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

			let promise = false;
			if (this.raftImplementation.onNodeRemoved)
				promise = this.raftImplementation.onNodeRemoved(node.getID());

			Promise.all([promise]).then(() => {
				this.emit("nodeRemoved", node.getID());
			});
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

	find(query, fields) {
		return this.db.data.find(query, fields);
	}

	findOne(query, cb){
		this.db.data.findOne(query, cb);
	}

    handle(db, packet, from, resolveFnc, rejectFnc) {
		// console.log("handle:", util.inspect(arguments[1], {showHidden: false, depth: null}));
        if(!this.handleQueue){
			this.handleQueue = new HiveQueue((item) => {
				return new Promise((resolve, reject) => {
					item.db[item.packet.type](item.packet).then(() => {
						this.getNodes((result) => {
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
					console.log("[HIVEDB]["+this.options.collection+"]["+this.options.group+"][CANDIDATE] Missed packet", packet.data, packet.leader);
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

    getLeader(cb){
		this.getNodes((result) => {
			if (!result || !result.leader) {
				cb(false);
				return;
			}

			cb(result.leader.node);
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
				if(this.raftImplementation.onLeader)
					this.raftImplementation.onLeader(this.leaderID);
			});
		} else {
			this.changeState(HiveRaftStates.FOLLOWER);
		}
    }

    getNodes(callback, merged){
		merged = merged || false;
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
					if(merged) {
						let arr = [];
						if(nodes.leader){
							arr.push(nodes.leader.node);
						}
						if(nodes.followers) {
							for (let node of nodes.followers){
								arr.push(node.node);
							}
						}
						callback(arr);
					} else {
						callback(nodes);
					}
				}
			});
		});
	}

    getNode(nodeID){
        return new Promise((resolve) => {
            let node = this.hiveNetwork.getNode(nodeID);

            if(node) {
                this.raftImplementation.globalRaftEngine.db["data"].findOne({_id: "node/" + node.getID()}, (err, result) => {

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
        let node = this.hiveNetwork.getNode(nodeID);

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
		let node = this.hiveNetwork.getNode(nodeID);

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
				.setRequest("/hiveraft/" + this.options.collection + "/" + this.raftID + "/" + db.getType() + "/" + this.options.group + "/write")
				.setData(data)
				.onReply(resolve)
				.onReplyFail(reject)
			);
		}
    }

    forward(db, data){
		if(this.isLeader())
			throw new Error("Forwarding data while in LEADER state! Investigate this one!!!!");
		return new Promise((resolve, reject) => {
			// forward to leader (only leader accepts writes)
			this.getLeader((node) => {
				// console.log("Forwarded to leader", leader, data);
				this.send(node, db, data, resolve, reject);
			});
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

    errorCatcher(err){
		if(err){
			Logger.err("ERR", err);
			throw new Error("Fatal error when reading from db!");
			process.exit(-1);
		}
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

	requestNodes() {
		this.raftImplementation.requestNodes();
	}
}
module.exports = HiveRaftEngine;