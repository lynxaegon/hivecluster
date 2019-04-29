const pluginManager = Symbol("pluginManager");
module.exports = HiveClusterModules.BaseClass.extend({
	init: function(){
		this.__loadPromise = new Promise((resolve, reject) => {
			this.__finishedLoading = resolve;
		});
	},
	pluginLoad: function(pluginManager){
		this[pluginManager] = pluginManager;
		return this.__loadPromise;
	},
	getPlugin: function(name){
		return this[pluginManager].getPlugin(name);
	},
	pluginLoaded: function(){
		this.__finishedLoading();
	}
});{}