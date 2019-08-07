const BaseNode = require("./BaseNode");
module.exports = class HiveSystemNode extends BaseNode {
	forward(source, payload) {
		return new Promise((resolve, reject) => {
			if (!this.peer) {
				reject();
				return;
			}


			this.peer.send([source, this.id, payload]).then(resolve).catch(reject);
		});
	}

	send(payload) {
		return super.send([HiveCluster.id, this.id, payload]);
	}

	isInternal() {
		return this.peer.isInternal();
	}
};