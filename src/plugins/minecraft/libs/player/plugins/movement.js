const MinecraftPlugin = require("../../minecraftPlugin.js");

module.exports = class PlayerPlugin extends MinecraftPlugin {
	start() {
		this.player.onEvent("look", this.look, this);
		this.player.onEvent("position", this.position, this);
		this.player.onEvent("position_look", this.positionLook, this);
	}

	look(data){
		this.player.position.yaw = data.yaw;
		this.player.position.pitch = data.pitch;

		this.world.getNearbyPlayers(this.player).map((p) => {
			p.write("entity_look", {
				entityId: this.player.entityId,
				yaw: this.player.convertDegrees(this.player.position.yaw),
				pitch: this.player.convertDegrees(this.player.position.pitch),
				onGround: this.player.onGround
			});
			p.write("entity_head_rotation", {
				entityId: this.player.entityId,
				headYaw: this.player.convertDegrees(this.player.position.yaw)
			});
		});
	}

	position(data) {
		this.player.position.x = data.x;
		this.player.position.y = data.y;
		this.player.position.z = data.z;
		this.player.onGround = data.onGround;

		this.emitWorldEvent("player_move", this.player);

		this.world.getNearbyPlayers(this.player).map((p) => {
			p.write("entity_teleport", {
				entityId: this.player.entityId,
				x: this.player.position.x,
				y: this.player.position.y,
				z: this.player.position.z,
				yaw: this.player.convertDegrees(this.player.position.yaw),
				pitch: this.player.convertDegrees(this.player.position.pitch),
				onGround: this.player.onGround
			});
		});
	}

	positionLook(data) {
		this.player.position.x = data.x;
		this.player.position.y = data.y;
		this.player.position.z = data.z;
		this.player.onGround = data.onGround;
		this.player.position.yaw = data.yaw;
		this.player.position.pitch = data.pitch;

		this.emitWorldEvent("player_move", this.player);

		this.world.getNearbyPlayers(this.player).map((p) => {
			p.write("entity_teleport", {
				entityId: this.player.entityId,
				x: this.player.position.x,
				y: this.player.position.y,
				z: this.player.position.z,
				yaw: this.player.convertDegrees(this.player.position.yaw),
				pitch: this.player.convertDegrees(this.player.position.pitch),
				onGround: this.player.onGround
			});
			p.write("entity_look", {
				entityId: this.player.entityId,
				yaw: this.player.convertDegrees(this.player.position.yaw),
				pitch: this.player.convertDegrees(this.player.position.pitch),
				onGround: this.player.onGround
			});
			p.write("entity_head_rotation", {
				entityId: this.player.entityId,
				headYaw: this.player.convertDegrees(this.player.position.yaw)
			});
		});
	}
};