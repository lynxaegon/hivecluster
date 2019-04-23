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
		// if(port == 5000 - 1){
		// 	return;
		// }
		// if(port == 5000 - 2){
		// 	return;
		// }
		// this.addPeer("127.0.0.1", port);
		// if(this.transport.options.port == 5001){
		// 	this.addPeer("127.0.0.1", 5000);
		// }
		// if(this.transport.options.port == 5002){
		// 	this.addPeer("127.0.0.1", 5000);
		// 	this.addPeer("127.0.0.1", 5001);
		//
		// }
		// if(this.transport.options.port == 5003){
		// 	this.addPeer("127.0.0.1", 5001);
		// }
	},
	addPeer: function(address, port){
		this.transport.addPeer(address, port);
	}
});