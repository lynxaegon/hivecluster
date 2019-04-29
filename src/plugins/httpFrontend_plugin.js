const url = require('url');
module.exports = HiveClusterModules.HivePlugin.extend({
	init: function(){
		this._super.apply(this, arguments);

		this._routes = {};
		this._routesRegexp = [];

		this.setup();
		this.pluginLoaded();
		console.log("loaded");
	},
	setup: function(){
		// var self = this;
		// HiveNetwork.on("/system/http", function(event, req, res){
		// 	req.body = [];
		// 	req.on('error', function(err) {
		// 		Logger.log(err);
		// 	}).on('data', function(chunk) {
		// 		req.body.push(chunk);
		// 	}).on('end', function() {
		// 		req.body = Buffer.concat(req.body).toString();
		// 		self.processRoutes(req, res);
		// 	});
		// });

		// this.on("/", function(result, url, params){
		// 	result.body("empty response");
		// 	result.end();
		// }, this);
	},
	on: function(path, callback, ctx){
		if(path instanceof RegExp){
			this._routesRegexp.push({
				path: path,
				cb: callback.bind(ctx||{})
			});
		} else {
			this._routes[path.toLowerCase()] = callback.bind(ctx||{});
		}

		return this;
	},
	off: function(path){
		var idx = this._routes.indexOf(path);
		if(idx !== -1){
			this._routes.splice(idx, 1);

			return true;
		}
		return false;
	},
	processRoutes: function(req, res){
		//////////////////////////////////////////////////////////////
		// TODO: implement `formidable` package for parsing requests
		// https://www.npmjs.com/package/formidable
		//////////////////////////////////////////////////////////////
		req.realUrl = url.parse(req.url, true);
		req.query = {
			post: req.body,
			get: req.realUrl.query
		};
		req.realUrl = req.realUrl.pathname;

		if(this._routes[req.realUrl]){
			this._processPath(this._routes[req.realUrl], req, res);
			return true;
		}

		for(var i in this._routesRegexp){
			if(!this._routesRegexp.hasOwnProperty(i))
				continue;

			if(this._routesRegexp[i].path.test(req.realUrl)){
				this._processPath(this._routesRegexp[i].cb, req, res);
				return true;
			}
		}

		Logger.log("404 sent for", req.realUrl);
		// return 404
		this._processPath(function (result) {
			result
			.status(404)
			.end();
		}, req, res);
		return false;
	},
	_processPath: function(callback, req, res){
		var result = {
			_headers: {
				"HIVE-NODE-ID": HiveNetwork.getNodeId(),
				"HIVE-CLUSTER-ID": HiveNetwork.getNetworkName()
			},
			_body: [],
			_status: 200,
			status: function(code){
				this._status = code;
				return this;
			},
			header: function(name, body){
				this._headers[name] = body;
				return this;
			},
			body: function(chunk){
				this._body.push(chunk);
				return this;
			},
			end: function(){
				res.writeHead(result._status, result._headers);

				if(result._body.length > 0)
					for(var i in result._body){
						if(!result._body.hasOwnProperty(i))
							continue;
						res.write(result._body[i]);
					}

				res.end();
			}
		};

		callback(result, req.realUrl, req.query, req, res);
	}
});