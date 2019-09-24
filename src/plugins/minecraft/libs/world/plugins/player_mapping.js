const MinecraftPlugin = require("../../minecraftPlugin.js");
const Vec3 = require("vec3");

module.exports = class WorldPlugin extends MinecraftPlugin {
	start() {
		this.onWorldEvent("player_move", this.playerMove, this);
	}

	playerMove(player) {
		let chunkPos = this.globals.Utils.getChunkPosition(player.position);
		// check if chunk changed and update only if changed
		if(!player._chunkPos){
			this.movePlayerInChunk(player, chunkPos);
		} else
		if(player._chunkPos.x != chunkPos.x || player._chunkPos.y != chunkPos.y) {
			this.movePlayerInChunk(player, chunkPos);
		}
	}

	movePlayerInChunk(player, chunkPos) {
		let querySet = {
			"$set": {}
		};
		querySet["$set"]["data." + player.uuid + ".node"] = HiveCluster.id;

		let queryUnset = {
			"$unset": {}
		};
		queryUnset["$unset"]["data." + player.uuid] = "";

		this.globals.db.write("chunk/" + chunkPos.x + "," + chunkPos.y + "/players", querySet).then((result) => {
			console.log("player added to chunk", chunkPos);
		});

		if(player._chunkPos) {
			this.globals.db.write("chunk/" + player._chunkPos.x + "," + player._chunkPos.y + "/players", queryUnset).then((result) => {
				console.log("player added to chunk", chunkPos);
			});
		}
		player._chunkPos = chunkPos;
	}
};