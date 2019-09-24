const EventEmitter = require('events').EventEmitter;
module.exports = (settings) => {
	const Player = require("../player/player")(settings);
	const WorldMap = require("./WorldMap")(settings);
	const viewDistance = settings.fov * 16;

	const globals = settings.globals;

	return class World {
		get events() {
			return this._events; 
		}
		
		constructor(hiveNetwork, onReady) {
			this._events = new EventEmitter();
			this.hiveNetwork = hiveNetwork;

			if(!globals.db.isReady()) {
				globals.db.on("ready", () => {
					onReady();
				});
			} else {
				onReady();
			}

			this.worldMap = new WorldMap();

			this.players = [];
			this.hiveNetwork.on("/minecraft/player/join", (player) => {
				this.players.push(player);

				for(let plugin of player.plugins){
					plugin.start();
				}

				console.log("joined", player.entityId);
			});
			this.hiveNetwork.on("/minecraft/player/leave", (player) => {
				let idx = this.players.indexOf(player);
				if(idx != -1)
					this.players.splice(idx, 1);

				for(let plugin of player.plugins){
					plugin.stop();
				}

				console.log("left", player.entityId);
			});

			setInterval(() => {
				this.players.map((player) => {
					player.write('player_info', {
						action: 2,
						data: this.players.map((p) => {
							return {
								UUID: p.uuid,
								ping: p.getLatency()
							}
						})
					})
				});
			}, 5000);
		}

		addClient(client){
			let player = new Player(client, this);
			player.plugins = [];
			for(let plugin of settings.plugins.Player){
				player.plugins.push(new plugin(settings.globals, this.hiveNetwork, null, player));
			}
		}

		getBlock(location) {
			return this.worldMap.getBlock(location);
		}

		getNearbyPlayers(player, radius = -1) {
			if(radius == -1)
				radius = viewDistance;
			return this.players.filter(p => p !== player && p.position.distanceTo(player.position) <= radius);
		}

		getOtherPlayers(player){
			return this.players.filter(p => p !== player);
		}
	};
};