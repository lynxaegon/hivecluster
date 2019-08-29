const EventEmitter = require('events').EventEmitter;

class HiveRaftDiscoveryGlobal extends EventEmitter {
    constructor(options) {
        super();
    }

	init(raftEngine){
		this.raftEngine = raftEngine;

		this.setup();
	}

	setup() {
		this.raftEngine.addNodes(this.raftEngine.hiveCluster.getNodes());

		this.raftEngine.hiveCluster.on("/system/ready", (packet) => {
			this.raftEngine.addNodes([packet.node]);
		});
	}
}
module.exports = HiveRaftDiscoveryGlobal;