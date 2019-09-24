module.exports = class Block {
	constructor(block) {
		this.block = block;
	}

	digTime() {
		return this.block.digTime();
	}

	get type() {
		return this.block.type;
	}

	get metadata() {
		return this.block.metadata;
	}

	get biome() {
		return this.block.biome.id;
	}

	get skyLight() {
		return this.block.skyLight;
	}

	get light() {
		return this.block.light;
	}

	serialize(){
		return {
			type: this.type,
			metadata: this.metadata,
			biome: this.biome,
			skyLight: this.skyLight,
			light: this.light
		};
	}
};