const HivePlugin = require('libs/core/plugins/HivePlugin');
const EventEmitter = require('events').EventEmitter;
const Vec3 = require("vec3");

const settings = {
	version: "1.12.1",
	debug: false,
	fov: 1,
	plugins: {
		Player: [],
		World: [],
		Extensions: []
	},
	globals: {
		entity_id: 0,
		Utils: {
			positionInChunk(location) {
				location = new Vec3(location.x, location.y, location.z);
				location = location.floored().modulus(new Vec3(16, 256, 16));
				return location;
			},
			getChunkPosition(location) {
				return {
					x: Math.floor(location.x / 16),
					y: Math.floor(location.z / 16)
				};
			}
		}
	}
};

const recursive = require("recursive-readdir");
const path = require("path");
const mc = require('minecraft-protocol');
const World = require("./libs/world/World")(settings);
module.exports = class MinecraftServer extends HivePlugin {
	setup() {
		let basePath = path.dirname(__filename);
		let pluginLoader = [];

		pluginLoader.push(
			new Promise((resolve) => {
				recursive(basePath + "/libs/player/plugins", [], (err, files) => {
					if(!files)
						return;

					for(let file of files){
						settings.plugins.Player.push(require("./" + path.relative(basePath, file)));
					}
					resolve();
				});
			})
		);

		pluginLoader.push(
			new Promise((resolve) => {
				recursive(basePath + "/libs/world/plugins", [], (err, files) => {
					if (!files)
						return;

					for (let file of files) {
						settings.plugins.World.push(require("./" + path.relative(basePath, file)));
					}
					resolve();
				});
			})
		);

		pluginLoader.push(
			new Promise((resolve) => {
				recursive(basePath + "/libs/extensions", [], (err, files) => {
					if (!files)
						return;

					for (let file of files) {
						settings.plugins.Extensions.push(require("./" + path.relative(basePath, file)));
					}
					resolve();
				});
			})
		);

		Promise.all(pluginLoader).then(() => {
			console.log("Minecraft plugins loaded");
			console.log();
		}).then(() => {
			settings.globals.db = new DB();
			this.world = new World(this.hiveNetwork, () => {
				let server = mc.createServer({
					'online-mode': false,   // optional
					host: '0.0.0.0',       // optional
					port: this.options.port || 25565,           // optional
					version: settings.version,
					maxPlayers: -1
				});

				server.on('login', (client) => {
					this.world.addClient(client);
				});
			});

			this.world.plugins = [];
			let pluginCls;
			for(let plugin of settings.plugins.World){
				pluginCls = new plugin(settings.globals, this.hiveNetwork, this.world, null);
				this.world.plugins.push(pluginCls);
				pluginCls.start();
			}
		});

	}
};

class DB extends EventEmitter {
	constructor(){
		super();

		this.db = HiveCluster.services.HiveDB;
		this.node = this.db.getNodes()[0];

		setTimeout(() => {
			this.emit("ready");
		}, 1000);
	}

	write(id, doc){
		return new Promise((resolve, reject) => {
			this.node.send(new HivePacket()
			.setRequest("/hivedb/write")
			.setData({
				id: id,
				doc: doc
			})
			.onReply((packet) => {
				resolve(packet.data);
			})
			.onReplyFail(() => {
				reject();
			}));
		});
	}

	read(id){
		return new Promise((resolve, reject) => {
			this.node.send(new HivePacket()
			.setRequest("/hivedb/read")
			.setData({
				id: id
			})
			.onReply((packet) => {
				resolve(packet.data);
			})
			.onReplyFail((packet) => {
				reject(packet);
			}));
		});
	}

	isReady() {
		return false;
	}
}