const HiveLocks = require('libs/locking/HiveLocks');
module.exports = class HiveQueueFixed {
	constructor(onItem){
		this.items = {};
		this.onItem = onItem;
		this.uuid = HiveClusterModules.Utils.uuidv4();
	}

	queue(key, item){
		this.items[key] = item;
		this.run();
	}

	run(){
		if(Object.keys(this.items).length <= 0)
			return;

		if(this.acquireLock()){
			// acquired lock
			let key = Object.keys(this.items)[0];
			let item = this.items[key];
			delete this.items[key];

			this.onItem(item).then(() => {
				this.releaseLock();
				this.run();
			}).catch(() => {
				this.releaseLock();
			});
		}
	}

	acquireLock() {
		return HiveLocks.lock("queue/" + this.uuid);
	}

	releaseLock() {
		return HiveLocks.unlock("queue/" + this.uuid)
	}
};