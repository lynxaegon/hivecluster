const HivePlugin = require('libs/core/plugins/HivePlugin');

module.exports = class MonitoringPlugin extends HivePlugin {
	setup() {
		this.hiveNetwork.on("test", function(){
			console.log(arguments);
		});
	}
};