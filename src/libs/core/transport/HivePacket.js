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

	awaitReply() {
		return this.replyFnc != false;
	}

	onReply(replyFnc) {
		this.replyFnc = replyFnc;
		return this;
	}

	onReplyFail(replyFailFnc) {
		this.replyFailFnc = replyFailFnc;
		return this;
	}

	replyFor(_seq){
		this[seq] = -_seq;
		return this;
	}

	getSEQ() {
		return this[seq];
	}

	isReply(){
		if(this[seq] < 0){
			return true;
		}

		return false;
	}

	serialize(_seq) {
		this[seq] = _seq;

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
			time: packet.time,
			node: packet.node,
			reply: function (data) {
				// Important! Only 1 reply supported!
				if(packet.data.seqr){
					throw new Error("Cannot reply to a reply packet!")
				}

				return this.node.send(new HivePacket()
					.setData(data)
					.replyFor(packet.data.seq)
				);
			}
		};
	}
};