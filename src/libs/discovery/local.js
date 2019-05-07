module.exports = HiveClusterModules.BaseClass.extend({
	start: function(transport){
		this.transport = transport;
		this.search();
	},
	search: function(){
		if(!this.transport.onDiscover)
			throw new Error("onDiscover doesn't exist for the current transport!");

		let port1 = this.transport.options.port - 1;
		let port2 = this.transport.options.port - 2;
		let list = [];
		if(port1 >= 5000){
			list.push({
				address: "127.0.0.1",
				port: port1
			});
		}

		if(port2 >= 5000){
			list.push({
				address: "127.0.0.1",
				port: port2
			});
		}
		if(list.length == 0)
			list = null;


		this.transport.onDiscover(list);
	}
});