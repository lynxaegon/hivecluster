module.exports = class Node {
	constructor(id) {
		this.id = id;
		this._weight = -1;
		this.directAddress = null;
		this.directPort = null;

		if(this.id == HiveCluster.id)
			this._weight = HiveCluster.weight;
	}

	get weight() {
		return this._weight;
	}

	set weight(weight) {
		if(weight == -1)
			return;

		this._weight = weight;
	}

	isInternal() {
		if(!this.peer)
			return false;

		return this.peer.isInternal();
	}

	send(payload) {
		return new Promise((resolve, reject) => {
			if (!this.peer) {
				reject();
				return;
			}

			this.peer.write("message", payload).then(resolve).catch(reject);
		});
	}

	setPeer(peer, distance) {
		this.peer = peer;
		this.distance = distance;
		this.direct = this.distance == 0;
		this.weight = peer.weight;
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