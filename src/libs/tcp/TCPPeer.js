const NetworkPeer  = require("../core/transport/NetworkPeer");
const net = require("net");
module.exports = NetworkPeer.extend({
	merge: function(peer){
		peer.requestDisconnect("Deduplication!");
	},
	setConnectionString: function(address, port){
		this.address = address;
		this.port = port;
	},
	tryConnect: function(){
		const client = net.connect(this.port, this.address);
		// client.setKeepAlive(true);
		client.on('connect', () => {
			clearTimeout(this.timeouts.connect);
			this.debug('Connected via ' + this.address + ':' + this.port);
			this.auth();
		});
		client.on('error', (err) => {
			this.debug('Error ' + this.address + ':' + this.port, err);
		});
		this.setSocket(client);

		this.timeouts.connect = setTimeout(() =>
			this.requestDisconnect(new Error("Timeout during tryConnect")),
		2000);
	}
});