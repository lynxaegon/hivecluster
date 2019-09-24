const MinecraftPlugin = require("../../minecraftPlugin.js");
const Vec3 = require("vec3");

module.exports = class WorldPlugin extends MinecraftPlugin {
	start() {
		this.onWorldEvent("block_dig", this.blockDrop, this);
	}

	blockDrop(data) {
		let location = new Vec3(data.location.x, data.location.y, data.location.z);
		location = location.offset(0.5, 0.5, 0.5);
		let scaledVelocity = new Vec3(Math.random() * 4 - 2, Math.random() * 2 + 2, Math.random() * 4 - 2).scaled(8000 / 20).floored();

		data.player.write("spawn_entity", {
			entityId: 100,
			objectUUID: HiveClusterModules.Utils.uuidv4(),
			type: 2,
			x: location.x,
			y: location.y,
			z: location.z,
			pitch: 0,
			yaw: 0,
			objectData: {
				intField: 1,
				velocityX: scaledVelocity.x,
				velocityY: scaledVelocity.y,
				velocityZ: scaledVelocity.z
			}
		});
		data.player.write('entity_metadata', {
			entityId: 100,
			metadata: [{
				'key': 10,
				'type': 5,
				'value': {
					blockId: data.block.type,
					itemDamage: data.block.metadata,
					itemCount: 1
				}
			}]
		});

		setTimeout(() => {
			data.player.collect({
				id: 100,
				itemId: 2,
				metadata: 0
			});
		}, 500);
	}
};