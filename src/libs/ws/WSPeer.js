const Peer = require("../core/transport/Peer");
const msgpack = require('msgpack-lite');

const msgpackCodec = msgpack.createCodec({
	uint8array: true,
	preset: true
});

module.exports = class WSPeer extends Peer{
	constructor(transport, socket){
		super(transport);

		if(socket) {
			this.setSocket(socket);
		}
	}

	setSocket(socket) {
		this.socket = socket;

		socket.addEventListener('message', event => {
			try {
				const msg = msgpack.decode(event.data, {codec: msgpackCodec});
				if (msg[0] != "ping")
					this.debug('Incoming', msg[0], 'with payload', msg[1]);
				this.events.emit(msg[0], msg[1]);
			}
			catch(e){
				this.requestDisconnect(e);
			}
		});

		socket.on('close', () => this.handleDisconnect());

		this.auth();
	}

	requestDisconnect(err) {
		super.requestDisconnect(err);

		this.socket.close();
	}

	disconnect() {
		super.disconnect();

		this.socket.close();
	}

	write(type, payload) {
		if (type != "ping")
			this.debug('Sending', type, 'with data', payload);

		const data = msgpack.encode([ String(type), payload ], { codec: msgpackCodec });
		this.socket.send(data);
	}
};