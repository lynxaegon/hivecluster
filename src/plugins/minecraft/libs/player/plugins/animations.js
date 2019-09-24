const MinecraftPlugin = require("../../minecraftPlugin.js");

module.exports = class PlayerPlugin extends MinecraftPlugin {
	start() {
		this.player.onEvent("arm_animation", this.armAnimation, this);
	}

	armAnimation(data) {
		this.world.getNearbyPlayers(this.player).map((p) => {
			p.write('animation', {
				entityId: this.player.entityId,
				animation: 0
			});
		});
	}
};