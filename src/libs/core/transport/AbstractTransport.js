const EventEmitter = require('events').EventEmitter;

const events = Symbol('events');
const peers = Symbol('peers');
const addPeer = Symbol('addPeer');

module.exports = HiveCluster.BaseClass.extend({
	init: function (name) {
		this.name = name;
		this[events] = new EventEmitter(this);
		this[peers] = new Map();

		this.started = false;
		this.debug = HiveCluster.debug('HiveCluster:' + name);

		this[addPeer] = function(peer){
			peer.on('connected', () => {
				if(peer.id === this.id) {
					this.debug('Connected to self, requesting disconnect');
					peer.disconnect();
					return;
				}

				if(this[peers].has(peer.id)) {
					if(peer.merge) {
						this[peers].get(peer.id).merge(peer);
					} else {
						peer.disconnect();
					}
				} else {
					// New peer, connect to it
					this[peers].set(peer.id, peer);
					this[events].emit('connected', peer);
				}
			});

			peer.on('disconnected', () => {
				const stored = this[peers].get(peer.id);
				console.log("peer disconnected", peer.id);
				if(stored === peer) {
					this[peers].delete(peer.id);
					this[events].emit('disconnected', peer);
				}
			});
		}
	},
	on: function (event, handler) {
		this[events].on(event, handler);
	},
	off: function (event, handler) {
		this[events].removeListener(event, handler);
	},
	start: function (options) {
		if (this.started) {
			return Promise.resolve(false);
		}

		this.debug('Starting with id `' + options.id + '`');
		this.started = true;
		this.id = options.id;

		return Promise.resolve(true);
	},
	stop: function(){
		if(!this.started) {
			return Promise.resolve(false);
		}

		for(const peer of this[peers].values()) {
			peer.disconnect();
		}

		this.started = false;
		return Promise.resolve(true);
	}
});

module.exports.addPeer = addPeer;
module.exports.events = events;