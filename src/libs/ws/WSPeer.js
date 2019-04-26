const Peer = require("../core/transport/Peer");
const msgpack = require('msgpack-lite');

const msgpackCodec = msgpack.createCodec({
	uint8array: true,
	preset: true
});

module.exports = Peer.extend({
	init: function(transport, socket){
		this._super.call(this, transport);

		if(socket) {
			this.setSocket(socket);
		}
	},
	setSocket: function (socket) {
		this.socket = socket;

		socket.addEventListener('message', event => {
			const msg = msgpack.decode(event.data, { codec: msgpackCodec });
			this.debug('Incoming', msg[0], 'with payload', msg[1]);
			this.events.emit(msg[0], msg[1]);
		});

		socket.on('close', () => this.handleDisconnect());

		this.auth();
	},
	requestDisconnect: function() {
		this.socket.close();
	},
	disconnect: function() {
		this._super.apply(this, arguments);

		this.socket.close();
	},
	write: function(type, payload) {
		this.debug('Sending', type, 'with data', payload);
		const data = msgpack.encode([ String(type), payload ], { codec: msgpackCodec });
		this.socket.send(data);
	}
});