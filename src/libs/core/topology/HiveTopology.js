const EventEmitter = require('events');
const networkSeen = Symbol('networkSeen');
const internalNode = Symbol('internalNode');
const graphlib = require("graphlib");

module.exports = class HiveSystemTopology {
	constructor(options) {
		this.options = options || {};
		this.events = new EventEmitter();
		this.networkGraph = new graphlib.Graph({
			directed: false
		});
		this.peers = new Map();
		this.started = false;
	}

	get SYSTEM(){
		return 1;
	}

	get CLIENTS(){
		return 2;
	}

	get type() {
		return -1;
	}

	start() {
		if (this.started)
			return;
		this.started = true;
	}

	on(event, handler) {
		this.events.on(event, handler);
	}

	addPeer(peer) {
		this.peers.set(peer.id, peer);
	}
};