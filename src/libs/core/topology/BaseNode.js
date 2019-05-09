module.exports = class Node {
	constructor(id) {
		this.id = id;
		this.directAddress = null;
		this.directPort = null;
	}

	send(payload) {
		if (!this.peer)
			return;

		console.log(payload);
		this.peer.send(payload);
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