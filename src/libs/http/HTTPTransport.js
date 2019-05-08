const AbstractTransport = require("../core/transport/AbstractTransport");
const events = AbstractTransport.events;
const http = require("http");
const HTTPPeer = require("./HTTPPeer");

module.exports = class HTTPTransport extends AbstractTransport {
	constructor(options) {
		super('http');

		this.options = Object.assign({
			port: 80
		}, options);
	}

	start(options) {
		return super.start(options).then(started => {
			if (!started)
				return false;

			return new Promise((resolve, reject) => {
				const listenCallback = () => {
					this.debug('Server started at port', this.options.port);
					resolve();
				};

				this.server = http.createServer((req, res) => {
					this[events].emit('_hiveNetworkEvent', "/http", new HTTPPeer(req, res), req, res);
				}).listen(this.options.port, listenCallback).on('error', reject);
			});
		});
	}
};