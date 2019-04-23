process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();
global.HiveCluster = {
	BaseClass: require('libs/core/BaseClass'),
	debug: require("debug"),
};
global.HiveCluster['Utils'] = require('libs/utils/utils');
const Network = require("libs/core/Network");
const TCPTransport = require('libs/tcp/TCPTransport');

let argv = require('minimist')(process.argv.slice(2));
argv.port = argv.port || 5000;
HiveCluster.port = argv.port;
HiveCluster.id = HiveCluster.port;//HiveCluster.Utils.uuidv4();

const net = new Network({
	name: "test-network"
});
const transport = new TCPTransport({
	port: argv.port,
	discovery: new (require("libs/discovery/local"))
});
net.addTransport(transport);

net.start().then((result) => {
	console.log("started -> ", result, "GUID: ", HiveCluster.id);
}).catch((result) => {
	console.log("started catch -> ", result);
});

let nodes = [];
net.on('node:available', node => {
	console.log("node added", node.getID(), node.isDirect());
	nodes.push(node);
	// drawMap();
	// tryDirectConnections();

});

net.on('node:update', node => {
	console.log("node updated", node.getID(), node.isDirect());
	// drawMap();
	// tryDirectConnections();
});

net.on('node:unavailable', node => {
	let idx = nodes.indexOf(node);
	nodes.splice(idx, 1);
	console.log("removed", node.getID(), node.isDirect());
});

setInterval(() => {
	drawMap();
}, 5000);

function drawMap(){
	// console.log("============ MAP =============");
	// for(let i in nodes) {
	// 	console.log("  ", "id", nodes[i].getID(), "distance", nodes[i].getDistance(), "path", nodes[i].getPath());
	// }
	// console.log("=========================");
}

let directConnectionTimeout;

function tryDirectConnections(){
	// clearTimeout(directConnectionTimeout);
	// directConnectionTimeout = setTimeout(() => {
	// 	let socket;
	// 	for(let i in nodes){
	// 		if(!nodes[i].isDirect()){
	// 			socket = nodes[i].getDirectAddress();
	// 			if(socket !== null) {
	// 				console.log("connecting directly", socket.address, socket.port);
	// 				transport.addPeer(socket.address, socket.port);
	// 			}
	// 		}
	// 	}
	// }, 1000);
}