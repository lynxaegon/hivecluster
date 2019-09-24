module.exports = class MinecraftPlugin {
	/**
	 * World (player / world plugin)
	 * @return World
	 */
	get world() {
		if(!this._world) {
			return this._player.world;
		}

		return this._world;
	}

	/**
	 * Player if the plugin is a player plugin
	 * @return Player
	 */
	get player() {
		return this._player;
	}

	constructor(globals, network, world, player) {
		this.globals = globals;
		this.network = network;
		this._world = world;
		this._player = player;
		this._events = {
			global: {},
			world: {}
		};
	}

	start() {
		throw new Error("Start not implemented in plugin!");
	}

	stop() {
		for(let type in this._events){
			for(let event in this._events[type]){
				for(let item of this._events[type][event]){
					if(type == "global") {
						this.network.off("/minecraft" + event, item);
					} else if(type == "world"){
						this.world.events.off(event, args);
					}
				}
			}
		}
	}

	onGlobalEvent(event, fnc, ctx){
		ctx = ctx || {};
		if(!this._events.global[event])
			this._events.global[event] = [];

		fnc = fnc.bind(ctx);
		this._events.global[event].push(fnc);

		this.network.on("/minecraft" + event, fnc);
	}

	onWorldEvent(event, fnc, ctx){
		ctx = ctx || {};
		if(!this._events.world[event])
			this._events.world[event] = [];

		fnc = fnc.bind(ctx);
		this._events.world[event].push(fnc);

		this.world.events.on(event, fnc);
	}

	emitWorldEvent(event, ...args){
		this.world.events.emit(event, ...args);
	}
};