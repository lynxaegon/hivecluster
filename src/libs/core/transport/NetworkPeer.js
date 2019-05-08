const msgpack = require('msgpack-lite');
const eos = require('end-of-stream');
const Peer = require("./Peer");
const ip = require('ip');

module.exports = class NetworkPeer extends Peer {
	getAuthPackage() {
		return {
			id: this.id,
			address: ip.address(),
			port: this.transport.options.port
		}
	}

	processAuthPackage(msg) {
		this.id = msg.id;
		this.address = msg.address;
		this.port = msg.port;
	}

	setSocket(socket) {
		if (this.socket) {
			// Destroy previous socket
			this.socket.destroy();
		}

		this.socket = socket;
		socket.setNoDelay(true);

		eos(socket, err => {
			if (socket === this.socket) {
				this.handleDisconnect(err)
			}
		});

		const decoder = msgpack.createDecodeStream();
		const pipe = socket.pipe(decoder);

		decoder.on('data', data => {
			const type = data[0];
			const payload = data[1];

			if (type != "ping")
				this.debug('Incoming', type, 'with payload', payload);
			this.events.emit(type, payload);
		});

		decoder.on('error', err => this.debug('Error from decoder', err));
		pipe.on('error', err => this.debug('Error from pipe', err));
	}

	handleDisconnect(err) {
		this.socket = null;
		super.handleDisconnect(err);
	}

	requestDisconnect(err) {
		if (this.socket) {
			this.socket.destroy();
		}
		super.requestDisconnect(err);
	}

	disconnect() {
		super.disconnect();

		if (this.socket) {
			this.write('bye');
			this.socket.destroy();
		} else {
			this.handleDisconnect();
		}
	}

	write(type, payload) {
		if (!this.socket) {
			this.debug('No socket but tried to send', type, 'with data', payload);
			return;
		}

		if (type != "ping")
			this.debug('Sending', type, 'with data', payload);
		const data = msgpack.encode([String(type), payload]);
		// console.log("Sending data length:", data.length);
		try {
			HiveCluster.EventBus.emit("/debug/record", {
				to: String(this.id),
				type: String(type),
				payload: payload
			});
			this.socket.write(data);
		} catch (err) {
			console.log('Could not write;', err);
		}
	}
};