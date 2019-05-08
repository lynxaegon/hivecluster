const HivePlugin = require('libs/core/plugins/HivePlugin');

module.exports = class HTTPRouterPlugin extends HivePlugin {
	constructor(pluginMgr, hiveNetwork, options) {
		super(pluginMgr, hiveNetwork, options);

		this._routes = {};
		this._routesRegexp = [];

		this.setup();
		this.pluginLoaded();
	}

	setup() {
		this.hiveNetwork.on("/http", (httpPeer, req, res) => {
			req.body = [];
			req.on('error', (err) => {
				console.log("Err", err);
			}).on('data', (chunk) => {
				req.body.push(chunk);
			}).on('end', () => {
				req.body = Buffer.concat(req.body).toString();

				httpPeer
				.header("HIVE-NODE-ID", HiveCluster.id)
				.header("HIVE-CLUSTER-ID", this.hiveNetwork.options.name);

				this.processRoutes(httpPeer);
			});
		});

		this.on("/", function (httpPeer) {
			httpPeer.body("empty response");
			httpPeer.end();
		}, this);
	}

	on(path, callback, ctx) {
		if (path instanceof RegExp) {
			this._routesRegexp.push({
				path: path,
				cb: callback.bind(ctx || {})
			});
		} else {
			this._routes[path.toLowerCase()] = callback.bind(ctx || {});
		}

		return this;
	}

	off(path) {
		let idx = this._routes.indexOf(path);
		if (idx !== -1) {
			this._routes.splice(idx, 1);

			return true;
		}
		return false;
	}

	processRoutes(httpPeer) {
		if (this._routes[httpPeer.url()]) {
			this._routes[httpPeer.url()](httpPeer);
			return true;
		}

		for (let i in this._routesRegexp) {
			if (!this._routesRegexp.hasOwnProperty(i))
				continue;

			if (this._routesRegexp[i].path.test(httpPeer.url())) {
				this._routesRegexp[i].cb(httpPeer);
				return true;
			}
		}

		console.log("404 sent for", httpPeer.url(), this._routes);
		// return 404
		httpPeer
		.status(404)
		.end();
	}
};