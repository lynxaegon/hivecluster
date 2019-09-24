module.exports = (settings) => {
	const util = require('util');
	const windows = require('prismarine-windows')(settings.version).windows;
	const Item = require('prismarine-item')(settings.version);

	return class Player {
		constructor(client, world){
			this.world = world;
			this.client = client;
			this.entityId = client.id;
			this.health = 20;
			this.food = 20;
			this.crouching = false;
			this.username = client.username;
			this.uuid = client.uuid;
			this.profileProperties = client.profile ? client.profile.properties : [];
			this.metadata = [];
			this.gameMode = 0;

			this.heldItemSlot = 0;
			this.heldItem = new Item(256, 1);
			this.inventory = new windows.InventoryWindow(0, 'Inventory', 44);

			this.position = {
				x: 0,
				y: 0,
				z: 0,
				yaw: 0,
				pitch: 0,
				distanceTo: function(pos) {
					let dx = pos.x - this.x;
					let dy = pos.y - this.y;
					let dz = pos.z - this.z;
					return Math.sqrt(dx * dx + dy * dy + dz * dz);
				}
			};
			this.onGround = false;
			this.setup();

			// delayed so that it can be catched in plugins
			process.nextTick(() => {
				this.world.hiveNetwork.emit("/minecraft/player/join", this);
			});
		}

		sendMap(x, y, chunk) {
			this.write('map_chunk', {
				x: x,
				z: y,
				groundUp: true,
				bitMap: 0xffff,
				chunkData: chunk,
				blockEntities: []
			});
		}

		sendPosition(x, y, z) {
			this.position.x = x;
			this.position.y = y;
			this.position.z = z;

			this.write('position', {
				x: x,
				y: y,
				z: z,
				yaw: this.convertDegrees(this.position.yaw),
				pitch: this.convertDegrees(this.position.pitch),
				flags: 0x00
			});
		}

		setup() {
			this.client.on("end", () => {
				this.world.hiveNetwork.emit("/minecraft/player/leave", this);
			});

			this.inventory.on('windowUpdate', (slot, oldItem, newItem) => {
				const equipments = {
					5: 4,
					6: 3,
					7: 2,
					8: 1
				};

				equipments[this.heldItemSlot] = 0;

				// if (equipments[slot] !== undefined) {
				// 	player._writeOthersNearby('entity_equipment', {
				// 		entityId: player.id,
				// 		slot: equipments[slot],
				// 		item: Item.toNotch(newItem)
				// 	})
				// }

				this.write('set_slot', {
					windowId: 0,
					slot: slot,
					item: Item.toNotch(newItem)
				});
			});

			this.onEvent('held_item_slot', (data) => {
				console.log(data);
				// player.heldItemSlot = slotId
				// player.setEquipment(0, player.inventory.slots[36 + player.heldItemSlot])
				//
				// player._writeOthersNearby('entity_equipment', {
				// 	entityId: player.id,
				// 	slot: 0,
				// 	item: Item.toNotch(player.heldItem)
				// })
			}, this);

			this.onEvent("window_click", (data) => {
				try {
					this.inventory.acceptClick(data)
				} catch (err) {
					console.error(err);
				}
			});

			// this.client.on("packet", (...args) => {
			// 	console.log(...args);
			// })
		}

		onEvent(event, fnc, ctx) {
			this.client.on(event, (...args) => {
				fnc.bind(ctx).call(this, args[0]);
			});
		}

		spawn(){
			// spawn entity to all nearby players and to self
			this.world.getNearbyPlayers(this).map((e) => {
				e.write("named_entity_spawn", {
					entityId: this.entityId,
					playerUUID: this.uuid,
					x: this.position.x,
					y: this.position.y,
					z: this.position.z,
					yaw: this.convertDegrees(this.position.yaw),
					pitch: this.convertDegrees(this.position.pitch),
					currentItem: 0,
					metadata: []
				});

				this.write("named_entity_spawn", {
					entityId: e.entityId,
					playerUUID: e.uuid,
					x: e.position.x,
					y: e.position.y,
					z: e.position.z,
					yaw: this.convertDegrees(e.position.yaw),
					pitch: this.convertDegrees(e.position.pitch),
					currentItem: 0,
					metadata: []
				});
			});
		}

		despawn() {
			this.world.getNearbyPlayers(this).map((p) => {
				p.write("entity_destroy", {
					'entityIds': [this.entityId]
				});
			});
		}

		write(event, params) {
			console.log(event, util.inspect(params, false, null, true));
			this.client.write(event, params);
		}

		getLatency() {
			return this.client.latency;
		}

		convertDegrees (f) {
			let b = Math.floor((f % 360) * 256 / 360);
			if (b < -128) b += 256;
			else if (b > 127) b -= 256;
			return b;
		}

		collect(entity){
			// Add it to a stack already in the player's inventory if possible
			for (let itemKey = 0; itemKey < this.inventory.slots.length; itemKey++) {
				const item = this.inventory.slots[itemKey];
				if (item === undefined || item === null)
					continue;
				if (item.type === entity.itemId) {
					item.count += 1;
					this.inventory.updateSlot(itemKey, item);
					this.world.getNearbyPlayers(this).map((p) => {
						p.write("collect", {
							collectedEntityId: entity.id,
							collectorEntityId: this.entityId
						});
						p.write("entity_destroy", {
							'entityIds': [entity.entityId]
						});
					});
					// player.playSoundAtSelf('random.pop')
					return;
				}
			}

			// If we couldn't add it to a already existing stack, put it in a new stack if the inventory has room
			const emptySlot = this.inventory.firstEmptyInventorySlot();
			if (emptySlot !== null) {
				this.world.getNearbyPlayers(this).map((p) => {
					p.write("collect", {
						collectedEntityId: entity.id,
						collectorEntityId: this.entityId
					});
					p.write("entity_destroy", {
						'entityIds': [entity.entityId]
					});
				});
				// player.playSoundAtSelf('random.pop')

				const newItem = new Item(entity.itemId, 1, entity.metadata);
				this.inventory.updateSlot(emptySlot, newItem);
			}
		}

		destroy() {
			this.world.getOtherPlayers(this).map((p) => {
				p.write("player_info", {
					action: 4,
					data: [{
						UUID: this.uuid
					}]
				})
			});
		}
	};
};