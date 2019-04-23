const uuidv4 = require("uuid/v4");
module.exports = new (HiveCluster.BaseClass.extend({
	TIME_UNIT: {
		MILLISECONDS: "MILLISECONDS",
		MICROSECONDS: "MICROSECONDS",
		NANOSECONDS: "NANOSECONDS"
	},
	noop: function(){

	},
	now: function(unit){
		const hrTime = process.hrtime();
		switch (unit) {
			case this.TIME_UNIT.MILLISECONDS:
				return hrTime[0] * 1000 + hrTime[1] / 1000000;
			case this.TIME_UNIT.MICROSECONDS:
				return hrTime[0] * 1000000 + hrTime[1] / 1000;
			case this.TIME_UNIT.NANOSECONDS:
			default:
				return hrTime[0] * 1000000000 + hrTime[1];
		}
	},
	getMemoryUsage: function(){
		// returns heapUsed in MB
		const used = process.memoryUsage();
		var tmp = [];
		for (var key in used) {
			tmp.push(key, Math.round(used[key] / 1024 / 1024 * 100) / 100, "MB");
		}
		return tmp.join(" ");
	},
	extend: function() {
		var extended = {};

		for(var key in arguments) {
			var argument = arguments[key];
			for (var prop in argument) {
				if (Object.prototype.hasOwnProperty.call(argument, prop)) {
					extended[prop] = argument[prop];
				}
			}
		}

		return extended;
	},
	isFunction: function(obj) {
		return !!(obj && obj.constructor && obj.call && obj.apply);
	},
	uuidv4: function(){
		return uuidv4();
	},
	getRandomInt: function(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	},
	monitorPerformance: function(){
		return {
			TIME_UNIT: Utils.TIME_UNIT.MILLISECONDS,
			now: Utils.now(Utils.TIME_UNIT.MILLISECONDS),
			get: function(){
				return Utils.now(this.TIME_UNIT) - this.now
			}
		}
	},
	// stringify: require('fast-json-stable-stringify')
	stringify: function(){
		return JSON.stringify.apply(this, arguments);
	},
	flatten: function(ob) {
		var self = this;
		var toReturn = {};

		for (var i in ob) {
			if (!ob.hasOwnProperty(i)) continue;

			if ((typeof ob[i]) == 'object') {
				var flatObject = self.flatten(ob[i]);
				for (var x in flatObject) {
					if (!flatObject.hasOwnProperty(x)) continue;

					toReturn[i + '.' + x] = flatObject[x];
				}
			} else {
				toReturn[i] = ob[i];
			}
		}
		return toReturn;
	},
	readFromDBCursor: function(cursor, callback){
		return new Promise(function(resolve){
			if(cursor.isClosed())
			{
				callback(null, null);
				resolve();
				return false;
			}
			cursor.nextObject(function(err, item){
				if(item == null){
					// cursor finished
					cursor.close();
					callback(err, item);
					return false;
				}
				callback(err, item);
				Utils.readFromDBCursor(cursor, callback).then(resolve);
			})
		})
	},
	shuffleArray: function(array) {
		for (var i = array.length - 1; i > 0; i--) {
			var j = Math.floor(Math.random() * (i + 1));
			var temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
	},
	isArray: function(a) {
		return (!!a) && (a.constructor === Array);
	},
	isObject: function(a) {
		return (!!a) && (a.constructor === Object);
	},
	sortBy: function(fields){
		return function (a, b) {
			return fields
			.map(function (o) {
				var dir = 1;
				if (o[0] === '-') {
					dir = -1;
					o=o.substring(1);
				}
				if (a[o] > b[o]) return dir;
				if (a[o] < b[o]) return -(dir);
				return 0;
			})
			.reduce(function firstNonZeroValue (p,n) {
				return p ? p : n;
			}, 0);
		};
	}
}));