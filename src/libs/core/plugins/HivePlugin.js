const pluginManager = Symbol("pluginManager");
const EventEmitter = require('events').EventEmitter;

module.exports = class HivePlugin extends EventEmitter {
	constructor(pluginMgr, hiveNetwork, options) {
		super();

		this[pluginManager] = pluginMgr;
		this.hiveNetwork = hiveNetwork;
		this.options = options;

		this.__loadPromise = new Promise((resolve, reject) => {
			this.__finishedLoading = resolve;
		});

		if(!this.setup())
			this.pluginLoaded();
	}

	setup() {
		throw new Error("method not implemented: setup()");
	}

	pluginLoad() {
		return this.__loadPromise;
	}

	getPlugin(name) {
		return this[pluginManager].getPlugin(name);
	}

	getExternalPlugin(network, name){
		return this[pluginManager].getExternalPlugin(network, name);
	}

	pluginLoaded() {
		this.__finishedLoading();
	}
};