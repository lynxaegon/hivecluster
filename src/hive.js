process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();
const fs = require('fs');
global.HiveClusterModules = {};
global.HiveCluster = {};

const modules = {
	debug: "debug",
	Utils: "libs/utils/utils",
	HiveNetwork: "libs/core/HiveNetwork",
	HivePluginManager: "libs/core/plugins/HivePluginManager"
};
for (let moduleName in modules) {
	global.HiveClusterModules[moduleName] = require(modules[moduleName]);
}
global.Logger = new (require("libs/utils/logger"));
global.HivePacket = require("libs/core/transport/HivePacket");

let argv = require('minimist')(process.argv.slice(2));
if (!argv.config) {
	argv.config = "config.local.js";
}

argv.config = "./config/" + argv.config;
argv.port = argv.port || 5000;

HiveCluster.args = argv;
HiveCluster.weight = (new Date()).getTime();
HiveCluster.id = HiveCluster.args.port + "";
HiveCluster.id = HiveClusterModules.Utils.uuidv4();

global.HIVE_CONFIG = require(argv.config);

// if it's running in KUBE, set the ID of the POD
if (process.env.HIVE_POD_APP) {
	HiveCluster.id = process.env.HIVE_POD_NAME;
}
HiveCluster.EventBus = new (require('events').EventEmitter)();

if (!HIVE_CONFIG.networks) {
	throw new Error("No networks specified!");
}
for (let key in HIVE_CONFIG.networks) {
	if (!HIVE_CONFIG.networks.hasOwnProperty(key))
		continue;

	let transports = [];
	for (let item of HIVE_CONFIG.networks[key].transports) {
		if (item.options.discovery) {
			item.options.discovery = new item.options.discovery();
		}
		transports.push(new item.transport(item.options));
	}
	HiveCluster[key] = new HiveClusterModules.HiveNetwork({
		name: HIVE_CONFIG.networks[key].name,
		type: HIVE_CONFIG.networks[key].type,
		transports: transports
	});
}

let networkPromises = [];
for (let key in HiveCluster) {
	if (!HiveCluster.hasOwnProperty(key))
		continue;

	if (HiveCluster[key] instanceof HiveClusterModules.HiveNetwork) {
		// this is a network
		networkPromises.push(
			new Promise((resolve) => {
				HiveCluster[key].start().then(() => {
					console.log("===== Loading " + key + " network Plugins");
					networkPromises.push(
						new HiveClusterModules.HivePluginManager(HiveCluster[key], HIVE_CONFIG.networks[key].plugins).load().then(() => {
							console.log("===== Finished loading Plugins");
							resolve();
						})
					);
				})
			})
		);
	}
}

// Promise resolves when all the networks and plugins are ready
Promise.all(networkPromises).then(() => {
	fs.open("/tmp/healthy", 'w', function (err, fd) {
		if (err)
			throw err;
		fs.close(fd, function (err) {
			if (err)
				throw err;
		});
	});

	HiveCluster.Nodes.on("test", function (packet) {
		console.log(packet.node);
		// console.log(arguments);
		packet.reply("mkay.. replssssssy here :D");
	});

	// setTimeout(() => {
	// 	HiveCluster.Nodes.send(new HivePacket()
	// 	.setRequest("test")
	// 	.setData("haha, hello")
	// 	.onReply((packet) => {
	// 		console.log("got reply:", packet.data);
	// 	})
	// 	.onReplyFail(() => {
	// 		console.log("failed packet!");
	// 	}), HiveCluster.Nodes.getNodes()).then(() => {
	// 		console.log("seent!");
	// 	});
	// }, 1000);
});