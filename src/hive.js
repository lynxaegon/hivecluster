process.env.NODE_PATH = __dirname;
require('module').Module._initPaths();
const fs = require('fs');
global.HiveClusterModules = {};
global.HiveCluster = {};

process.on('unhandledRejection', (reason, p) => {
	console.log('Unhandled Rejection at: Promise', p, 'reason:', reason);
	// application specific logging, throwing an error, or other logic here
});

const modules = {
	debug: "debug",
	Utils: "libs/utils/utils",
	HiveNetwork: "libs/core/HiveNetwork",
	HivePluginManager: "libs/core/plugins/HivePluginManager"
};
for (let moduleName in modules) {
	global.HiveClusterModules[moduleName] = require(modules[moduleName]);
}
global.Logger = new (require("libs/utils/logger"))(true);
global.HivePacket = require("libs/core/transport/HivePacket");

let argv = require('minimist')(process.argv.slice(2));
if(process.env.HIVE_CONFIG){
	argv.config = "config."+process.env.HIVE_CONFIG+".js";
}
if (!argv.config) {
	argv.config = "config.local.js";
}

argv.config = "./config/" + argv.config;
argv.port = argv.port || 5000;

console.log("Using config:", argv.config);

HiveCluster.args = argv;
HiveCluster.weight = (new Date()).getTime();
HiveCluster.id = HiveCluster.args.port + "";
HiveCluster.services = {};
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

console.log("GUID:", HiveCluster.id);

let networks = [];
for (let key in HIVE_CONFIG.networks) {
	if (!HIVE_CONFIG.networks.hasOwnProperty(key))
		continue;

	let transports = [];
	for (let item of HIVE_CONFIG.networks[key].transports) {
		if (item.options.discovery) {
			item.options.discovery = new item.options.discovery();
		}
		item.options.server = true;
		transports.push(new item.transport(item.options));
	}
	HiveCluster[key] = new HiveClusterModules.HiveNetwork({
		name: HIVE_CONFIG.networks[key].name,
		type: HIVE_CONFIG.networks[key].type,
		networkReadyCheck: !!HIVE_CONFIG.networks[key].networkReadyCheck,
		transports: transports
	});
	HiveCluster[key]._keyName = key;
	networks.push(HiveCluster[key]);
}

let services = [];
for (let key in HIVE_CONFIG.services) {
	if (!HIVE_CONFIG.services.hasOwnProperty(key))
		continue;

	let transports = [];
	for (let item of HIVE_CONFIG.services[key].transports) {
		if (item.options.discovery) {
			item.options.discovery = new item.options.discovery();
		}
		item.options.server = false;
		transports.push(new item.transport(item.options));
	}
	HiveCluster.services[key] = new HiveClusterModules.HiveNetwork({
		name: HIVE_CONFIG.services[key].name,
		type: HIVE_CONFIG.services[key].type,
		transports: transports
	});
	HiveCluster.services[key]._keyName = key;
	services.push(HiveCluster.services[key]);
}

console.log("===== Loading Services");
services.reduce(function(p, service) {
	return p.then(() => {
		return service.start().then(() => {
			console.log("== " + service._keyName + " ready!");
		});
	});
}, Promise.resolve()).then(() => {
	console.log("===== Services Ready!\n");
	// Networks startup sequence
	networks.reduce(function(p, network) {
		return p.then(() => {
			return new Promise((resolve) => {
				network.start().then(() => {
					console.log("===== Loading " + network._keyName + " network Plugins");
					new HiveClusterModules.HivePluginManager(network, HIVE_CONFIG.networks[network._keyName].plugins).load()
					.then(() => {
						console.log("===== Finished " + network._keyName + " loading Plugins");
						resolve();
					});
				});
			})
		});
	}, Promise.resolve()).then(() => {
		// all network finished sequentially
		fs.open("/tmp/healthy", 'w', function (err, fd) {
			if (err)
				throw err;
			fs.close(fd, function (err) {
				if (err)
					throw err;
			});
		});

		for (let network of networks) {
			if(network.options.networkReadyCheck){
				console.log("========= HIVE SYSTEM READY (network: " + network._keyName + ") =========");
				network.send(
					new HivePacket()
					.setRequest("/system/ready")
				);
			}
		}
	}, (err) => {
		// a network sent an error
		throw new Error(err);
	});
}, (err) => {
	// a network sent an error
	throw new Error(err);
});