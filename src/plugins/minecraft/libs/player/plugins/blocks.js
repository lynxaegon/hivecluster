const MinecraftPlugin = require("../../minecraftPlugin.js");

module.exports = class PlayerPlugin extends MinecraftPlugin {
	start() {
		this.currentBlock = null;
		this.timer = null;
		this.player.onEvent("block_dig", this.blockDig, this);
		this.player.onEvent("block_place", this.blockPlace, this);
	}

	blockDig(data) {
		// TODO: check what gameMode = 1 does to block digging
		if(this.player.gameMode != 0)
			return;

		switch (data.status){
			case 0:
				this.player.world.getBlock(data.location).then((block) => {
					this.lastBlockState = -1;
					this.currentBlock = block;
					this.startDigTime = new Date();
					this.expectedDigTime = this.currentBlock.digTime();

					this.timer = setInterval(() => {
						this.digAnimation(data);
					}, 100);
					this.digAnimation(data);

				});
				break;
			case 1:
				this.world.getNearbyPlayers(this.player).map((p) => {
					p.write("block_break_animation", {
						entityId: 0,
						location: data.location,
						destroyStage: -1
					});
				});
				clearInterval(this.timer);
				break;
			case 2:
				clearInterval(this.timer);

				this.world.getNearbyPlayers(this.player).map((p) => {
					p.write("block_change", {
						location: data.location,
						type: 0 << 4 | 0
					});
				});

				this.world.worldMap.setBlockTypeAndData(data.location, 0, 0);

				this.emitWorldEvent("block_dig", {
					player: this.player,
					location: data.location,
					block: this.currentBlock
				});
				break;
			default:
				console.log("Invalid block_dig data recv:", data);
		}
	}

	digAnimation(data) {
		const currentDiggingTime = new Date() - this.startDigTime;
		let blockState = Math.floor(9 * currentDiggingTime / this.expectedDigTime);
		blockState = blockState > 9 ? 9 : blockState;

		if(blockState !== this.lastBlockState) {
			this.lastBlockState = blockState;
			this.world.getNearbyPlayers(this.player).map((p) => {
				p.write("block_break_animation", {
					entityId: 0,
					location: data.location,
					destroyStage: blockState
				});
			});
		}
	}

	blockPlace(data) {
		// TODO: investigate gameMode 1
		if (this.player.gameMode != 0)
			return;

		const heldItem = this.player.inventory.slots[36 + this.player.heldItemSlot];
		this.player.inventory.slots[36 + this.player.heldItemSlot]--;

		if (heldItem.type !== 323) {
			this.world.worldMap.setBlockTypeAndData(data.location, heldItem.type, heldItem.metadata);
			this.world.getNearbyPlayers(this.player).map((p) => {
				p.write("block_change", {
					location: data.location,
					type: heldItem.type << 4 | heldItem.metadata
				});
			});
		}
		// } else if (direction === 1) {
		// 	player.setBlock(position, 63, 0)
		// 	player._client.write('open_sign_entity', {
		// 		location: position
		// 	})
		// } else {
		// 	player.setBlock(position, 68, 0)
		// 	player._client.write('open_sign_entity', {
		// 		location: position
		// 	})
		// }
// 	}, async () => {
// 	const id = await player.world.getBlockType(placedPosition)
// 	const damage = await player.world.getBlockData(placedPosition)
// 	player.sendBlock(placedPosition, id, damage)
// })
// 	}
	}
};