const BaseNode = require("./BaseNode");
module.exports = class HiveClientNode extends BaseNode {
	setPeer(peer) {
		super.setPeer(peer, 0);
	}
};