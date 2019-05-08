const EventEmitter = require("events").EventEmitter;
const events = Symbol("events");
const seq = Symbol("seq");
const _seq = Symbol("_seq");
const Network = require("./Network");
const graphlib = require("graphlib");

module.exports = class HiveNetwork {
	constructor(options) {
		this.options = Object.assign({
			name: "unknown",
			systemNetwork: false
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

		// if(this.options.drawMap){
		// 	setInterval(() => {
		// 		let map = [];
		// 		for(let node of this.nodes){
		// 			map.push("\t\t" + node.getID() + " - distance: " + node.getDistance() + " - path: " + node.getPath());
		// 		}
		// 		console.log("Map:", map.join("\n"));
		// 	}, 1000);
		// }

		this.timeouts = {};
	}

	addTransport(transport) {
		this.networks.push(
			new Network({
				name: this.options.name,
				systemNetwork: this.options.systemNetwork,
				transport: transport
			})
		);
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
				network.start().then((result) => {
				}).catch((result) => {
					console.log("network error -> ", result);
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
			console.log("node added", node.getID(), node.isDirect());
			this.nodes.push(node);
		});

		// HiveNode path updated
		network.on('node:update', node => {
			console.log("node updated", node.getID(), node.isDirect());
		});

		// HiveNode fully disconnected from the cluster
		network.on('node:unavailable', node => {
			let idx = this.nodes.indexOf(node);
			this.nodes.splice(idx, 1);
			console.log("removed", node.getID(), node.isDirect());
		});

		// HiveNode message handler
		network.on("message", (msg) => {
			if (msg.type == "hive") {
				if (msg.data.seqr) {
					// reply package
					msg.node.processReply(new HivePacket().deserialize(msg));
				} else {
					// normal package
					this.emit(msg.data.req, new HivePacket().deserialize(msg));
				}
			} else {
				console.log("Invalid message!", msg);
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

	send(payload, nodes) {
		if (HiveClusterModules.Utils.isFunction(nodes))
			nodes = this.getNodes(nodes);

		if (!nodes)
			return;

		if (!HiveClusterModules.Utils.isArray(nodes)) {
			nodes = [nodes];
		}

		for (let node of nodes) {
			node.send(payload);
		}
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

	drawMap() {
		let nodes = this.nodes;
		console.log("============ MAP =============");
		for (let i in nodes) {
			console.log("  ", "id", nodes[i].getID(), "distance", nodes[i].getDistance(), "path", nodes[i].path);
		}
		console.log("=========================");
	}
};