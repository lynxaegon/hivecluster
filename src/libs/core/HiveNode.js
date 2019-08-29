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

	getWeight() {
		return this[wrapped].weight;
	}

	isInternal() {
		return this[wrapped].isInternal();
	}

	send(payload) {
        let seqID;
		if(!payload.isReply()){
			seqID = this[seq]();
        } else {
			seqID = payload.getSEQ();
		}
		if(payload.awaitReply()){
			this[packets]["_" + seqID] = {
				onReply: payload.replyFnc,
				onReplyFail: payload.replyFailFnc,
				timeout: setTimeout(() => {
					console.log("reply timeout!", payload);
					let replyFail = this[packets]["_" + seqID].onReplyFail;
					delete this[packets]["_" + seqID];

					if(replyFail){
						replyFail();
					}
				}, 5000)
			};
		}
		return this[wrapped].send([1, payload.serialize(seqID)]);
	}

	processReply(packet) {
		if (this[packets]["_" + packet.seq]) {
			let reply = this[packets]["_" + packet.seq].onReply;
			clearTimeout(this[packets]["_" + packet.seq].timeout);
			delete this[packets]["_" + packet.seq];

			reply(packet);
		} else {
			console.error("Invalid reply packet. Should drop!");
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