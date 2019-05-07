const Peer  = require("./Peer");

module.exports = Peer.extend({
	write: function(type, payload){
		this.events.emit(type, payload);
	}
});