module.exports = (settings) => {
	const Chunk = require('prismarine-chunk')(settings.version);
	let Vec3 = require('vec3');
	let Block = require('./Block');

	return class WorldChunk {
		static convertTo1D(x, y, z){
			return x + z * 16 + y * 16 * 16;
		}

		constructor(x, y, block) {
			this.x = x;
			this.y = y;
			this.chunk = new Chunk();
			if(HiveClusterModules.Utils.isArray(block)){
				this.deserialize(block);
			} else {
				this.blockType = block;
			}
		}

		generate() {
			for (let x = 0; x < 16; x++) {
				for (let z = 0; z < 16; z++) {
					for(let y = 0; y < 100; y++) {
						this.chunk.setBlockType(new Vec3(x, y, z), this.blockType);
					}
					for(let y = 0; y < 256; y++) {
						this.chunk.setSkyLight(new Vec3(x, y, z), 15);
					}
				}
			}
		}

		getBlock(pos) {
			return new Block(this.chunk.getBlock(pos));
		}

		serialize(key) {
			let serializedChunk = {
				_id: key,
				data: []
			};

			for (let x = 0; x < 16; x++) {
				for(let y = 0; y < 256; y++) {
					for (let z = 0; z < 16; z++) {
						serializedChunk.data[WorldChunk.convertTo1D(x, y, z)] = this.getBlock({
							x: x,
							y: y,
							z: z
						}).serialize();
					}
				}
			}

			return serializedChunk;
		}

		deserialize(data) {
			for (let x = 0; x < 16; x++) {
				for(let y = 0; y < 256; y++) {
					for (let z = 0; z < 16; z++) {
						this.chunk.setBlock({
							x: x,
							y: y,
							z: z
						}, data[WorldChunk.convertTo1D(x, y, z)]);
					}
				}
			}
		}

		get() {
			return this.chunk.dump();
		}
	};
};