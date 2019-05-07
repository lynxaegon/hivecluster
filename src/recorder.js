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
	HivePlugin: "libs/core/plugins/HivePlugin",
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
argv.port = argv.port || 1722;

HiveCluster.args = argv;
HiveCluster.id = HiveCluster.args.port + "";

HiveCluster.Clients = new HiveClusterModules.HiveNetwork({
	name: "ExoSkeleton-TestNetwork",
	transports: [
		new HiveClusterModules.HTTPTransport({
			port: HiveCluster.args.port
		})
	]
});

let pluginListClients = [
	{
		path: "libs/http/httpRouter"
	},
	{
		path: "plugins/recorder/recorder"
	}
];
HiveCluster.Clients.start().then(() => {
	console.log("===== Loading Client network Plugins");
	new HiveClusterModules.HivePluginManager(HiveCluster.Clients, pluginListClients).load().then(() => {
		console.log("===== Finished loading Plugins");
	});
});
