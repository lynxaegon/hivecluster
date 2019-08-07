const EventEmitter = require('events').EventEmitter;
const FailureDetector = require('failure-detector').FailureDetector;

const pingInterval = 5000;
const pingCheckInterval = 1000;

module.exports = class Peer {
	constructor(transport) {
		this.transport = transport;
		this.id = transport.id;
		this.weight = -1;
		if(this.id == HiveCluster.id)
			this.weight = HiveCluster.weight;
		const ns = transport.debug ? transport.debug.namespace + ":peer" : "HiveCluster:peer";
		this.debug = HiveClusterModules.debug(ns);
		this.events = new EventEmitter();
		this.timeouts = {};
		this.intervals = {};
		this.connectionTime = (new Date()).getTime();

		this.connected = false;
		this.failureDetector = new FailureDetector();

		this.events.on('auth', msg => {
			this.processAuthPackage(msg);

			this.debug = HiveClusterModules.debug(ns + ':' + msg.id);
			if (this.timeouts.auth) {
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
			if (!this.connected) {
				this.connected = true;
				this.events.emit('connected');
			}

			this.failureDetector.report();
		});
	}

	isInternal() {
		return false;
	}

	on(event, handler) {
		this.events.on(event, handler);
	}

	off(event, handler) {
		this.events.on(event, handler);
	}

	getAuthPackage() {
		return {
			id: this.id,
			weight: this.weight
		};
	}

	processAuthPackage(msg) {
		this.id = msg.id;
		this.weight = msg.weight;
	}

	auth() {
		this.write('auth', this.getAuthPackage());

		if (this.timeouts.auth) {
			clearTimeout(this.timeouts.auth);
		}

		this.timeouts.auth = setTimeout(() =>
				this.requestDisconnect(new Error("Timeout during auth")),
			5000);
	}

	write(type, payload) {
		throw new Error('write(type, payload) must be implemented');
	}

	requestDisconnect(err) {
		console.log(this.id, "Requested disconnect via error:", err);
		console.log(this.id, "Failure class");
		console.log(this.failureDetector);
		console.log(this.id, "end of failure class with result: ", this.failureDetector.phi());
		// if (typeof err !== 'undefined') {
		// }
	}

	handleDisconnect(err) {
		if (typeof err !== 'undefined') {
			console.log('Disconnected via an error:', err);
			// this.debug('Disconnected via an error:', err);
		} else {
			console.log('Disconnected gracefully');
			// this.debug('Disconnected gracefully');
		}

		for (let i in this.timeouts) {
			clearTimeout(this.timeouts[i])
		}

		for (let i in this.intervals) {
			clearInterval(this.intervals[i])
		}

		this.connected = false;
		this.events.emit('disconnected', err);
	}

	disconnect() {
		this.debug('Requesting disconnect from peer');
	}

	checkFailure() {
		if(Date.now() - this.connectionTime > 30 * 1000) {
			let result = this.failureDetector.phi();
			// console.log("CheckFailure", this.id, result);
			if (result > 8) {
				console.log(this.id, "Failed with:", result);
				this.requestDisconnect("Marked as failure");
			}
		}
	}
};