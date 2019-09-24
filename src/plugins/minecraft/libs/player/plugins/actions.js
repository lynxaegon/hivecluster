const MinecraftPlugin = require("../../minecraftPlugin.js");

module.exports = class PlayerPlugin extends MinecraftPlugin {
	start() {
		this.player.onEvent("entity_action", this.action, this);
	}

	action(data){
		let update = true;
		switch (data.actionId){
			case 0:
				this.player.metadata = [{ 'key': 0, 'type': 0, 'value': 0x02 }];
				this.player.crouching = true;
				break;
			case 1:
				this.player.metadata = [{ 'key': 0, 'type': 0, 'value': 0x00 }];
				this.player.crouching = false;
				break;
			case 3:
				this.player.metadata = [{ 'key': 0, 'type': 0, 'value': 0x08 }];
				break;
			case 4:
				this.player.metadata = [{ 'key': 0, 'type': 0, 'value': 0x00 }];
				break;
			default:
				this.player.metadata = [];
				update = false;
		}
		if(update) {
			this.world.getNearbyPlayers(this.player).map((p) => {
				p.write("entity_metadata", {
					entityId: this.player.entityId,
					metadata: this.player.metadata
				});
			});
		}
	}
};