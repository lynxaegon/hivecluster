const EventEmitter = require("events").EventEmitter;
const events = Symbol("events");
const seq = Symbol("seq");
const _seq = Symbol("_seq");
const Network = require("./Network");

module.exports = HiveCluster.BaseClass.extend({
	init: function(options){
		this.options = options;
		this.networks = [];
		this.nodes = [];
		this[events] = new EventEmitter();

		this[seq] = () => {
			if(!this[_seq] || this[_seq] >= 100)
				this[_seq] = 0;

			return this[_seq];
		};

		this.timeouts = {};
	},
	addTransport: function(transport, fullMesh){
		this.networks.push(
			new Network({
				name: this.options.name,
				transport: transport,
				fullMesh: fullMesh
			})
		);
	},
	start: function(){
		for(let network of this.networks){
			network.start().then((result) => {
				this.setup(network);
				console.log("started -> ", result, "GUID: ", HiveCluster.id);
			}).catch((result) => {
				console.log("started catch -> ", result);
			});
		}
	},
	stop: function(){
		for(let network of this.networks){
			network.stop();
		}
	},
	setup: function(network){
		// setInterval(() => {
		// 	console.log("============ MAP =============");
		// 	for(let i in this.nodes) {
		// 		console.log("  ", "id", this.nodes[i].getID(), "path", (this.nodes[i].getPath() == this.nodes[i].getID() ? "direct" : this.nodes[i].getPath()), "distance", this.nodes[i].getDistance());
		// 	}
		// 	console.log("=========================");
		// }, 5000);

		// HiveNode available, either directly or via a peer
		network.on('node:available', node => {
			console.log("node added", node.getID(), node.isDirect());
			this.nodes.push(node);
		});

		// HiveNode path updated
		network.on('node:update', node => {
			console.log("node updated", node.getID(), node.isDirect());
		});

		// HiveNode fully disconnected from the cluster
		network.on('node:unavailable', node => {
			let idx = this.nodes.indexOf(node);
			this.nodes.splice(idx, 1);
			console.log("removed", node.getID(), node.isDirect());
		});

		// HiveNode message handler
		network.on("message", (msg) => {
			if(msg.type == "hive"){
				if(msg.data.seqr){
					// reply package
				} else {
					// normal package
					this.emit(msg.data.request, msg.data.data);
				}
			} else {
				console.log("Invalid message!", msg);
			}
		});
	},
	on: function (event, handler) {
		this[events].on(event, handler);
	},
	off: function (event, handler) {
		this[events].removeListener(event, handler);
	},
	emit: function(event){
		Array.prototype.shift.call(arguments, this);
		this[events].emit.apply(this[events], arguments);
	}
});