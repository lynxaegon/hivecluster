const InternalPeer = require("../transport/InternalPeer");
const networkSeen = Symbol('networkSeen');
const internalNode = Symbol('internalNode');
const HiveSystemNode = require('./HiveSystemNode');
const util = require("util");
const extractPath = require("../../utils/graphlib.extractPath");
const graphlib = require("graphlib");
const HiveTopology = require("./HiveTopology");

module.exports = class HiveSystemTopology extends HiveTopology {
	constructor(options) {
		super(options);

		this[internalNode] = this.get(HiveCluster.id);
		this[internalNode].setPeer(new InternalPeer({
			id: HiveCluster.id
		}), 0);
		this[internalNode].peer.on('message', msg => this.handleMessage(this[internalNode].peer, msg));

		// setInterval(() => {
		// 	const routingTable = this.getRoutingTable();
		// 	console.log("============== ROUTING TABLE ============");
		// 	console.log(util.inspect(routingTable, {showHidden: false, depth: null}));
		// 	console.log("============== ROUTING TABLE ============");
		// 	console.log("============== NODES CONNECTED ============");
		// 	console.log(util.inspect(this.peers.keys(), {showHidden: false, depth: null}));
		// 	console.log("============== NODES CONNECTED ============");
		// }, 1000);
	}

	start() {
		super.start();

		if (this[internalNode]) {
			this.events.emit("available", this[internalNode]);
		}
	}

	get type(){
		return this.SYSTEM;
	}

	get(id, create) {
		create = create === undefined;

		let node = this.networkGraph.node(id);
		if (!node && create) {
			node = new HiveSystemNode(id);
			this.networkGraph.setNode(id, node);
		}

		return node;
	}

	addPeer(peer) {
		super.addPeer(peer);

		if (!peer[networkSeen]) {
			peer.on('nodes', data => this.handleNodes(peer, data));

			peer.on('message', msg => this.handleMessage(peer, msg));

			peer.on('disconnected', () => {
				this.peers.delete(peer.id);

				this.handleDisconnect(peer);
			});

			peer[networkSeen] = true;
		}

		// create the node and add it to the network
		this.get(peer.id);
		this.networkGraph.setEdge(HiveCluster.id, peer.id);

		// cache paths
		this.cacheNodePaths();

		// broadcast new network to peers
		this.queueBroadcast();
	}

	handleNodes(peer, data) {
		if (data.source == HiveCluster.id)
			return;

		// console.log("============== New Routing Table (" + peer.id + ") ================");
		// console.log("Routing Table");
		// console.log(data.source, util.inspect(data, {showHidden: false, depth: null}));
		// console.log("Routing Table END");
		let requiresBroadcast = false;

		const available = new Set();
		available.add(data.source);
		available.add(HiveCluster.id);

		for (const p of data.nodes) {
			if (p.id === HiveCluster.id || p.id == data.source) {
				continue;
			}

			const node = this.get(p.id);
			node.decodeInfo(p.info);

			if (!this.networkGraph.hasEdge(data.source, p.id))
				requiresBroadcast = true;

			this.networkGraph.setEdge(data.source, p.id);
			available.add(p.id);
		}

		// Go through the peers and remove the peer from others
		let nodes = this.networkGraph.nodes();
		for (const otherID of nodes) {
			if (!available.has(otherID) && this.networkGraph.hasEdge(data.source, otherID)) {
				this.networkGraph.removeEdge(data.source, otherID);
				// console.log("removed edge:", data.source, otherID);
				requiresBroadcast = true;
			}
		}

		const sinks = this.networkGraph.sinks();
		for (const nodeID of sinks) {
			if (nodeID == HiveCluster.id) {
				// console.log("node", this.networkGraph.node(nodeID));
				// console.log("rejected removal of current node id!", HiveCluster.id);
				continue;
			}
			const node = this.networkGraph.node(nodeID);
			this.networkGraph.removeNode(nodeID);
			// console.log("removed node:", nodeID);
			this.events.emit("unavailable", node);
			requiresBroadcast = true;
		}

		// cache paths
		this.cacheNodePaths();
		// console.log("======================================== requiresBroadcast", requiresBroadcast);

		if (requiresBroadcast) {
			this.queueBroadcast();
		} else {
			this.queueBroadcast(peer, data);
		}

		this.viewNetwork();
	}

	handleDisconnect(peer) {
		let nodes = this.networkGraph.nodes();
		for (const otherID of nodes) {
			if (this.networkGraph.hasEdge(otherID, peer.id)) {
				this.networkGraph.removeEdge(otherID, peer.id);
				// console.log("removed edge:", otherID, peer.id);
			}
		}

		nodes = this.networkGraph.sinks();
		for (const nodeID of nodes) {
			if (nodeID == HiveCluster.id) {
				// console.log("rejected removal of current node id!", HiveCluster.id);
				continue;
			}

			const node = this.networkGraph.node(nodeID);
			this.networkGraph.removeNode(nodeID);
			// console.log("removed node:", nodeID, node);
			this.events.emit("unavailable", node);
		}

		// cache paths
		this.cacheNodePaths();

		this.queueBroadcast();
		this.viewNetwork();
	}

	handleMessage(peer, msg) {
		const source = msg[0];
		const target = msg[1];
		const message = msg[2];


		const targetNode = this.networkGraph.node(target);
		const sourceNode = this.networkGraph.node(source);

		// Protect against messages from unknown nodes
		if (!sourceNode)
			return;

		if (target !== HiveCluster.id) {
			// This message should be routed to another node, resolve and forward
			if (targetNode && targetNode.isReachable()) {
				targetNode.forward(source, message);
			}
		} else {
			// Emit event for all other messages
			this.events.emit('message', {
				node: sourceNode,
				protocol: message[0],
				data: message[1]
			});
		}
	}

	queueBroadcast(peer, data) {
		if (peer && data) {
			// console.log("peer", peer.id, data);
			// console.log("last source:", data.lastSource);
			let sourceNeighbors = this.networkGraph.neighbors(data.lastSource);
			sourceNeighbors.push(peer.id);
			// console.log("neighbors of " + data.lastSource, sourceNeighbors);
			data.lastSource = HiveCluster.id;
			for (const p of this.peers.values()) {
				if (sourceNeighbors.indexOf(p.id) == -1) {
					// console.log("sending update to: ", p.id, data);
					p.write('nodes', data);
				}
			}
			return;
		}

		if (this.broadcastTimeout)
			return;

		this.broadcastTimeout = setTimeout(() => {
			const routingTable = this.getRoutingTable();
			if (routingTable === null)
				return;

            // let peerList = [];
			// console.log("routing table:", routingTable);
			let neighbors = this.networkGraph.neighbors(HiveCluster.id);
			for (const peer of this.peers.values()) {
				if(neighbors.indexOf(peer.id) == -1)
					continue;

				// peerList.push(peer.id);
				peer.write('nodes', {
					nodes: routingTable,
					lastSource: HiveCluster.id,
					source: HiveCluster.id
				});
			}
            //
            // console.log("Sending Routing table to", peerList, {
            //     nodes: routingTable,
            //     lastSource: HiveCluster.id,
            //     source: HiveCluster.id
            // }, neighbors);

			this.broadcastTimeout = null;
		}, 100);
	}

	getRoutingTable() {
		const nodes = [];
		let data;
		let node;
		let neighbors = this.networkGraph.neighbors(HiveCluster.id);
		if (!neighbors)
			return null;

		for (const nodeId of neighbors) {
			if (nodeId == HiveCluster.id) {
				continue;
			}

			node = this.networkGraph.node(nodeId);
			data = {
				id: nodeId
			};
			if (node.distance == 0) {
				data.info = node.encodeInfo();
			}

			nodes.push(data);

		}

		return nodes;
	}

	cacheNodePaths() {
		let nodes = this.networkGraph.nodes();
		let paths = graphlib.alg.dijkstra(this.networkGraph, HiveCluster.id, null, (v) => this.networkGraph.nodeEdges(v));
		for (const nodeID of nodes) {
			if (nodeID == HiveCluster.id) {
				continue;
			}

			const node = this.get(nodeID);
			const wasReacheable = node.isReachable();
			try {
				let oldPeer = node.peer;
				let path = extractPath(paths, HiveCluster.id, nodeID);
				node.setPeer(this.peers.get(path.path[0]), path.distance);
				if (node.peer != oldPeer) {
					if (wasReacheable) {
						// console.log("Updated", node.id, "reacheable via", node.peer.id, "(old path:"+ oldPeer.id +")");
						this.events.emit("update", node);
					}
					else {
						// console.log(node.id, "found path:", path);
						this.events.emit("available", node);
					}
				}
			}
			catch (e) {
				// This happens if there is no path to a given node via a specific peer
				//
				// console.log("error", "invalid target nodes", "source", HiveCluster.id, "target", nodeID, wasReacheable);
				//
				node.removePeer();
				if (wasReacheable)
					this.events.emit("update", node);
			}
		}
	}

	viewNetwork() {
		// console.log("NETWORK:", util.inspect(this.networkGraph.edges(), {showHidden: false, depth: null}));
	}
};