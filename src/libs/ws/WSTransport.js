const WebSocket = require('ws');
const AbstractTransport = require("../core/transport/AbstractTransport");
const addPeer = AbstractTransport.addPeer;
const WSPeer = require('./WSPeer');

module.exports = AbstractTransport.extend({
	init: function(options) {
		this._super.call(this, 'ws');

		this.options = Object.assign({
			port: 3000
		}, options);
	},
	start: function() {
		return this._super.apply(this, arguments).then(started => {
			if(!started)
				return false;

			return new Promise((resolve, reject) => {
				this.ws = new WebSocket.Server(this.options);

				this.ws.on('connection', socket => {
					this[addPeer](new WSPeer(this, socket));
				});

				this.ws.on('error', err => {
					this.debug('Ignoring error:', err);
				});

				if(this.options.server) {
					resolve(true);
				} else {
					this.ws.on('listening', () => resolve(true));
				}
			});
		});
	}
});