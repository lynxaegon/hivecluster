process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();
const fs = require('fs');

global.HiveClusterModules = {};
global.HiveCluster = {};
const modules = {
	debug: "debug",
	Utils: "libs/utils/utils",
	HiveNetwork: "libs/core/HiveNetwork",
	TCPTransport: "libs/tcp/TCPTransport",
	WSTransport: "libs/ws/WSTransport",
	HTTPTransport: "libs/http/HTTPTransport",
	HivePluginManager: "libs/core/plugins/HivePluginManager",
};
for(let moduleName in modules){
	global.HiveClusterModules[moduleName] = require(modules[moduleName]);
}
global.HivePacket = require("libs/core/transport/HivePacket");

let argv = require('minimist')(process.argv.slice(2));
argv.port = argv.port || 5000;

HiveCluster.args = argv;
HiveCluster.id = HiveCluster.args.port + "";//HiveCluster.Utils.uuidv4();
HiveCluster.EventBus = new (require('events').EventEmitter)();

HiveCluster.Nodes = new HiveClusterModules.HiveNetwork({
	name: "ExoSkeleton-TestNetwork",
	systemNetwork: true,
	drawMap: true,
	transports: [
		new HiveClusterModules.TCPTransport({
			port: HiveCluster.args.port,
			discovery: new (require("libs/discovery/local"))
		})
	]
});


HiveCluster.Clients = new HiveClusterModules.HiveNetwork({
	name: "ExoSkeleton-TestNetwork",
	transports: [
		new HiveClusterModules.HTTPTransport({
			port: HiveCluster.args.port - 4920 + 8000
		})
	]
});

// Plugins
let pluginListNodes = [
	// {
	// 	path: "plugins/recorder/notifier"
	// }
];
// new (require("plugins/recorder/notifier"))({
// 	path: "http://127.0.0.1:1722/recorder"
// });
HiveCluster.Nodes.start().then(() => {
	// Network is ready, and connected
	// HiveCluster.Nodes.on("test", function(){
	// 	console.log(arguments);
	// });
	//
	// HiveCluster.Nodes.send(new HivePacket()
	// 	.setRequest("test")
	// 	.setData("haha, hello")
	// , (node) => {
	// 	return node.getID() == HiveCluster.id;
	// });
	console.log("===== Loading Node network Plugins");
	new HiveClusterModules.HivePluginManager(HiveCluster.Nodes, pluginListNodes).load().then(() => {
		console.log("===== Finished loading Plugins");
	});
}).then(() => {

});

let pluginListClients = [
	{
		path: "libs/http/httpRouter"
	},
	{
		path: "plugins/monitoring/monitoring"
	}
];
HiveCluster.Clients.start().then(() => {
	console.log("===== Loading Client network Plugins");
	new HiveClusterModules.HivePluginManager(HiveCluster.Clients, pluginListClients).load().then(() => {
		console.log("===== Finished loading Plugins");
	});
});
