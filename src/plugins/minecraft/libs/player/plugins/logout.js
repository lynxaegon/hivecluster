const MinecraftPlugin = require("../../minecraftPlugin.js");

module.exports = class PlayerPlugin extends MinecraftPlugin {
	start() {

	}

	stop() {
		this.player.despawn();
		this.player.destroy();
	}
};