const EventEmitter = require('events').EventEmitter;
const wrapped = Symbol('wrapped');

module.exports = HiveClusterModules.BaseClass.extendObject(EventEmitter,{
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