const uuidv4 = require("uuid/v4");
const TIME_UNIT = {
	MILLISECONDS: "MILLISECONDS",
	MICROSECONDS: "MICROSECONDS",
	NANOSECONDS: "NANOSECONDS"
};

class Utils {
	noop() {

	}

	now(unit) {
		const hrTime = process.hrtime();
		switch (unit) {
			case TIME_UNIT.MILLISECONDS:
				return hrTime[0] * 1000 + hrTime[1] / 1000000;
			case TIME_UNIT.MICROSECONDS:
				return hrTime[0] * 1000000 + hrTime[1] / 1000;
			case TIME_UNIT.NANOSECONDS:
			default:
				return hrTime[0] * 1000000000 + hrTime[1];
		}
	}

	getMemoryUsage() {
		// returns heapUsed in MB
		const used = process.memoryUsage();
		let tmp = [];
		for (let key in used) {
			tmp.push(key, Math.round(used[key] / 1024 / 1024 * 100) / 100, "MB");
		}
		return tmp.join(" ");
	}

	extend() {
		let extended = {};

		for (let key in arguments) {
			let argument = arguments[key];
			for (let prop in argument) {
				if (Object.prototype.hasOwnProperty.call(argument, prop)) {
					extended[prop] = argument[prop];
				}
			}
		}

		return extended;
	}

	isFunction(obj) {
		return !!(obj && obj.constructor && obj.call && obj.apply);
	}

	uuidv4() {
		return uuidv4();
	}

	getRandomInt(min, max) {
		return Math.floor(Math.random() * (max - min + 1)) + min;
	}

	monitorPerformance() {
		let self = this;
		return {
			TIME_UNIT: TIME_UNIT.MILLISECONDS,
			now: self.now(TIME_UNIT.MILLISECONDS),
			get: function () {
				return self.now(this.TIME_UNIT) - this.now
			}
		}
	}

	flatten(ob) {
		let self = this;
		let toReturn = {};

		for (let i in ob) {
			if (!ob.hasOwnProperty(i)) continue;

			if ((typeof ob[i]) == 'object') {
				let flatObject = self.flatten(ob[i]);
				for (let x in flatObject) {
					if (!flatObject.hasOwnProperty(x)) continue;

					toReturn[i + '.' + x] = flatObject[x];
				}
			} else {
				toReturn[i] = ob[i];
			}
		}
		return toReturn;
	}

	readFromDBCursor(cursor, callback) {
		return new Promise((resolve) => {
			if (cursor.isClosed()) {
				callback(null, null);
				resolve();
				return false;
			}
			cursor.nextObject((err, item) => {
				if (item == null) {
					// cursor finished
					cursor.close();
					callback(err, item);
					return false;
				}
				callback(err, item);
				this.readFromDBCursor(cursor, callback).then(resolve);
			})
		})
	}

	readFromDBCursorLinvodb3(cursor, callback){
		let perf = HiveClusterModules.Utils.monitorPerformance();
		return new Promise((resolve) => {
			cursor.exec(function (err, docs) {
				if(err || docs.length == 0){
					callback(err, null);
					console.log("read from db", perf.get());
					resolve();
					return;
				}

				for(let doc of docs){
					callback(err, doc);
				}
				callback(null, null);
				console.log("read from db", perf.get());
				resolve();
			});
		})
	}

	shuffleArray(array) {
		for (let i = array.length - 1; i > 0; i--) {
			let j = Math.floor(Math.random() * (i + 1));
			let temp = array[i];
			array[i] = array[j];
			array[j] = temp;
		}
	}

	isArray(a) {
		return (!!a) && (a.constructor === Array);
	}

	isObject(a) {
		return (!!a) && (a.constructor === Object);
	}

	sortBy(fields) {
		return function (a, b) {
			return fields
			.map(function (o) {
				let dir = 1;
				if (o[0] === '-') {
					dir = -1;
					o = o.substring(1);
				}
				if (a[o] > b[o]) return dir;
				if (a[o] < b[o]) return -(dir);
				return 0;
			})
			.reduce(function firstNonZeroValue(p, n) {
				return p ? p : n;
			}, 0);
		};
	}
}

module.exports = new Utils();
module.exports.TIME_UNIT = Utils.TIME_UNIT = TIME_UNIT;
