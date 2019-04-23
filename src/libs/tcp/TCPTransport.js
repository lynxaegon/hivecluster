const AbstractTransport = require("../core/transport/AbstractTransport");
const addPeer = AbstractTransport.addPeer;
const TCPPeer = require("./TCPPeer");
const net = require('net');

const setupPeer = Symbol('setupPeer');
const stoppables = Symbol('stoppables');


module.exports = AbstractTransport.extend({
	init: function(options){
		this._super.call(this, 'tcp');

		this.options = Object.assign({
			port: 5000
		}, options);

		this[stoppables] = [];

		this[setupPeer] = function(data) {
			const peer = new TCPPeer(this);
			this[addPeer](peer);

			peer.setConnectionString(data.address, data.port);
			peer.tryConnect();

			return peer;
		}
	},
	start: function(options){
		return this._super.apply(this, arguments).then(started => {
			if(!started)
				return false;

			return new Promise((resolve) => {
				const listenCallback = () => {
					this.port = this.server.address().port;
					this.debug('Server started at port', this.port);
					resolve();
				};

				this.server = net.createServer((socket) => {
					const peer = new TCPPeer(this);
					peer.setSocket(socket);
					this[addPeer](peer);
					peer.auth();
				}).listen(this.options.port, listenCallback);

				this[stoppables].push({
					stop: () => this.server.close()
				});


				if(this.options.discovery){
					this.options.discovery.start(this);
				}
			});
		});
	},
	stop: function(){
		return this._super.apply(this, arguments).then(stopped => {
			if(!stopped)
				return false;

			return Promise.all(
				this[stoppables].map(item => Promise.resolve(item.stop()))
			);
		})
	},
	addPeer: function(address, port){
		if(this.started){
			this[setupPeer]({
				address: address,
				port: port
			});
		}
	}
});