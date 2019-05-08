const data = Symbol("data");
const request = Symbol("request");
const seq = Symbol("seq");
module.exports = class HivePacket {
	constructor() {
		this[request] = null;
		this[data] = {};
		this[seq] = 0;

		this.replyFnc = false;
		this.replyFailFnc = false;
	}

	setRequest(req) {
		this[request] = req;
		return this;
	}

	setData(pkg) {
		this[data] = pkg;
		return this;
	}

	onReply(replyFnc) {
		this.replyFnc = replyFnc;
		return this;
	}

	onReplyFail(replyFailFnc) {
		this.replyFailFnc = replyFailFnc;
		return this;
	}

	serialize(seq) {
		this[seq] = seq;
		let packet = {
			req: this[request],
			data: this[data],
			seq: this[seq]
		};

		if (this[seq] < 0) {
			// reply packet
			delete packet.req;
			delete packet.seq;
			packet.seqr = -this[seq];
		}

		return packet;
	}

	deserialize(packet) {
		return {
			seq: packet.data.seq || packet.data.seqr,
			data: packet.data.data,
			reply: function (data) {
				// TODO: implement reply sending
				console.error("!!!!!!!!!!REPLY NOT IMPLEMENTED!!!!!!!!");
			}
		};
	}
};