const plugins = Symbol("plugins");
const hive = Symbol("hive");
module.exports = HiveClusterModules.HivePlugin.extend({
	init: function(hiveNetwork, list) {
		this[plugins] = {};
		this[hive] = hiveNetwork;

		// inject plugins
		let tmp;
		for(let plugin of list){
			tmp = plugin.path.split("/");
			this.injectPlugin({
				name: plugin.name || tmp[tmp.length - 1],
				cls: require(plugin.path),
				options: plugin.options
			});
		}
	},
	injectPlugin: function(plugin){
		this[plugins][plugin.name] = plugin;
	},
	getPlugin: function(name){
		if(this[plugins][name]){
			return this[plugins][name].obj;
		}
		return false;
	},
	load: function(){
		let self = this;
		let list = Object.values(self[plugins]);
		let result = Promise.resolve();
		list.forEach((plugin) => {
			result = result.then(function(){
				console.log("== Loading plugin: '" + plugin.name + "'");
				self[plugins][plugin.name].obj = new plugin.cls(self, self[hive], plugin.options || {});
				return plugin.obj.pluginLoad();
			})
		});
		return result;
	}
});