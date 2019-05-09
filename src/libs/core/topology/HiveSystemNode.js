const BaseNode = require("./BaseNode");
module.exports = class HiveSystemNode extends BaseNode {
	forward(source, payload) {
		if (!this.peer)
			return;

		this.peer.send([source, this.id, payload]);
	}

	send(payload) {
		super.send([HiveCluster.id, this.id, payload])
	}
};