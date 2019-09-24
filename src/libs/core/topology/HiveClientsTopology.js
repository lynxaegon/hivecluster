const networkSeen = Symbol('networkSeen');
const internalNode = Symbol('internalNode');
const HiveClientNode = require('./HiveClientNode');
const HiveTopology = require("./HiveTopology");

module.exports = class HiveClientsTopology extends HiveTopology {
	get type() {
		return this.CLIENTS;
	}

	get(id, create) {
		create = create === undefined;

		let node = this.networkGraph.node(id);
		if (!node && create) {
			node = new HiveClientNode(id);
			this.networkGraph.setNode(id, node);
		}

		return node;
	}

	addPeer(peer) {
		super.addPeer(peer);

		if (!peer[networkSeen]) {
			peer.on('message', (msg, time) => this.handleMessage(peer, msg, time));

			peer.on('disconnected', () => {
				this.peers.delete(peer.id);

				this.handleDisconnect(peer);
			});

			peer[networkSeen] = true;
		}

		// create the node and add it to the network
		const node = this.get(peer.id);
		node.setPeer(peer, 0);
		this.events.emit("available", node);
	}

	handleDisconnect(peer) {
		const node = this.networkGraph.node(peer.id);
		if(node) {
			this.networkGraph.removeNode(peer.id);
			this.events.emit("unavailable", node);
		}
	}

	handleMessage(peer, msg, time) {
		this.events.emit('message', {
			node: this.networkGraph.node(peer.id),
			protocol: msg[0],
			data: msg[1],
			time: time
		});
	}
};