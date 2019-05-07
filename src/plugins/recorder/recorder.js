const fs = require('fs');

module.exports = HiveClusterModules.HivePlugin.extend({
	init: function(){
		this._super.apply(this, arguments);
		this.router = this.getPlugin("httpRouter");

		this.setup();
		this.pluginLoaded();
	},
	setup: function(){
		this.router.on("/recorder", (httpPeer) => {
			console.log("["+httpPeer.query().get.from+" -> "+httpPeer.query().get.to+"]", httpPeer.query().get.data);
			httpPeer.end();
		});
	}
});