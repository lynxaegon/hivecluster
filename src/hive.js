process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();
global.HiveClusterModules = {};
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
	global.HiveClusterModules[moduleName] = require(modules[moduleName]);
}
let argv = require('minimist')(process.argv.slice(2));
argv.port = argv.port || 5000;

HiveCluster.args = argv;
HiveCluster.id = HiveCluster.args.port + "";//HiveCluster.Utils.uuidv4();

HiveCluster.NodesNetwork = new HiveClusterModules.HiveNetwork({
	name: "ExoSkeleton-TestNetwork"
});
HiveCluster.NodesNetwork.addTransport(
	new HiveClusterModules.TCPTransport({
		port: HiveCluster.args.port,
		discovery: new (require("libs/discovery/local"))
	}),
	true
);

HiveCluster.NodesNetwork.start();


HiveCluster.ClientsNetwork = new HiveClusterModules.HiveNetwork({
	name: "ExoSkeleton-TestNetwork"
});
HiveCluster.ClientsNetwork.addTransport(
	new HiveClusterModules.HTTPTransport()
);

HiveCluster.ClientsNetwork.start();

HiveCluster.ClientsNetwork.on("/http", (httpPeer) => {
	httpPeer.body("hello world!" + HiveCluster.NodesNetwork.nodes.length);
	httpPeer.body("\ntime: " + Date.now());
	// httpPeer.body("\nurl: " + httpPeer.url());
	// httpPeer.body("\nquery: " + JSON.stringify(httpPeer.query()));
	httpPeer.end();
});