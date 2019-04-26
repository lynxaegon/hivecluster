const debug = HiveClusterModules.debug("HiveCluster:HiveTopology");
const EventEmitter = require('events');
const networkSeen = Symbol('networkSeen');
const Node = require('./Node');
const util = require("util");
const extractPath = require("../../utils/graphlib.extractPath");
const graphlib = require("graphlib");

module.exports = HiveClusterModules.BaseClass.extend({
	init: function (options) {
		this.events = new EventEmitter();

		this.networkGraph = new graphlib.Graph({
			directed: false
		});
		this.peers = new Map();

		// setInterval(() => {
		// 	const routingTable = this.getRoutingTable();
		// 	console.log("============== ROUTING TABLE ============");
		// 	console.log(util.inspect(routingTable, {showHidden: false, depth: null}));
		// 	console.log("============== ROUTING TABLE ============");
		// }, 1000);
	},
	on: function (event, handler) {
		this.events.on(event, handler);
	},
	get: function (id, create) {
		create = create === undefined;

		let node = this.networkGraph.node(id);
		if (!node && create) {
			node = new Node(id);
			this.networkGraph.setNode(id, node);
		}

		return node;
	},
	addPeer(peer) {
		this.peers.set(peer.id, peer);

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
	},
	handleNodes: function (peer, data) {
		if(data.source == HiveCluster.id)
			return;

		console.log("============== New Routing Table ("+ peer.id +") ================");
		// console.log("Routing Table");
		// console.log(data.source, util.inspect(data, {showHidden: false, depth: null}));
		// console.log("Routing Table END");
		let requiresBroadcast = false;

		const available = new Set();
		available.add(data.source);
		available.add(HiveCluster.id);

		for (const p of data.nodes) {
			if (p.id === HiveCluster.id) {
				continue;
			}

			const node = this.get(p.id);
			node.decodeInfo(p.info);
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
			const node = this.networkGraph.node(nodeID);
			this.networkGraph.removeNode(nodeID);
			// console.log("removed node:", nodeID);
			if(HiveCluster.id != nodeID)
				this.events.emit("unavailable", node);
			requiresBroadcast = true;
		}

		// cache paths
		this.cacheNodePaths();
		// console.log("======================================== requiresBroadcast", requiresBroadcast);

		if(requiresBroadcast){
			this.queueBroadcast();
		} else {
			this.queueBroadcast(peer, data);
		}

		this.viewNetwork();
	},
	handleDisconnect: function (peer) {
		let nodes = this.networkGraph.nodes();
		for (const otherID of nodes) {
			if (this.networkGraph.hasEdge(otherID, peer.id)) {
				this.networkGraph.removeEdge(otherID, peer.id);
				// console.log("removed edge:", otherID, peer.id);
			}
		}

		nodes = this.networkGraph.sinks();
		for (const nodeID of nodes) {
			const node = this.networkGraph.node(nodeID);
			this.networkGraph.removeNode(nodeID);
			// console.log("removed node:", nodeID, node);
			if(HiveCluster.id != nodeID)
				this.events.emit("unavailable", node);
		}

		// cache paths
		this.cacheNodePaths();

		this.queueBroadcast();
		this.viewNetwork();
	},
	handleMessage: function (peer, msg) {
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
				type: message.type,
				data: message.data
			});
		}
	},
	queueBroadcast: function (peer, data) {
		if(peer && data){
			data.visited++;
			if(data.visited >= this.networkGraph.nodes().length){
				return;
			}

			for (const p of this.peers.values()) {
				if(p.id == peer.id)
					continue;
				p.write('nodes', data);
			}
			return;
		}

		if (this.broadcastTimeout)
			return;

		this.broadcastTimeout = setTimeout(() => {
			const routingTable = this.getRoutingTable();
			if(routingTable === null)
				return;

			// console.log("routing table:", routingTable);
			for (const peer of this.peers.values()) {
				peer.write('nodes', {
					nodes: routingTable,
					visited: 1,
					source: HiveCluster.id
				});
			}

			this.broadcastTimeout = null;
		}, 100);
	},
	getRoutingTable: function(){
		const nodes = [];
		let data;
		let node;
		let neighbors = this.networkGraph.neighbors(HiveCluster.id);
		if(!neighbors)
			return null;

		for (const nodeId of neighbors) {
			node = this.networkGraph.node(nodeId);
			data = {
				id: nodeId
			};
			if(node.distance == 0){
				data.info = node.encodeInfo();
			}

			nodes.push(data);
		}

		return nodes;
	},
	cacheNodePaths: function(){
		let nodes = this.networkGraph.nodes();
		let paths = graphlib.alg.dijkstra(this.networkGraph, HiveCluster.id, null, (v) => this.networkGraph.nodeEdges(v));
		for(const nodeID of nodes){
			if(nodeID == HiveCluster.id)
				continue;

			const node = this.get(nodeID);
			const wasReacheable = node.isReachable();
			try {
				let oldPeer = node.peer;
				let path = extractPath(paths, HiveCluster.id, nodeID);
				node.setPeer(this.peers.get(path.path[0]), path.distance);
				if(node.peer != oldPeer){
					if(wasReacheable) {
						console.log("Updated", node.id, "reacheable via", node.peer.id, "(old path:"+ oldPeer.id +")");
						this.events.emit("update", node);
					}
					else {
						// console.log(node.id, "found path:", path);
						this.events.emit("available", node);
					}
					// console.log("NETWORK:", util.inspect(this.networkGraph.edges(), {showHidden: false, depth: null}));
				}
			}
			catch(e){
				node.removePeer();
				if(wasReacheable)
					this.events.emit("update", node);
			}
		}
	},
	viewNetwork: function(){
		// console.log("NETWORK:", util.inspect(this.networkGraph.edges(), {showHidden: false, depth: null}));
	}
});