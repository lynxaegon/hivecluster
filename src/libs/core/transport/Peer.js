const EventEmitter = require('events').EventEmitter;
const FailureDetector = require('adaptive-accrual-failure-detector');

const pingInterval = 5000;
const pingCheckInterval = 1000;

module.exports = HiveCluster.BaseClass.extend({
	init: function(transport){
		this.id = transport.id;
		const ns = transport.debug ? transport.debug.namespace + ":peer" : "HiveCluster:peer";
		this.debug = HiveCluster.debug(ns);
		this.events = new EventEmitter();
		this.timeouts = {};
		this.intervals = {};

		this.connected = false;
		this.failureDetector = new FailureDetector();

		this.events.on('auth', msg => {
			this.processAuthPackage(msg);

			this.debug = HiveCluster.debug(ns + ':' + msg.id);
			if(this.timeouts.auth){
				clearTimeout(this.timeouts.auth);
			}

			// setup pings
			this.intervals.pingSender = setInterval(() => this.write('ping'), pingInterval);
			this.intervals.pingChecker = setInterval(() => this.checkFailure(), pingCheckInterval);

			// instant ping
			this.write('ping');
		});


		// handle pings
		this.on('ping', () => {
			if(!this.connected){
				this.connected = true;
				this.events.emit('connected');
			}

			this.failureDetector.registerHeartbeat();
		});
	},
	on(event, handler) {
		this.events.on(event, handler);
	},
	getAuthPackage: function(){
		return {
			id: this.id
		}
	},
	processAuthPackage: function(msg){
		this.id = msg.id;
	},
	auth: function(){
		this.write('auth', this.getAuthPackage());

		if(this.timeouts.auth){
			clearTimeout(this.timeouts.auth);
		}

		this.timeouts.auth = setTimeout(() =>
			this.requestDisconnect(new Error("Timeout during auth")),
 		5000);
	},
	write(type, payload) {
		throw new Error('write(type, payload) must be implemented');
	},
	send(payload) {
		this.write('message', payload);
	},
	requestDisconnect(err) {
		if(typeof err !== 'undefined') {
			this.debug("Requested disconnect via error:", err);
		}
	},
	handleDisconnect: function(err){
		if(typeof err !== 'undefined') {
			this.debug('Disconnected via an error:', err);
		} else {
			this.debug('Disconnected gracefully');
		}

		for(var i in this.timeouts){
			clearTimeout(this.timeouts[i])
		}

		for(var i in this.intervals){
			clearInterval(this.intervals[i])
		}

		this.connected = false;
		this.events.emit('disconnected');
	},
	disconnect() {
		this.debug('Requesting disconnect from peer');
	},
	checkFailure: function(){
		let result = this.failureDetector.checkFailure();
		// console.log("CheckFailure", this.id, result);
		if(result) {
			this.requestDisconnect("Marked as failure");
		}
	}
});