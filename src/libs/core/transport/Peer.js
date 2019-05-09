const EventEmitter = require('events').EventEmitter;
const FailureDetector = require('adaptive-accrual-failure-detector');

const pingInterval = 5000;
const pingCheckInterval = 1000;

module.exports = class Peer {
	constructor(transport) {
		this.transport = transport;
		this.id = transport.id;
		const ns = transport.debug ? transport.debug.namespace + ":peer" : "HiveCluster:peer";
		this.debug = HiveClusterModules.debug(ns);
		this.events = new EventEmitter();
		this.timeouts = {};
		this.intervals = {};

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

			this.failureDetector.registerHeartbeat();
		});
	}

	on(event, handler) {
		this.events.on(event, handler);
	}

	off(event, handler) {
		this.events.on(event, handler);
	}

	getAuthPackage() {
		return {
			id: this.id
		}
	}

	processAuthPackage(msg) {
		this.id = msg.id;
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
		if (typeof err !== 'undefined') {
			this.debug("Requested disconnect via error:", err);
		}
	}

	handleDisconnect(err) {
		if (typeof err !== 'undefined') {
			this.debug('Disconnected via an error:', err);
		} else {
			this.debug('Disconnected gracefully');
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
		let result = this.failureDetector.checkFailure();
		// console.log("CheckFailure", this.id, result);
		if (result) {
			this.requestDisconnect("Marked as failure");
		}
	}
};