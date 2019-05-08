module.exports = class Node {
	constructor(id) {
		this.id = id;
		this.directAddress = null;
		this.directPort = null;
	}

	forward(source, message) {
		if (!this.peer)
			return;

		this.peer.send([source, this.id, message]);
	}

	send(type, data) {
		console.log("Send", arguments);
		if (!this.peer)
			return;

		this.peer.send([HiveCluster.id, this.id, {type, data}]);
	}

	setPeer(peer, distance) {
		this.peer = peer;
		this.distance = distance;
		this.direct = this.distance == 0;
	}

	encodeInfo() {
		return {
			address: this.peer.address,
			port: this.peer.port
		};
	}

	decodeInfo(info) {
		if (info) {
			this.directAddress = info.address;
			this.directPort = info.port;
		}
	}

	isReachable() {
		return !!this.peer
	}

	removePeer() {
		this.peer = null;
		this.direct = false;
		this.distance = -1;
	}
};