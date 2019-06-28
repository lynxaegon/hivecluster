const HiveQueue = class HiveQueue {
	constructor() {
		this.queue = [];
	}

	push(fnc, args, extras){
		this.queue.push({
			fnc: fnc,
			params: args,
			extras: extras
		});
	}

	run(condition){
		if(!condition) {
			let q = this.queue.pop();
			q.fnc.apply({}, args).then(this.run);
		} else {
			let q = this.queue.slice();
			this.queue = [];
			let executedItem = false;
			for (let i = 0; i < q.length; i++) {
				if (!executedItem && this._validateQueueCondition(q[i].extras, condition)) {
					executedItem = true;
					q[i].fnc.apply({}, q[i].params);
				} else {
					// push back in queue
					this.queue.push(q[i]);
				}
			}
		}
	}

	_validateQueueCondition(data, condition){
		if(!condition){
			return true;
		}

		if(!data){
			return false;
		}

		for(let i in condition){
			if(!condition.hasOwnProperty(i))
				continue;
			if(condition[i] !== data[i]){
				return false;
			}
		}

		return true;
	}
};

module.exports = new HiveQueue();