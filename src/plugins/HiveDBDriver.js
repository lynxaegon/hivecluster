const HivePlugin = require('libs/core/plugins/HivePlugin');
module.exports = class HiveDBDriver extends HivePlugin {
	setup() {
		this.router = this.getPlugin("httpRouter");
		this.hiveDB = this.getExternalPlugin(this.options.network, "HiveDB");

		this.router.on("/hivedb/write", this.onWrite, this);
		this.router.on("/hivedb/read", this.onRead, this);
	}

	onWrite(httpPeer) {
		let query = httpPeer.query;
		if(!query.get['id'] || !query.get['document']){
			httpPeer.body("Invalid id/document!");
			httpPeer.end();
		} else {
			query.get['document'] = JSON.parse(query.get['document']);
			if(!query.get['document']){
				httpPeer.body("Invalid json document!");
				httpPeer.end();
				return;
			}
			this.hiveDB.write(query.get['id'], query.get['document']).then(() => {
				httpPeer.body(JSON.stringify(query.get['document']));

				httpPeer.end();
			}).catch((reason) => {
				httpPeer.body(JSON.stringify(reason));
				httpPeer.end();
			});
		}
	}

	onRead(httpPeer) {
		this.hiveDB.read(httpPeer.query.get.id).then((data) => {
			httpPeer.body(JSON.stringify(data));
			httpPeer.end();
		});
	}
};
