const HiveLocks = class HiveLocks {
	constructor() {
		this.locks = {};
	}

	lock(key){
		let exists = false;
		if(this.locks[key])
			exists = true;

		this.locks[key] = true;

		return !exists;
	}

	unlock(key){
		let exists = false;
		if(this.locks[key])
			exists = true;

		delete this.locks[key];

		return exists;
	}
};

module.exports = new HiveLocks();