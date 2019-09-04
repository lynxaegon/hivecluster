const EventEmitter = require("events").EventEmitter;
const events = Symbol("events");
const seq = Symbol("seq");
const _seq = Symbol("_seq");
const Network = require("./Network");
const graphlib = require("graphlib");

const HiveSystemTopology = require("libs/core/topology/HiveSystemTopology");
const HiveClientsTopology = require("libs/core/topology/HiveClientsTopology");

module.exports = class HiveNetwork {
	static get TYPE(){
		return {
			SYSTEM: 1,
			CLIENTS: 2
		};
	}

	constructor(options) {
		this.options = Object.assign({
			name: "unknown"
		}, options);

		this.networks = [];
		this.nodes = [];
		this[events] = new EventEmitter();

		this.debug = HiveClusterModules.debug("HiveNetwork:" + this.options.name);

		if (this.options.transports) {
			for (let transport of this.options.transports) {
				this.addTransport(transport)
			}
		}
		delete this.options.transports;
		this.timeouts = {};
	}

	// TDOO: Only supports a single transport!
	addTransport(transport) {
		let topology;
		switch(this.options.type){
			case HiveNetwork.TYPE.SYSTEM:
				topology = new HiveSystemTopology();
				break;
			case HiveNetwork.TYPE.CLIENTS:
				topology = new HiveClientsTopology();
				break;
			default:
				throw new Error("Invalid Hive Topology!");
		}

		// systemNetworks push each transport in a new network
		// clientNetworks just adds a single network and pushes transports
		// if(this.options.type == HiveNetwork.TYPE.SYSTEM){
		// 	this.networks.push(
		// 		new Network(new HiveSystemTopology(), {
		// 			name: this.options.name,
		// 			transport: transport
		// 		})
		// 	);
		// } else if(this.options.type == HiveNetwork.TYPE.CLIENTS){
		if(this.networks.length <= 0){
			this.networks.push(
				new Network(topology, {
					name: this.options.name,
					transport: transport
				})
			);
		} else {
			this.networks[0].addTransport(transport);
		}
		// } else {
		// 	throw new Error("Invalid HiveNetwork topology Type!");
		// }
	}

	getTopology() {
		let networkTopology = new graphlib.Graph({
			directed: false
		});

		let topology;
		for (let network of this.networks) {
			topology = network.getTopology();
			for (let node of topology.nodes()) {
				networkTopology.setNode(node);
			}
			for (let edge of topology.edges()) {
				networkTopology.setEdge(edge.v, edge.w);
			}
		}

		return graphlib.json.write(networkTopology);
	}

	start() {
		let promises = [];
		for (let network of this.networks) {
			this.setup(network);
			promises.push(
				network.start().then(() => {
				}).catch((result) => {
					// console.log("network error -> ", result);
				})
			);
		}

		return Promise.all(promises);
	}

	stop() {
		for (let network of this.networks) {
			network.stop();
		}
	}

	setup(network) {
		// HiveNode available, either directly or via a peer
		network.on('node:available', node => {
			// console.log("node added", node.getID(), node.isDirect());
			this.nodes.push(node);
			this.emit("/system/node/added", node);
		});

		// HiveNode path updated
		network.on('node:update', node => {
			// console.log("node updated", node.getID(), node.isDirect());
			this.emit("/system/node/updated", node);
		});

		// HiveNode fully disconnected from the cluster
		network.on('node:unavailable', node => {
			let idx = this.nodes.indexOf(node);
			this.nodes.splice(idx, 1);
			// console.log("node removed", node.getID(), node.isDirect());
			this.emit("/system/node/removed", node);
		});

		// HiveNode message handler
		network.on("message", (msg) => {
			if (msg.protocol == 1) {
				if (msg.data.seqr) {
					// reply package
					msg.node.processReply(new HivePacket().deserialize(msg));
				} else {
					// normal package
					this.emit(msg.data.req, new HivePacket().deserialize(msg));
				}
			} else {
				console.log("Invalid HiveProtocol!", msg);
			}
		});

		network.on("_hiveNetworkEvent", (...args) => {
			this.emit.apply(this, args);
		});

		network.setup();
	}

	on(event, handler) {
		this[events].on(event, handler);
	}

	off(event, handler) {
		this[events].removeListener(event, handler);
	}

	emit(event) {
		this[events].emit.apply(this[events], arguments);
	}

	send(payload, nodesFilterFnc) {
		if(nodesFilterFnc && !HiveClusterModules.Utils.isFunction(nodesFilterFnc))
			throw new Error("Invalid nodes filter function!");

		return new Promise((resolve, reject) => {
			let nodes = this.getNodes(nodesFilterFnc);

			if (!nodes) {
				reject("No nodes found!");
				return;
			}

			if (!HiveClusterModules.Utils.isArray(nodes)) {
				nodes = [nodes];
			}

			let acks = [];
			for (let node of nodes) {
				acks.push(
					node.send(payload)
				);
			}

			Promise.all(acks).then(resolve).catch(reject);
		});
	}

	getNodes(filterFnc) {
		if (!HiveClusterModules.Utils.isFunction(filterFnc))
			return this.nodes;

		let result = [];
		for (let i = 0; i < this.nodes.length; i++) {
			if (filterFnc(this.nodes[i]))
				result.push(this.nodes[i]);
		}
		return result;
	}

	getNode(nodeID) {
		for (let i = 0; i < this.nodes.length; i++) {
			if (nodeID == this.nodes[i].getID())
				return this.nodes[i];
		}
		return null;
	}

	getInternalNode() {
		let nodes = this.getNodes();
		for(let node of nodes){
			if(node.isInternal())
				return node;
		}

		return false;
	}

	getLowestWeightedNode() {
		let nodes = this.getNodes();
		nodes.sort((a, b) => (a.getID() > b.getID()) ? 1 : -1);
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

	drawMap() {
		let nodes = this.nodes;
		console.log("============ MAP =============");
		for (let i in nodes) {
			console.log("  ", "id", nodes[i].getID(), "distance", nodes[i].getDistance(), "path", nodes[i].path);
		}
		console.log("=========================");
	}
};