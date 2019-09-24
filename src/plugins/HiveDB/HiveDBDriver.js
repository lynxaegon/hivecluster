const HivePlugin = require('libs/core/plugins/HivePlugin');
module.exports = class HiveDBDriver extends HivePlugin {
	setup() {
		this.router = this.getPlugin("httpRouter");
		this.hiveDB = this.getExternalPlugin(this.options.network, "HiveDB");

		this.router.on("/hivedb/write", this.onWrite, this);
		this.router.on("/hivedb/read", this.onRead, this);

		this.hiveNetwork.on("/hivedb/write", (packet) => {
			if(!packet.data.id || !packet.data.doc){
				packet.reply({
					err: "invalid packet format!"
				});
				return;
			}

			this.hiveDB.write(packet.data.id, packet.data.doc).then((result) => {
				packet.reply(result.data);
			}).catch((reason) => {
				packet.reply(reason);
			});
		});

		this.hiveNetwork.on("/hivedb/read", (packet) => {
			if(!packet.data.id){
				packet.reply({
					err: "invalid packet format!"
				});
				return;
			}

			this.hiveDB.read(packet.data.id).then((result) => {
				packet.reply(result);
			});
		});
	}

	onWrite(httpPeer) {
		httpPeer.status(500);
		let query = httpPeer.query;
		if(!query.get['id'] || !query.get['document']){
			httpPeer.body("Invalid id/document!");
			httpPeer.end();
		} else {
			try {
				query.get['document'] = JSON.parse(query.get['document']);
			}
			catch(e){
				delete query.get['document'];
			}
			if(!query.get['document']){
				httpPeer.body("Invalid json document!");
				httpPeer.end();
				return;
			}
			this.hiveDB.write(query.get['id'], query.get['document']).then((result) => {
				query.get['document']._id = query.get['id'];
				httpPeer.body(JSON.stringify(query.get['document']));
				httpPeer.status(200);
				httpPeer.end();
			}).catch((reason) => {
				reason = JSON.stringify(reason);
				httpPeer.body(reason || "unknown error");
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
