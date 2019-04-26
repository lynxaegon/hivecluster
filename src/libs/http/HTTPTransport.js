const AbstractTransport = require("../core/transport/AbstractTransport");
const events = AbstractTransport.events;
const http = require("http");
const HTTPPeer = require("./HTTPPeer");

module.exports = AbstractTransport.extend({
	init: function(options){
		this._super.call(this, 'http');

		this.options = Object.assign({
			port: 80
		}, options);
	},
	start: function(options){
		return this._super.apply(this, arguments).then(started => {
			if(!started)
				return false;

			return new Promise((resolve, reject) => {
				const listenCallback = () => {
					this.debug('Server started at port', this.port);
					resolve();
				};

				this.server = http.createServer((req, res) => {
					req.body = [];
					req.on('error', (err) => {
						console.log(err);
					}).on('data', (chunk) => {
						req.body.push(chunk);
					}).on('end', () => {
						req.body = Buffer.concat(req.body).toString();

						this[events].emit('_hiveNetworkEvent', "/http",
							new HTTPPeer(req, res)
							.header("HIVE-CLUSTER-ID", options.hiveNetworkName)
						);
					});
				}).listen(this.options.port, listenCallback).on('error', reject);
			});
		});
	}
});