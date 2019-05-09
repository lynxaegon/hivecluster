const WebSocket = require('ws');
const msgpack = require('msgpack-lite');
const msgpackCodec = msgpack.createCodec({
	uint8array: true,
	preset: true
});

const ws = new WebSocket('ws://127.0.0.1:3000', {
	perMessageDeflate: false
});

ws.on('open', () => {
	sendMessage("auth", {
		id: "ws_client_test_1"
	});
});

ws.on('message', (data) => {
	let msg = msgpack.decode(data, {codec: msgpackCodec});
	if(msg[0] == "ping"){
		sendMessage("ping");
		return;
	}
	console.log(msg);
});


function sendMessage(type, payload){
	ws.send(msgpack.encode([ String(type), payload ], { codec: msgpackCodec }));
}



let readline = require('readline');
let rl = readline.createInterface({
	input : process.stdin,
	output : process.stdout
});

function input (prompt, callback) {
	rl.question(prompt, function (res) {
		callback(res);
		input(prompt, callback);
	});
}

rl.once('SIGINT', function() {
	process.exit(0);
});

input("#> ", function(cmd){
	cmd = cmd.split(" ");
	let type = cmd.shift();
	let msg = cmd.join(" ");
	sendMessage(type, JSON.parse(msg));
});
