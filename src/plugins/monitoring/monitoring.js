const fs = require('fs');

module.exports = HiveClusterModules.HivePlugin.extend({
	init: function(){
		this._super.apply(this, arguments);
		this.router = this.getPlugin("httpRouter");

		this.staticFiles = {};

		this.setup();
		this.pluginLoaded();
	},
	setup: function(){
		let list = [
			"static/cytoscape.min.js",
			"static/cytoscape-avsdf.js",
			"static/index.html",
		];
		let baseName;
		for(let item of list){
			baseName = item.split("/");
			baseName = baseName[baseName.length - 1];
			this.staticFiles[baseName] = fs.readFileSync(__dirname + "/" + item, 'utf8');
		}

		for(let file in this.staticFiles){
			this.router.on("/" + file, (httpPeer) => {
				httpPeer.header("content-type", "application/javascript; charset=utf-8");
				httpPeer.body(this.staticFiles[file]);
				httpPeer.end();
			});
		}

		this.router.on("/network", (httpPeer) => {
			httpPeer.header("content-type", "text/html; charset=utf-8");
			httpPeer.body(
				fs.readFileSync(__dirname + "/static/index.html", 'utf8')
					.replace("%%topology%%", JSON.stringify(HiveCluster.Nodes.getTopology()))
			);
			httpPeer.end();
		});
	}
});