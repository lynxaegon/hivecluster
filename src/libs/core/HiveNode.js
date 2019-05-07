const EventEmitter = require('events').EventEmitter;
const wrapped = Symbol('wrapped');
const seq = Symbol('seq');
const _seq = Symbol('_seq');
const packets = Symbol('packets');

module.exports = HiveClusterModules.BaseClass.extendObject(EventEmitter,{
	init: function(other, networkName){
		this._super.call(this);
		this.networkName = networkName;
		this[wrapped] = other;

		this[seq] = () => {
			if(!this[_seq] || this[_seq] >= 100)
				this[_seq] = 0;

			this[_seq]++;

			return this[_seq];
		};

		this[packets] = {};
	},
	getID: function(){
		return this[wrapped].id;
	},
	send: function(payload){
		this[wrapped].send("hive", payload.serialize(this[seq]()));
	},
	processReply: function(packet){
		if(this[packets]["_" + packet.seq]){
			this[packets]["_" + packet.seq].onReply(packet);
		} else {
			console.error("Invalid reply packet. Should drop!", packet);
		}
	},
	isAvailable: function(){
		return this[wrapped].isReachable();
	},
	getDistance: function(){
		return this[wrapped].distance;
	},
	getDirectAddress: function(){
		if(!this[wrapped].directAddress)
			return null;

		return {
			address: this[wrapped].directAddress,
			port: this[wrapped].directPort,
		};
	},
	getPath: function(){
		if(!this[wrapped].peer)
			return null;

		return this[wrapped].peer.id;
	},
	isDirect: function(){
		return this[wrapped].direct;
	},
	disconnect: function(){
		return this[wrapped].peer.requestDisconnect();
	}
});