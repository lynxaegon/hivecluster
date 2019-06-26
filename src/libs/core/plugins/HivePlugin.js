const pluginManager = Symbol("pluginManager");
module.exports = class HivePlugin {
	constructor(pluginMgr, hiveNetwork, options) {
		this[pluginManager] = pluginMgr;
		this.hiveNetwork = hiveNetwork;
		this.options = options;

		this.__loadPromise = new Promise((resolve, reject) => {
			this.__finishedLoading = resolve;
		});

		this.setup();
		// TODO: make async the plugin loaded resolver
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

	pluginLoaded() {
		this.__finishedLoading();
	}
};