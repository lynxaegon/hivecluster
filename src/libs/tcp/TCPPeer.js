const NetworkPeer = require("../core/transport/NetworkPeer");
const net = require("turbo-net");
const utils = require("util");

module.exports = class TCPPeer extends NetworkPeer {
	merge(peer) {
		peer.requestDisconnect("Deduplication!");
	}

	setConnectionString(address, port) {
		this.address = address;
		this.port = port;
	}

	tryConnect() {
		const client = net.connect(this.port, this.address);
		// client.setKeepAlive(true);
		client.on('connect', () => {
			clearTimeout(this.timeouts.connect);
			this.debug('Connected via ' + this.address + ':' + this.port);
			this.auth();
		});
		client.on('error', (err) => {
			this.debug('Error ' + this.address + ':' + this.port, err);
			this.handleDisconnect(err);
		});
		this.setSocket(client);

		this.timeouts.connect = setTimeout(() =>
			this.requestDisconnect(new Error("Timeout during tryConnect")),
		2000);
	}

	setSocket(socket) {
		if (this.socket) {
			// Destroy previous socket
			this.socket.destroy();
		}

		this.socket = socket;

		let onSocketDisconnect = () => {
			this.handleDisconnect();
			onSocketDisconnect = () => {};
		};

		socket.on("finish", () => {
			onSocketDisconnect();
		});
		socket.on("close", () => {
			onSocketDisconnect();
		});
		socket.on("end", () => {
			onSocketDisconnect();
		});
		socket.destroy = socket.close;

		let contentLength = 0;
		this.state = 0;
		let buffers = [];
		this.socket.read(this.getBuffer(contentLength), function onRead(err, buf, read) {
			if(read > 0) {
				if(this.state == 0){
					// header state
					this.state = 1;

					contentLength = buf.readUInt32BE(0);
					if(contentLength > 5e+7){
						this.handleDisconnect();
						return;
					}
				} else {
					contentLength -= read;
					buffers.push(buf.slice(0, read));
					if(contentLength == 0) {
						// payload state
						this.state = 0;
						contentLength = 0;
						buf = Buffer.concat(buffers);
						buffers = [];

						// buf = msgpack.decode(buf);
						buf = JSON.parse(buf.toString());
						const type = buf[0];
						const payload = buf[1];
						const time = buf[2];

						if (type != "ping")
							this.debug('Incoming', type, 'with payload', utils.inspect(payload, {depth: null}));

						this.events.emit(type, payload, time);
					}
				}
			}
			if(!this.socket)
				return;

			this.socket.read(this.getBuffer(contentLength), onRead.bind(this));
		}.bind(this));
	}

	write(type, payload) {
		return new Promise((resolve, reject) => {
			if (!this.socket) {
				this.debug('No socket but tried to send', type, 'with data', payload);
				reject('No socket');
				return;
			}

			if (type != "ping")
				this.debug('Sending', type, 'with data', payload);

			const data = Buffer.from(JSON.stringify([String(type), payload, HiveClusterModules.Utils.now(HiveClusterModules.Utils.TIME_UNIT.MILLISECONDS)]));
			// const data = msgpack.encode([String(type), payload, HiveClusterModules.Utils.now(HiveClusterModules.Utils.TIME_UNIT.MILLISECONDS)]);

			// console.log("Sending data length:", data.length);
			// console.log("Sending data:", type, payload);
			try {
				const header = Buffer.allocUnsafe(4);
				header.writeUInt32BE(data.length);
				this.socket.write(header, header.length);
				this.socket.write(data, data.length);
				resolve();
			} catch (err) {
				console.log('Could not write;', err);
				reject(err);
			}
		});
	}

	getBuffer(length) {
		return this.state == 0 ? Buffer.allocUnsafe(4) : Buffer.allocUnsafe(length);
	}
};