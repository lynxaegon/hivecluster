const EventEmitter = require('events').EventEmitter;
const wrapped = Symbol('wrapped');

module.exports = HiveCluster.BaseClass.extendObject(EventEmitter,{
	init: function(other){
		this._super.call(this);
		this[wrapped] = other;
	},
	getID: function(){
		return this[wrapped].id;
	},
	send: function(type, payload){
		this[wrapped].send(type, payload);
	},
	isAvailable: function(){
		return this[wrapped].isReachable();
	},
	getDistance: function(){
		return this[wrapped].getDistance();
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
		return this[wrapped].getPath();
	},
	getPeer: function(){
		return this[wrapped].peer;
	},
	isDirect: function(){
		return this[wrapped].direct;
	},
	disconnect: function(){
		return this[wrapped].peer.requestDisconnect();
	}
});