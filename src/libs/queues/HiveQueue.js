const HiveLocks = require('libs/locking/HiveLocks');
module.exports = class HiveQueue {
	constructor(onItem){
		this.items = [];
		this.onItem = onItem;
		this.uuid = HiveClusterModules.Utils.uuidv4();
	}

	queue(item){
		this.items.unshift(item);
		this.run();
	}

	run(){
		if(this.items.length <= 0)
			return;

		if(this.acquireLock()){
			// acquired lock
			let item = this.items.pop();
			this.onItem(item).then(() => {
				this.releaseLock();
				this.run();
			}).catch(() => {
				this.releaseLock();
				this.run();
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