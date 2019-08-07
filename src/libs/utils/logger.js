let isEnabled = false;

class Logger {
	constructor(enabled) {
		enabled = enabled || false;
		isEnabled = enabled;
		this._plugins = [];
		this._consoleProxy = this._wrap(console);
	}

	log() {
		let args = Array.from(arguments);
		args.unshift("[" + +new Date() + "]");
		this._consoleProxy.log.apply(this._consoleProxy.log, args);
	}

	test() {
		let args = Array.from(arguments);
		args.unshift("[" + +new Date() + "]");
		this._consoleProxy.test.apply(this._consoleProxy.test, args);
	}

	err() {
		let args = Array.from(arguments);
		args.unshift("[" + +new Date() + "]");
		this._consoleProxy.log.apply(this._consoleProxy.log, args);
	}

	warn() {
		let args = Array.from(arguments);
		args.unshift("[" + +new Date() + "]");
		this._consoleProxy.log.apply(this._consoleProxy.log, args);
	}

	plugin(plugin) {
		this._plugins.push(plugin);
	}

	_wrap(console) {
		let self = this;
		return {
			log: function () {
				if (!isEnabled)
					return false;

				for (let i in self._plugins) {
					self._plugins[i].run.apply(this, arguments);
				}

				console.log.apply(console.log, arguments);
			},
			test: function () {
				if (!isEnabled)
					return false;

				for (let i in self._plugins) {
					self._plugins[i].run.apply(this, arguments);
				}
			}
		}
	}
}

module.exports = Logger;