const fs = require('fs');
const HivePlugin = require('libs/core/plugins/HivePlugin');

module.exports = class MonitoringPlugin extends HivePlugin {
	setup() {
		this.router = this.getPlugin("httpRouter");
		this.staticFiles = {};

		let list = [
			"static/cytoscape.min.js",
			"static/cytoscape-avsdf.js",
			"static/index.html",
		];
		let baseName;
		for (let item of list) {
			baseName = item.split("/");
			baseName = baseName[baseName.length - 1];
			this.staticFiles[baseName] = fs.readFileSync(__dirname + "/" + item, 'utf8');
		}

		for (let file in this.staticFiles) {
			this.router.on("/" + file, (httpPeer) => {
				httpPeer.header("content-type", "application/javascript; charset=utf-8");
				httpPeer.body(this.staticFiles[file]);
				httpPeer.end();
			});
		}

		this.router.on("/network", (httpPeer) => {

            let nodeCount = HiveCluster.Nodes.getNodes().length;
            let packets = [];

			HiveCluster.Nodes.send(new HivePacket()
				.setRequest("/monitoring/info")
				.onReply((packet) => {
					packets.push(packet);
					if(packets.length == nodeCount){
						let data = [];
						for(let p of packets){
							data.push(p.data);
						}
                        httpPeer.header("content-type", "text/html; charset=utf-8");
                        httpPeer.body(
                            fs.readFileSync(__dirname + "/static/index.html", 'utf8')
                                .replace("%%topology%%", JSON.stringify(data))
                        );
                        httpPeer.end();
					}
				})
				.onReplyFail(() => {
                    httpPeer.header("content-type", "text/html; charset=utf-8");
                    httpPeer.end();
					console.log("failed packet!");
				}), HiveCluster.Nodes.getNodes()
			);
		});

		HiveCluster.Nodes.on("/monitoring/info", (packet) => {
			packet.reply({
				id: HiveCluster.id,
				info: HiveCluster.Nodes.getTopology()
			});
		});
	}
};