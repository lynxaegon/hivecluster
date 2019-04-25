module.exports = HiveCluster.BaseClass.extend({
	start: function(transport){
		this.transport = transport;
		this.search();
	},
	search: function(){
		var port = this.transport.options.port - 1;
		var port2 = this.transport.options.port - 2;
		if(port >= 5000){
			this.addPeer("127.0.0.1", port);
		}
		if(port2 >= 5000){
			this.addPeer("127.0.0.1", port2);
		}
	},
	addPeer: function(address, port){
		this.transport.addPeer(address, port);
	}
});