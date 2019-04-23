const isDeepEqual = require('deep-equal');

function reachabilityComparator(a, b) {
	return a.path.length - b.path.length;
}

module.exports = HiveCluster.BaseClass.extend({
	init: function (id) {
		this.id = id;
		this.directAddress = null;
		this.directPort = null;

		this.reachability = [];
	},
	forward: function (source, message) {
		if (!this.peer)
			return;

		this.peer.send([source, this.id, message]);
	},
	send(type, data) {
		if (!this.peer)
			return;

		this.peer.send([HiveCluster.id, this.id, {type, data}]);
	},
	getDistance: function () {
		if (this.reachability.length === 0)
			return -1;

		return this.reachability[0].path.length;
	},
	getPath: function () {
		return this.reachability.length > 0 ? this.reachability[0].path : [];
	},
	isReachable: function () {
		return this.reachability.length > 0;
	},
	addReachability: function (peer, path) {
		const routedViaHostNode = path.indexOf(this.id) >= 0 || path.indexOf(HiveCluster.id) >= 0;
		console.log("addReachability", this.id, path, routedViaHostNode);

		const idx = this.reachability.findIndex(d => d.peer.id == peer.id);
		if (idx >= 0) {
			// This routing is currently available, but might have been updated
			if (routedViaHostNode) {
				// This node is now reachable via the host, so we should remove it
				this.reachability.splice(idx, 1);
			} else {
				if (isDeepEqual(this.reachability[idx].path, path)) {
					// Paths are equal, skip updating
					return false;
				} else {
					// Update the path to the new one
					this.reachability[idx].path = path;
				}
			}
		} else {
			if (routedViaHostNode) {
				// This node is reachable via the host, so not really reachable via the given peer
				return false;
			}

			this.reachability.push({
				peer,
				path
			});
		}

		// Sort and update how this node is reached
		this.updateReachability();
		return true;
	},
	removeReachability: function (peer) {
		const removedMainPeer = peer == this.peer;
		const idx = this.reachability.findIndex(d => d.peer.id == peer.id);
		if (idx < 0)
			return -1;

		this.reachability.splice(idx, 1);

		var paths = [];
		for(var i in this.reachability){
			paths.push(this.reachability[i].path);
		}
		console.log("removeReachability", this.id, removedMainPeer, idx, peer.id, paths);

		// Sort and update how this node is reached
		this.updateReachability();
		if(removedMainPeer)
			return 1;

		return 0;
	},
	updateReachability: function () {
		this.reachability.sort(reachabilityComparator);

		if (this.isReachable()) {
			this.peer = this.reachability[0].peer;
			this.direct = this.reachability[0].path.length === 0;
		} else {
			this.peer = null;
			this.direct = false;
		}
	}
});