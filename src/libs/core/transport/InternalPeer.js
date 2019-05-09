const Peer = require("./Peer");

module.exports = class InternalPeer extends Peer {
	send(payload) {
		this.events.emit("message", payload);
	}
};