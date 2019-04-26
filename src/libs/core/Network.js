const EventEmitter = require('events').EventEmitter;
const events = Symbol('events');

const HiveNode = require('./HiveNode');
const HiveTopology = require('./topology/HiveTopology');
const topologySymbol = Symbol('topology');
const nodesSymbol = Symbol('nodes');
const directConnections = Symbol("directConnections");

// TODO: Multiple transports are supported, but some functionality doesn't work
// TODO: (ex: FullMesh works only for the first transport)
module.exports = HiveClusterModules.BaseClass.extend({
	init: function(options){
		if(!options.name)
			throw new Error('Network name is required');

		this.debug = HiveClusterModules.debug("HiveCluster");
		this[events] = new EventEmitter();

		this.hiveNetworkName = options.name;
		this.name = options.name + "-" + options.transport.name;
		this.fullMesh = options.fullMesh || false;

		this.directConnectionTimeout = false;

		this.transports = [];
		this.started = false;

		const topology = this[topologySymbol] = new HiveTopology(options);
		const nodes = this[nodesSymbol] = new Map();
		topology.on('available', n => {
			const node = new HiveNode(n);
			nodes.set(n.id, node);
			this[events].emit('node:available', node);
			node.emit('available');
			this[directConnections](options.transport);
		});

		topology.on('update', n => {
			const node = nodes.get(n.id);
			if(!node)
				return;

			this[events].emit('node:update', node);
			node.emit('update');
			this[directConnections](options.transport);
		});

		topology.on('unavailable', n => {
			const node = nodes.get(n.id);
			if(!node)
				return;

			nodes.delete(n.id);
			this[events].emit('node:unavailable', node);
			node.emit('unavailable');
		});

		topology.on('message', msg => {
			const node = nodes.get(msg.node.id);

			const event = {
				node: node,
				type: msg.type,
				data: msg.data
			};

			this[events].emit('message', event);
			node.emit('message', event);
		});

		this[directConnections] = (transport) => {
			if(!this.fullMesh)
				return;

			clearTimeout(this.directConnectionTimeout);
			this.directConnectionTimeout = setTimeout(() => {
				let socket;
				for(let node of this[nodesSymbol].values()){
					if(!node.isDirect()){
						socket = node.getDirectAddress();
						if(socket !== null) {
							console.log("connecting directly", socket.address, socket.port);
							transport.addPeer(socket.address, socket.port);
						}
					}
				}
			}, 1000);
		};

		this.addTransport(options.transport);
	},
	on: function(event, handler){
		this[events].on(event, handler);
	},
	off: function(event, handler){
		this[events].removeListener(event, handler);
	},
	addTransport: function(transport) {
		this.transports.push(transport);

		transport.on('connected', peer => this[topologySymbol].addPeer(peer));
		transport.on('_hiveNetworkEvent', (...args) => {
			this[events].emit.call(this[events], "_hiveNetworkEvent", ...args);
		});

		if(this.started) {
			transport.start({
				id: HiveCluster.id,
				name: this.name,
				hiveNetworkName: this.hiveNetworkName
			});
		}
	},
	start: function() {
		if(this.started)
			return Promise.resolve(false);

		this.debug('About to join network as ' + HiveCluster.id);

		const options = {
			id: HiveCluster.id,
			name: this.name,
			hiveNetworkName: this.hiveNetworkName
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
	},
	stop: function(){
		if(	!this.started)
			return Promise.resolve(false);

		return Promise.all(
			this.transports.map(t => t.stop())
		).then(() => {
			this.started = false;
			return true;
		});
	}
});