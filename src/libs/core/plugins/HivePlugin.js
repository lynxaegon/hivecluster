const pluginManager = Symbol("pluginManager");
module.exports = HiveClusterModules.BaseClass.extend({
	init: function(pluginMgr, hiveNetwork, options){
		this[pluginManager] = pluginMgr;
		this.hiveNetwork = hiveNetwork;
		this.options = options;

		this.__loadPromise = new Promise((resolve, reject) => {
			this.__finishedLoading = resolve;
		});
	},
	pluginLoad: function(){
		return this.__loadPromise;
	},
	getPlugin: function(name){
		return this[pluginManager].getPlugin(name);
	},
	pluginLoaded: function(){
		this.__finishedLoading();
	}
});{}