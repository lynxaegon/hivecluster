const EventEmitter = require('events').EventEmitter;
const events = Symbol('events');

const HiveNode = require('./HiveNode');
const topologySymbol = Symbol('topology');
const nodesSymbol = Symbol('nodes');
const directConnections = Symbol("directConnections");

// TODO: Multiple transports are supported, but some functionality doesn't work
// TODO: (ex: FullMesh works only for the first transport)
module.exports = class Network {
	constructor(hiveTopology, options) {
		if (!options.name)
			throw new Error('Network name is required');

		this.debug = HiveClusterModules.debug("HiveCluster");
		this[events] = new EventEmitter();

		this.name = options.name + "-" + options.transport.name;

		this.directConnectionTimeout = false;

		this.transports = [];
		this.started = false;

		const topology = this[topologySymbol] = hiveTopology;
		const nodes = this[nodesSymbol] = new Map();
		topology.on('available', n => {
			const node = new HiveNode(n, options.name);
			nodes.set(n.id, node);
			this[events].emit('node:available', node);
			node.emit('available');
			this[directConnections](options.transport);
		});

		topology.on('update', n => {
			const node = nodes.get(n.id);
			if (!node)
				return;

			this[events].emit('node:update', node);
			node.emit('update');
			this[directConnections](options.transport);
		});

		topology.on('unavailable', n => {
			const node = nodes.get(n.id);
			if (!node)
				return;

			nodes.delete(n.id);
			this[events].emit('node:unavailable', node);
			node.emit('unavailable');
		});

		topology.on('message', msg => {
			const node = nodes.get(msg.node.id);
			const event = {
				node: node,
				protocol: msg.protocol,
				data: msg.data,
				time: msg.time
			};

			this[events].emit('message', event);
			node.emit('message', event);
		});
		this.addTransport(options.transport);
	}

	getTopology() {
		return this[topologySymbol].networkGraph;
	}

	on(event, handler) {
		this[events].on(event, handler);
		return this;
	}

	off(event, handler) {
		this[events].removeListener(event, handler);
		return this;
	}

	addTransport(transport) {
		this.transports.push(transport);

		transport.on('connected', peer => this[topologySymbol].addPeer(peer));
		transport.on('_hiveNetworkEvent', (...args) => {
			this[events].emit.call(this[events], "_hiveNetworkEvent", ...args);
		});

		if (this.started) {
			transport.start({
				id: HiveCluster.id,
				name: this.name
			});
		}
	}

	start() {
		if (this.started)
			return Promise.resolve(false);

		this.debug('About to join network as ' + HiveCluster.id);

		const options = {
			id: HiveCluster.id,
			name: this.name
		};

		this.started = true;
		return Promise.all(
			this.transports.map(t => t.start(options))
		).then(() => {
			return true;
		}).catch(err => {
			this.started = false;
			throw err;
		});
	}

	stop() {
		if (!this.started)
			return Promise.resolve(false);

		return Promise.all(
			this.transports.map(t => t.stop())
		).then(() => {
			this.started = false;
			return true;
		});
	}

	setup() {
		this[topologySymbol].start();
	}

	[directConnections](transport) {
		if (this[topologySymbol].type == this[topologySymbol].CLIENTS)
			return;

		clearTimeout(this.directConnectionTimeout);
		this.directConnectionTimeout = setTimeout(() => {
			let socket;
			for (let node of this[nodesSymbol].values()) {
				if (!node.isDirect()) {
					socket = node.getDirectAddress();
					if (socket !== null) {
						console.log("connecting directly", socket.address, socket.port);
						transport.addPeer(socket.address, socket.port);
					}
				}
			}
		}, 1000);
	};
};