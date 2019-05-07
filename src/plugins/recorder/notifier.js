// Custom Plugin
const https = require('http');
const url = require("url");
module.exports = HiveClusterModules.BaseClass.extend({
	init: function(options){
		this.options = options;
		this.setup();
	},
	setup: function(){
		const path = url.parse(this.options.path, true);
		HiveCluster.EventBus.on("/debug/record", (packet) => {
			// ignoring types
			if(["ping", "auth"].indexOf(packet.type) != -1)
				return;

			let options = {
				hostname: path.hostname,
				port: path.port,
				path: path.path,
				method: 'GET'
			};
			options.path += "?from="+HiveCluster.id+"&to="+packet.to+"&data=" + JSON.stringify(packet);
			const req = https.request(options);
			req.end();
		});
	}
});