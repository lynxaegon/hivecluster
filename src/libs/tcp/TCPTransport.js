const AbstractTransport = require("../core/transport/AbstractTransport");
const addPeer = AbstractTransport.addPeer;
const events = AbstractTransport.events;
const TCPPeer = require("./TCPPeer");
const net = require('net');

const setupPeer = Symbol('setupPeer');
const stoppables = Symbol('stoppables');
const readiness = Symbol('readiness');

module.exports = class TCPTransport extends AbstractTransport {
	constructor(options) {
		super('tcp');

		this.options = Object.assign({
			port: 5000
		}, options);

		this[stoppables] = [];
		this[readiness] = null;
	}

	start(options) {
		return super.start(options).then(started => {
			if (!started)
				return false;

			return new Promise((resolve) => {
				this[readiness] = resolve;
				const listenCallback = () => {
					this.port = this.server.address().port;
					this.debug('Server started at port', this.port);
				};

				this.server = net.createServer((socket) => {
					const peer = new TCPPeer(this);
					peer.setSocket(socket);
					this[addPeer](peer);
					peer.auth();
				}).listen(this.options.port, listenCallback);

				this[stoppables].push({
					stop: () => this.server.close()
				});


				if (this.options.discovery) {
					this.options.discovery.start(this);
				}
			});
		});
	}

	stop() {
		return super.stop().then(stopped => {
			if (!stopped)
				return false;

			return Promise.all(
				this[stoppables].map(item => Promise.resolve(item.stop()))
			);
		})
	}

	onDiscover(peers) {
		let nodes = [];
		let readyNodes = 0;
		if (peers !== null) {
			for (let peer of peers) {
				nodes.push(
					this.addPeer(peer.address, peer.port)
				);
			}
			for (let node of nodes) {
				node.on("connected", () => {
					readyNodes++;
					if (readyNodes == nodes.length)
						this[readiness](readyNodes);
				});
			}
		}
		else {
			this[readiness](readyNodes);
		}
	}

	addPeer(address, port) {
		if (this.started) {
			return this[setupPeer]({
				address: address,
				port: port
			});
		}
		return null;
	}

	[setupPeer](data) {
		const peer = new TCPPeer(this);
		this[addPeer](peer);

		peer.setConnectionString(data.address, data.port);
		peer.tryConnect();

		return peer;
	}
};