const debug = HiveCluster.debug("HiveCluster:HiveTopology");
const EventEmitter = require('events');
const networkSeen = Symbol('networkSeen');
const Node = require('./Node');
const util = require("util");


module.exports = HiveCluster.BaseClass.extend({
	init: function (options) {
		this.endpoint = options.endpoint;

		this.events = new EventEmitter();

		this.nodes = new Map();
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

		let node = this.nodes.get(id);
		if (!node && create) {
			node = new Node(id);
			this.nodes.set(id, node);
		}

		return node;
	},
	getNodeList: function () {
		return this.nodes.values();
	},
	addReachability: function (node, peer, data) {

		const wasReachable = node.isReachable();
		// console.log("topology", peer.id, data);
		if (node.addReachability(peer, data)) {
			// Reachability changed, tell our peers about this
			this.queueBroadcast();
		}

		if (!wasReachable) {
			// console.log('HiveNode', node.id, 'now reachable');
			debug('HiveNode', node.id, 'now reachable');
			this.events.emit('available', node);
		}
	},
	removeReachability: function (node, peer) {
		const wasReachable = node.isReachable();

		const result = node.removeReachability(peer);
		if (result != -1) {
			// Reachability changed, tell our peers about this
			this.queueBroadcast();
		}

		if (!node.isReachable() && wasReachable) {
			debug('HiveNode', node.id, 'no longer reachable');
			this.nodes.delete(node.id);
			this.events.emit('unavailable', node);
		}
		// else if(result == 1){
		// 	console.log(node);
		// 	this.events.emit('update', node);
		// }
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

		const node = this.get(peer.id);
		this.addReachability(node, peer, []);
	},
	handleNodes: function (peer, data) {
		console.log("============== HANDLE NODES ("+ peer.id +") ================");
		console.log("Routing Table");
		console.log(peer.id, data);
		console.log("Routing Table END");
		// Add the current peer to available items so that is not removed later
		const available = new Set();
		available.add(peer.id);

		// Expose all of the peers that can be seen by the other node
		for (const p of data) {
			if (p.id === HiveCluster.id) {
				continue;
			}

			const node = this.get(p.id);
			if (p.info) {
				node.directAddress = p.info.address;
				node.directPort = p.info.port;
				// debug("RECV info [from: "+peer.id+"]:", node.id, "direct:", node.directAddress + ":" + node.directPort);
			}

			console.log("handle nodes peer", peer.id);
			// TODO: nodes should announce PEER ID + HOPS to it
			var newPath = [peer.id, ...p.path];

			console.log(p.id, "path", node.getPath(), "new path", newPath);

			if(!node.isReachable() && p.path.indexOf(HiveCluster.id) != -1 && node.getPath().indexOf()){
				console.log("not reacheable, but found reachable through me!");
			}
			this.addReachability(node, peer, newPath);

			available.add(p.id);
		}

		// Go through the peers and remove the peer from others
		for (const other of this.nodes.values()) {
			if (!available.has(other.id)) {
				this.removeReachability(other, peer);
			}
		}
		console.log("========================================");
	},
	handleDisconnect: function (peer) {
		for (const node of this.nodes.values()) {
			this.removeReachability(node, peer);
		}
	},
	handleMessage: function (peer, msg) {
		const source = msg[0];
		const target = msg[1];
		const message = msg[2];


		const targetNode = this.nodes.get(target);
		const sourceNode = this.nodes.get(source);


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
				returnPath: sourceNode,
				type: message.type,
				data: message.data
			});
		}
	},
	queueBroadcast: function () {
		if (this.broadcastTimeout)
			return;

		this.broadcastTimeout = setTimeout(() => {
			if (debug.enabled) {
				debug('Broadcasting routing to all connected peers');
				debug('Peers:', Array.from(this.peers.keys()).join(', '));

				debug('Nodes:');
				for (const node of this.nodes.values()) {
					debug(node.id, 'via', node.getPath().join(' -> '));
				}
			}

			const routingTable = this.getRoutingTable();

			for (const peer of this.peers.values()) {
				peer.write('nodes', routingTable);
			}

			this.broadcastTimeout = null;
		}, 100);
	},
	getRoutingTable: function(){
		const nodes = [];
		let data;
		for (const node of this.nodes.values()) {
			data = {
				id: node.id,
				path: node.getPath()
			};
			if(node.getDistance() == 0){
				data.info = {
					address: node.peer.address,
					port: node.peer.port,
				};
			}

			nodes.push(data);
		}

		return nodes;
	}
});