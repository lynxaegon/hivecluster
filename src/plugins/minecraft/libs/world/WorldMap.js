module.exports = (settings) => {
	const spiral = require("spiralloop");
	const Vec3 = require("vec3");
	const WorldChunk = require("./WorldChunk")(settings);
	const chunkKey = (x, y) => {
		return "chunk/" + x + "," + y;
	};
	const globals = settings.globals;

	return class WorldMap {
		getFOVchunks(player, callback) {
			callback = callback || (() => {
			});
			return new Promise((resolve, reject) => {
				let chunkPos = globals.Utils.getChunkPosition(player.position);

				let chunksXY = [];
				spiral([settings.fov * 2, settings.fov * 2], (x, y) => {
					chunksXY.push({
						x: chunkPos.x + x - settings.fov,
						y: chunkPos.y + y - settings.fov
					});
				});

				let chunks = [];
				chunksXY.reduce((p, item) => {
					return p.then(() => {
						return new Promise((resolve) => {
							this.getChunk(item.x, item.y).then((result) => {
								if (result == null) {
									// generate new chunk
									let chunk = new WorldChunk(item.x, item.y, 3);
									chunk.generate();
									this.setChunk(chunk).then(() => {
										chunks.push(chunk);
										callback(chunk);
										resolve();
									});
								} else {
									chunks.push(result);
									callback(result);
									resolve();
								}
							});
						});
					});
				}, Promise.resolve()).then(() => {
					console.log("finished!");
					resolve(chunks);
				}, (err) => {
					reject(err);
				});
			});
		}

		getChunk(x, y) {
			return new Promise((resolve, reject) => {
				let perf = HiveClusterModules.Utils.monitorPerformance();
				globals.db.read(chunkKey(x, y)).then((item) => {
					console.log("read perf", perf.get());
					if (item.err)
						reject(item.err);

					if (!item.result)
						resolve(null);
					else {
						resolve(new WorldChunk(x, y, item.result.data));
					}
				});
			});
		}

		setChunk(chunk) {
			let perf = HiveClusterModules.Utils.monitorPerformance();
			return globals.db.write(chunkKey(chunk.x, chunk.y), chunk.serialize(chunkKey(chunk.x, chunk.y))).then((result) => {
				console.log("chunk set success", chunkKey(chunk.x, chunk.y), perf.get(), result);
			});
		}

		getBlock(location) {
			return new Promise((resolve) => {
				let chunkPos = globals.Utils.getChunkPosition(location);

				this.getChunk(chunkPos.x, chunkPos.y).then((chunk) => {
					resolve(chunk.getBlock(globals.Utils.positionInChunk(location)));
				});
			});
		}

		setBlockTypeAndData(location, type, data) {
			let chunkPos = globals.Utils.getChunkPosition(location);

			location = globals.Utils.positionInChunk(location);

			let query = {
				"$set": {}
			};
			query["$set"]["data." + WorldChunk.convertTo1D(location.x, location.y, location.z) + ".type"] = type;
			query["$set"]["data." + WorldChunk.convertTo1D(location.x, location.y, location.z) + ".metadata"] = data;

			let perf = HiveClusterModules.Utils.monitorPerformance();
			globals.db.write(chunkKey(chunkPos.x, chunkPos.y), query).then(() => {
				console.log("chunk updated success", chunkKey(chunkPos.x, chunkPos.y), perf.get());
			}).catch(() => {
				console.log("chunk update failed", chunkKey(chunkPos.x, chunkPos.y));
			});
		}
	}
};