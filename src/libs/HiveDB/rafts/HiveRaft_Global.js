const EventEmitter = require('events').EventEmitter;
class HiveRaft_Global extends EventEmitter {
	constructor() {
		super();

		this.globalRaftEngine = false;
		this.raftEngine = false;
		this.onInitFnc = false;
	}

	init(raftEngine) {
		this.globalRaftEngine = raftEngine;
		this.raftEngine = raftEngine;

		this.raftEngine.hiveNetwork.on("/system/ready", (packet) => {
			this.raftEngine.addNode(packet.node.getID());
		});
	}

	onLeader() {
		if(this.onInitFnc){
			this.onInitFnc().then(() => {
				this.onNodeAdded(HiveCluster.id);
			}).catch(() => {
				this.emit("newLeader", HiveCluster.id);
			});
		}
	}

	onNodeReady(nodeID) {
		this.emit("nodeReady", nodeID);
	}

	onFollower() {
		console.log("onFollower");
	}

	onNodeAdded(nodeID) {
		this.raftEngine.write("data", "node/" + nodeID, {
			_id: "node/" + nodeID
		});

		this.raftEngine.getNodes((result) => {
			if(result.leader){
				result.leader.node.send(
					new HivePacket()
					.setRequest("/hiveraft/" + this.raftEngine.options.collection + "/" + this.raftEngine.raftID + "/nodeReady/" + this.raftEngine.options.group)
					.setData({
						id: nodeID
					})
				);
			}

			if(result.followers){
				for(let follower of result.followers) {
					follower.node.send(
						new HivePacket()
						.setRequest("/hiveraft/" + this.raftEngine.options.collection + "/" + this.raftEngine.raftID + "/nodeReady/" + this.raftEngine.options.group)
						.setData({
							id: nodeID
						})
					);
				}
			}
		});
	}

	onNodeRemoved(nodeID) {
		console.log("onNodeRemoved", nodeID);
		return new Promise((resolve) => {
			this.raftEngine.delete({
				_id: "node/" + nodeID
			}).then(resolve);
		})
	}

	onInit(onInitFnc){
		this.onInitFnc = onInitFnc;
	}

	leaderElection(cb) {
		if(!HiveClusterModules.Utils.isFunction(cb))
			return false;

		if(!this.raftEngine.leaderID){
			cb(this.getLowestWeightedNode().getID());
			return true;
		}

		this.raftEngine.getNodes((result) => {
			if(!result){
				throw new Error("No nodes found!!!");
				process.exit(-1);
			}

			if(!result.followers) {
				throw new Error("No followers to promote to leader!");
				process.exit(-1);
				return false;
			}

			let nodes = this.raftEngine.hiveNetwork.getNodes();
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

	getLowestWeightedNode() {
		let nodes = this.raftEngine.hiveNetwork.getNodes();
		nodes.sort((a, b) => (a.getID() > b.getID()) ? 1 : -1);
		// console.log(nodes.map(node => node.getID() + " - " + node.getWeight()));
		let minWeight = Number.MAX_SAFE_INTEGER;
		let lowestWeightedNode = null;
		for(let node of nodes){
			if(node.getWeight() < minWeight) {
				minWeight = node.getWeight();
				lowestWeightedNode = node;
			}
		}

		return lowestWeightedNode;
	}
}

module.exports = HiveRaft_Global;
