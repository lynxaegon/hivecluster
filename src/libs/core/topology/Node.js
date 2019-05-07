module.exports = HiveClusterModules.BaseClass.extend({
	init: function (id) {
		this.id = id;
		this.directAddress = null;
		this.directPort = null;
	},
	forward: function (source, message) {
		if (!this.peer)
			return;

		this.peer.send([source, this.id, message]);
	},
	send(type, data) {
		console.log("Send", arguments);
		if (!this.peer)
			return;

		this.peer.send([HiveCluster.id, this.id, {type, data}]);
	},
	setPeer: function(peer, distance){
		this.peer = peer;
		this.distance = distance;
		this.direct = this.distance == 0;
	},
	encodeInfo: function(){
		return {
			address: this.peer.address,
			port: this.peer.port
		};
	},
	decodeInfo: function(info){
		if (info) {
			this.directAddress = info.address;
			this.directPort = info.port;
		}
	},
	isReachable: function(){
		return !!this.peer
	},
	removePeer: function(){
		this.peer = null;
		this.direct = false;
		this.distance = -1;
	}
});