const Peer = require("./Peer");

module.exports = class InternalPeer extends Peer {
	write(type, payload) {
		return new Promise((resolve, reject) => {
			process.nextTick(() => {
				this.events.emit(type, payload);
			});
			resolve();
		});
	}

	isInternal(){
		return true;
	}
};