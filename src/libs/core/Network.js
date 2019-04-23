const EventEmitter = require('events').EventEmitter;
const events = Symbol('events');

const HiveNode = require('./HiveNode');
const HiveTopology = require('./topology/HiveTopology');
const topologySymbol = Symbol('topology');
const nodesSymbol = Symbol('nodes');

module.exports = HiveCluster.BaseClass.extend({
	init: function(options){
		if(!options.name)
			throw new Error('Network name is required');

		this.debug = HiveCluster.debug("HiveCluster");
		this[events] = new EventEmitter();

		this.name = options.name;

		this.transports = [];
		this.active = false;

		const topology = this[topologySymbol] = new HiveTopology(options);
		const nodes = this[nodesSymbol] = new Map();
		topology.on('available', n => {
			const node = new HiveNode(n);
			nodes.set(n.id, node);
			this[events].emit('node:available', node);
			node.emit('available');
		});

		topology.on('update', n => {
			const node = nodes.get(n.id);
			if(!node)
				return;

			this[events].emit('node:update', node);
			node.emit('update');
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
			const node = nodes.get(msg.returnPath.id);

			const event = {
				returnPath: node,
				type: msg.type,
				data: msg.data
			};

			this[events].emit('message', event);
			node.emit('message', event);
		});

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

		if(this.started) {
			transport.start({
				id: HiveCluster.id,
				name: this.name
			});
		}
	},
	start: function() {
		if(this.started)
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
	},
	stop: function(){
		if(	!this.active)
			return Promise.resolve(false);

		return Promise.all(
			this.transports.map(t => t.stop())
		).then(() => {
			this.started = false;
			return true;
		});
	}
});