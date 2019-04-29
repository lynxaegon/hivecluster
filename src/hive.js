process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();
const fs = require('fs');

global.HiveClusterModules = {};
global.HiveCluster = {};
const modules = {
	debug: "debug",
	BaseClass: "libs/core/BaseClass",
	Utils: "libs/utils/utils",
	HiveNetwork: "libs/core/HiveNetwork",
	HivePlugin: "libs/core/HivePlugin",
	TCPTransport: "libs/tcp/TCPTransport",
	WSTransport: "libs/ws/WSTransport",
	HTTPTransport: "libs/http/HTTPTransport",
	HivePluginManager: "libs/core/HivePluginManager",
};
for(let moduleName in modules){
	global.HiveClusterModules[moduleName] = require(modules[moduleName]);
}
let argv = require('minimist')(process.argv.slice(2));
argv.port = argv.port || 5000;

HiveCluster.args = argv;
HiveCluster.id = HiveCluster.args.port + "";//HiveCluster.Utils.uuidv4();

let startup = [];


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
startup.push(
	HiveCluster.NodesNetwork.start()
);




HiveCluster.ClientsNetwork = new HiveClusterModules.HiveNetwork({
	name: "ExoSkeleton-TestNetwork"
});
HiveCluster.ClientsNetwork.addTransport(
	new HiveClusterModules.HTTPTransport()
);
startup.push(
	HiveCluster.ClientsNetwork.start()
);

HiveCluster.ClientsNetwork.on("/http", (httpPeer) => {
	httpPeer.body("hello world!" + HiveCluster.NodesNetwork.nodes.length);
	httpPeer.body("\ntime: " + Date.now());
	// httpPeer.body("\nurl: " + httpPeer.url());
	// httpPeer.body("\nquery: " + JSON.stringify(httpPeer.query()));
	httpPeer.end();
});

// Plugins
let pluginList = [
	{
		path: "plugins/httpFrontend_plugin"
	}
];
Promise.all(startup).then(function(){
	console.log("Ready");
	// TODO: connect to the network


	// TODO: load plugins after we connected to the network
	new HiveClusterModules.HivePluginManager(pluginList).load().then(() => {
		console.log("plugins loaded");
	});

	// TODO: HiveCluster is fully ready! after plugins have been loaded
});