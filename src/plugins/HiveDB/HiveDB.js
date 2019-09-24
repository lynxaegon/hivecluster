const HivePlugin = require('libs/core/plugins/HivePlugin');
const HiveRaftEngine = require('libs/HiveDB/HiveRaftEngine');
const HiveRaft_Global = require('libs/HiveDB/rafts/HiveRaft_Global');
const HiveRaft_Group = require('libs/HiveDB/rafts/HiveRaft_Group');
const HiveQueue = require('libs/queues/HiveQueue');

// const queues = {
// 	write: new HiveQueue((item) => {
// 		return new Promise((resolve, reject) => {
// 			item.action(resolve, reject);
// 		});
// 	}),
// 	read: new HiveQueue((item) => {
// 		return new Promise((resolve, reject) => {
// 			item.action(resolve, reject);
// 		});
// 	})
// };

const globalRaft = Symbol("global_raft");
const raftGroups = Symbol("raft_groups");

module.exports = class HiveDB extends HivePlugin {
    setup() {
    	this.collection = "testdb";
    	this.raftID = "HiveDB";

        this[globalRaft] = new HiveRaftEngine(this.raftID, this.hiveNetwork, new HiveRaft_Global());
		this[globalRaft].on("ready", () => {
			this.pluginLoaded();
		});

		this[globalRaft].on("newLeader", (nodeID) => {
			console.log("got new leader", nodeID);
		});
		this[globalRaft].on("nodeReady", (nodeID) => {
			console.log("got node ready", nodeID);
			this.checkGroups(nodeID);
		});
		this[globalRaft].on("nodeRemoved", (nodeID) => {
			console.log("got node removed", nodeID);
			console.log("-------------------");
			this.groupLeaderCheck();
			this.checkGroups(nodeID);
		});

        this[raftGroups] = {};
		this[globalRaft].onInit(() => {
			return new Promise((resolve, reject) => {
				this[globalRaft].db.metadata.findOne({_id: "metadata"}, (err, item) => {
					if(item.hiveDBinited) {
						reject("HiveDB already inited!");
						return;
					}

					let group = "@%@";
					this.hiveNetwork.getInternalNode().send(
						new HivePacket()
						.setRequest("/hivedb/group/join")
						.setData({
							leader: HiveCluster.id,
							group: "@%@"
						})
						.onReply(() => {
							this[globalRaft].write("metadata", null, {
								$set: {
									hiveDBinited: true
								}
							});
							this._isReady = true;
							this.emit("ready");
						})
						.onReplyFail(() => {
							throw new Error("Failed to join group '"+ group +"'")
						})
					);
					resolve();
				});
			});
        });

		this.hiveNetwork.on("/hivedb/group/join", (packet) => {
			// console.log("group join req", packet.data);
			if(packet.data.group && !packet.data.sync){
				// TODO: insert create group here
				this.createGroup(packet.data.group, packet.data.leader).then(() => {
					packet.reply();
				});

				// setInterval(() => {
				// 	console.log("------------------------------------------------------");
				// 	this[raftGroups][packet.data.group].printDebugInfo();
				// 	console.log("------------------------------------------------------");
				// 	this[globalRaft].printDebugInfo();
				// }, 1000);
			} else if(packet.data.group && packet.data.sync){
				this[raftGroups][packet.data.group].addNode(packet.node.getID()).then(() => {
					this[raftGroups][packet.data.group].raftImplementation.enable().then(() => {
						packet.reply();
					});
				});
			}
		});

		this.hiveNetwork.on("/hivedb/group/leader", (packet) => {
			this[raftGroups][packet.data.group].promoteLeader(packet.data.leader);
		});

		this.hiveNetwork.on("/hivedb/request/nodes", (packet) => {
			if(!this[globalRaft].isLeader())
				return false;

			if(!packet.data.except || !HiveClusterModules.Utils.isArray(packet.data.except)){
				packet.data.except = [];
			}

			this[globalRaft].getNodes((result) => {
				let nodes = [];
				for(let node of result){
					if(packet.data.except.indexOf(node.getID()) == -1)
						nodes.push(node);
				}

				HiveClusterModules.Utils.shuffleArray(nodes);
				nodes = nodes.slice(0, packet.data.required);

				for(let i = 0; i < nodes.length; i++){
					nodes[i] = nodes[i].getID();
				}
				packet.reply({
					required: packet.data.required,
					nodes: nodes
				});
			}, true);

		});

		this.hiveNetwork.on("/hivedb/request/split", (packet) => {
			console.log("SPLIT REQUEST:", packet.data);
		});

		this.hiveNetwork.on("/hivedb/" + this.collection + "/" + this.raftID + "/write", this.onWrite);
		this.hiveNetwork.on("/hivedb/" + this.collection + "/" + this.raftID + "/query", this.onQuery);
		this.hiveNetwork.on("/hivedb/" + this.collection + "/" + this.raftID + "/delete", this.onDelete);

		// setInterval(() => {
		// 	this[globalRaft].printDebugInfo();
		// }, 1000);

		setTimeout(() => {
			this.generateData();
		}, 3000);

		return true;
    }

    createGroup(groupName, leader) {
    	return new Promise((resolve, reject) => {
			let group = new HiveRaft_Group(groupName, this[globalRaft]);
			this[raftGroups][groupName] = new HiveRaftEngine(this.raftID, this.hiveNetwork, group, {
				collection: this.collection,
				group: groupName
			});
			this[raftGroups][groupName].once("ready", () => {
				this[raftGroups][groupName].promoteLeader(leader).then(() => {
					this.hiveNetwork.getNode(leader).send(new HivePacket()
						.setRequest("/hivedb/group/join")
						.setData({
							group: groupName,
							sync: true
						})
						.onReply(resolve)
						.onReplyFail(reject)
					);
				});
			});

			this[raftGroups][groupName].on("split", (group, groupLeft, groupRight) => {
				console.log("HiveRaftEngine requested a split", group, groupLeft, groupRight);
			});
		});
	}

    checkGroups(nodeID){
		if(HiveCluster.id == nodeID)
			return;

		let keys = Object.keys(this[raftGroups]);
		for(let groupKey of keys){
			this[raftGroups][groupKey].requestNodes();
		}
	}

	write(id, packet){
    	packet = {
    		id: id,
			data: packet,
			type: "write"
		};

    	return new Promise((resolve, reject) => {
			this.lookupLeaderOfID(id).then((result) => {
				let leader = result.leader;
				let group = result.group;

				packet.leader = result.leader.getID();
				leader.send(new HivePacket()
					.setRequest("/hiveraft/" + this.collection + "/" + this.raftID + "/data/" + group + "/write")
					.setData(packet)
					.onReply(resolve)
					.onReplyFail(reject)
				)
			});
		})
	}

	read(id){
		return new Promise((resolve, reject) => {
			this.lookupLeaderOfID(id).then((result) => {
				let leader = result.leader;
				let group = result.group;

				leader.send(new HivePacket()
					.setRequest("/hiveraft/" + this.collection + "/" + this.raftID + "/data/" + group + "/read")
					.setData({
						id: id
					})
					.onReply((packet) => {
						resolve(packet.data)
					})
					.onReplyFail(() => {
						reject({
							err: "reply failed",
							reason: reason,
							item: null
						})
					})
				);
			});
		});
	}

	onWrite(packet){

	}

	onQuery(packet){

	}

	onDelete(packet){

	}

	lookupLeaderOfID(id){
		return new Promise((resolve, reject) => {
			let cursor = this[globalRaft].find({
				_id: {
					$regex: "group/*"
				}
			}, {_id: 1, leader: 1});
			let self = this;
			(function findLeaderForGroup(){
				if(cursor.isClosed()){
					reject({
						err: "Couldn't find a group where to fit the id '"+id+"'",
						code: "HIVEDB_ERROR_WRITE"
					});
					return false;
				}
				cursor.nextObject(function(err, item){
					self.errorCatcher(err);

					if(item == null){
						cursor.close();
					reject({
						err: "Couldn't find a group where to fit the id '"+id+"'",
						code: "HIVEDB_ERROR_WRITE"
					});
					return false;
						// all finished
					} else {
					let group = item._id.replace("group/", "");
					let split = group.split("%");
					for (let i in split) {
						if (split[i] == "@") {
							split[i] = id;
						}
					}
					let tmp = [id].concat(split);

					tmp.sort();
					if (tmp[1] == id) {
						// the document hit between the 2 splits
							let node = self.hiveNetwork.getNode(item.leader);
						if (!node) {
							reject({
								err: "Couldn't find leader of group '" + group + "' to insert '" + id + "'",
								code: "HIVEDB_ERROR_NODE_MISSING"
							});
							return false;
						}

						resolve({
							group: group,
							leader: node
						});
						} else {
							findLeaderForGroup();
					}
				}
				})
			})();
		});
	}

	groupLeaderCheck() {
		HiveClusterModules.Utils.readFromDBCursor(this[globalRaft].find({
			_id: {
				$regex: "group/*"
			}
		}), (err, group) => {
			this.errorCatcher(err);
			if(group == null) {
				console.log("-------------");
				return;
			}

			this[globalRaft].findOne({
				_id: "node/" + group.leader
			}, (err, item) => {
				if(!item){
					// leader is missing
					let groupName = group._id.split("/")[1];
					if(!group.followers || group.followers.length == 0) {
						// TODO: maybe implement a way to create the group if the group was lost, at least writes could work again
						// if the group is lost, there will be an interval which would never allow writes because the id's won't fit any range except the missing range
						// could try to rebalance all the groups (way to intensive) or it could recreate the group and assign a leader + followers
						throw new Error("Group '" + groupName + "' has been lost! There are no followers to promote as leader! HiveDB Corrupted!");
					}

					this.hiveNetwork.send(
						new HivePacket()
						.setRequest("/hivedb/group/leader")
						.setData({
							leader: HiveCluster.id,
							group: groupName
						}),
						(node) => {
							return group.followers.indexOf(node.getID()) != -1;
						});
				}
			});
		});
	}

	errorCatcher(err){
		if(err){
			throw new Error("Fatal error when reading from db!");
			process.exit(-1);
		}
	}

	isReady(){
		return this._isReady;
	}

	generateData() {
		for(let i = 0; i < 100; i++){
			setTimeout(() => {
				let data = {};
				for(let j = 0; j < 10; j++){
					data[HiveClusterModules.Utils.uuidv4()] = HiveClusterModules.Utils.uuidv4();
				}
				this.write(HiveClusterModules.Utils.uuidv4(), data)
			}, 10 + i);
		}
	}
};
