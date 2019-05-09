const EventEmitter = require('events').EventEmitter;
const wrapped = Symbol('wrapped');
const seq = Symbol('seq');
const _seq = Symbol('_seq');
const packets = Symbol('packets');

module.exports = class HiveNode extends EventEmitter {
	constructor(other, networkName) {
		super();

		this.networkName = networkName;
		this[wrapped] = other;

		this[packets] = {};
	}

	getID() {
		return this[wrapped].id;
	}

	send(payload) {
		this[wrapped].send([1, payload.serialize(this[seq]())]);
	}

	processReply(packet) {
		if (this[packets]["_" + packet.seq]) {
			this[packets]["_" + packet.seq].onReply(packet);
		} else {
			console.error("Invalid reply packet. Should drop!", packet);
		}
	}

	isAvailable() {
		return this[wrapped].isReachable();
	}

	getDistance() {
		return this[wrapped].distance;
	}

	getDirectAddress() {
		if (!this[wrapped].directAddress)
			return null;

		return {
			address: this[wrapped].directAddress,
			port: this[wrapped].directPort,
		};
	}

	get path() {
		if (!this[wrapped].peer)
			return null;

		return this[wrapped].peer.id;
	}

	[seq]() {
		if (!this[_seq] || this[_seq] >= 100)
			this[_seq] = 0;

		this[_seq]++;

		return this[_seq];
	}

	isDirect() {
		return this[wrapped].direct;
	}

	disconnect() {
		return this[wrapped].peer.requestDisconnect();
	}
};