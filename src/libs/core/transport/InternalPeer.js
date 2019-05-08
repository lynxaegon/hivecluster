const Peer = require("./Peer");

module.exports = class InternalPeer extends Peer {
	write(type, payload) {
		this.events.emit(type, payload);
	}
};