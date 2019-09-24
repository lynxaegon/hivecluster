const MinecraftPlugin = require("../../minecraftPlugin.js");

module.exports = class PlayerPlugin extends MinecraftPlugin {
	start() {
		this.login();
	}

	login() {
		this.player.write('login', {
			entityId: this.player.entityId,
			levelType: 'default',
			gameMode: this.player.gameMode,
			dimension: 0,
			difficulty: 1,
			reducedDebugInfo: false,
			maxPlayers: 1
		});

		this.world.getOtherPlayers(this.player).map((e) => {
			e.write("player_info", {
				action: 0,
				data: [{
					UUID: this.player.uuid,
					name: this.player.username,
					properties: this.player.profileProperties,
					gamemode: this.player.gameMode,
					ping: this.player.getLatency()
				}]
			});
		});

		this.player.write("player_info", {
			action: 0,
			data: this.world.players.map((p) => {
				return {
					UUID: p.uuid,
					name: p.username,
					properties: p.profileProperties,
					gamemode: p.gameMode,
					ping: p.getLatency()
				}
			})
		});

		this.world.worldMap.getFOVchunks(this.player, (chunk) => {
			this.player.sendMap(chunk.x, chunk.y, chunk.get());
		});
		this.player.sendPosition(0, 100, 0);

		this.player.spawn();
	}
};