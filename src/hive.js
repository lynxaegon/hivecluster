process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();
global.HiveCluster = {};
const modules = {
	debug: "debug",
	BaseClass: "libs/core/BaseClass",
	Utils: "libs/utils/utils",
	HiveNetwork: "libs/core/HiveNetwork",
	TCPTransport: "libs/tcp/TCPTransport",
	WSTransport: "libs/ws/WSTransport",
	HTTPTransport: "libs/http/HTTPTransport",
};
for(let moduleName in modules){
	global.HiveCluster[moduleName] = require(modules[moduleName]);
}
let argv = require('minimist')(process.argv.slice(2));
argv.port = argv.port || 5000;
HiveCluster.port = argv.port;
HiveCluster.id = HiveCluster.port + "";//HiveCluster.Utils.uuidv4();

const NodesNetwork = new HiveCluster.HiveNetwork({
	name: "ExoSkeleton-TestNetwork"
});
NodesNetwork.addTransport(
	new HiveCluster.TCPTransport({
		port: argv.port,
		discovery: new (require("libs/discovery/local"))
	}),
	true
);

NodesNetwork.start();


const ClientsNetwork = new HiveCluster.HiveNetwork({
	name: "ExoSkeleton-TestNetwork"
});
ClientsNetwork.addTransport(
	new HiveCluster.HTTPTransport()
);

ClientsNetwork.start();

ClientsNetwork.on("/http", (httpPeer) => {
	httpPeer.body("hello world!" + NodesNetwork.nodes.length);
	httpPeer.body("\ntime: " + Date.now());

	httpPeer.end();
});