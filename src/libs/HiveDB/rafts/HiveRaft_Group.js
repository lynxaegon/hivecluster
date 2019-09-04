const EventEmitter = require('events').EventEmitter;
class HiveRaft_Group  extends EventEmitter {
	constructor(group, globalRaftEngine) {
		super();
		this.raftEngine = false;
		this.globalRaftEngine = globalRaftEngine;
		this.group = group;
		this.requireNodesCount = 3;
		this._requiresMoreNodes = true;
	}

	init(raftEngine) {
		this.raftEngine = raftEngine;
	}

	set requiresMoreNodes(value){
		if(value <= 0)
			this._requiresMoreNodes = false;
		else
			this._requiresMoreNodes = true;
	}

	get requiresMoreNodes() {
		return this._requiresMoreNodes;
	}

	onLeader() {
		this.globalRaftEngine.write("data", "group/" + this.group, {
			$set: {
				leader: HiveCluster.id
			},
			$pull: {
				followers: HiveCluster.id
			}
		});

		console.log("requesting more nodes!!!");
		this.requestNodes();
	}

	onFollower() {
		this.globalRaftEngine.write("data", "group/" + this.group, {
			$push: {
				followers: HiveCluster.id
			}
		});
	}

	onNodeAdded(nodeID) {
		// console.log("node added to group", this.group, nodeID);
		return this.globalRaftEngine.write("data", "node/" + nodeID, {
			$push: {
				groups: this.group
			}
		});
	}

	onNodeRemoved(nodeID) {
		this.globalRaftEngine.write("data", "group/" + this.group, {
			$pull: {
				followers: nodeID
			}
		});
	}

	disable() {
		return this.globalRaftEngine.write("data", "group/" + this.group, {
			$set: {
				enabled: false
			}
		});
	}

	enable(){
		return this.globalRaftEngine.write("data", "group/" + this.group, {
			$set: {
				enabled: true
			}
		});
	}

	leaderElection(callback, nodeRemoved) {
		// if(nodeRemoved)
			// callback(null);
	}

	requestNodes() {
		// only leader of group is allowed to request nodes
		if(!this.raftEngine.isLeader()){
			return;
		}

		this.getRequestNodesPacket((data) => {
			data.group = this.group;
			this.globalRaftEngine.getLeader((node) => {
				node.send(
					new HivePacket()
					.setRequest("/hivedb/request/nodes")
					.setData(data)
					.onReply((packet) => {
						if(!HiveClusterModules.Utils.isArray(packet.data.nodes))
							packet.data.nodes = [];

						this.globalRaftEngine.getNodes((nodes) => {
							let filtered = [];
							for (let node of nodes) {
								if (packet.data.nodes.indexOf(node.getID()) !== -1) {
									filtered.push(node);
								}
							}
							nodes = filtered;

							if (nodes && nodes.length > 0) {
								for (let node of nodes) {
									this.addNode(node);
								}
								this.requiresMoreNodes = packet.data.required - nodes.length;
							} else {
								this.requiresMoreNodes = packet.data.required;
							}

							// console.log("got req reply", packet.data);
						}, true);
					})
					.onReplyFail(() => {
						this.requiresMoreNodes = data.required;
					})
				)
			});
		});
	}

	getRequestNodesPacket(cb) {
		this.raftEngine.getNodes((result) => {
			let exceptionList = [];
			if(result){
				for(let node of result){
					exceptionList.push(node.getID());
				}
			}
			if(exceptionList.length < this.requireNodesCount){
				cb({
					required: this.requireNodesCount - exceptionList.length,
					except: exceptionList
				});
			}
		}, true);
	}

	addNode(node){
		console.log("adding node to hiveDB group", this.group, node.getID());
		node.send(
			new HivePacket()
			.setRequest("/hivedb/group/join")
			.setData({
				leader: HiveCluster.id,
				group: this.group
			})
			.onReply(() => {
			})
		);
	}
}

module.exports = HiveRaft_Group;
