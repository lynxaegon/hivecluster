const EventEmitter = require('events').EventEmitter;

class HiveRaftDiscoveryGlobal extends EventEmitter {
    constructor(options) {
        super();
    }

	init(raftEngine){
		this.raftEngine = raftEngine;
	}
}
module.exports = HiveRaftDiscoveryGlobal;
