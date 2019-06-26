const Client = require('kubernetes-client').Client;
const kubeConfig = require('kubernetes-client').config;
const kubeClient = new Client({ config: kubeConfig.getInCluster(), version: '1.9' });

module.exports = class DiscoveryKubeApi {
	start(transport) {
		this.transport = transport;
		this.search();
	}

	search() {
		if (!this.transport.onDiscover)
			throw new Error("onDiscover doesn't exist for the current transport!");

		this.getPods().then((pods) => {
			if(pods.length <= 0)
				pods = null;

			for(let i in pods){
				pods[i] = {
					address: pods[i],
					port: this.transport.options.port
				}
			}

			this.transport.onDiscover(pods);
		});
	}

	getPods() {
		return new Promise((resolve) => {
			let pods = [];
			let totalPods = 0;
			kubeClient.api.v1.namespaces(process.env.HIVE_POD_NAMESPACE).pods().get().then((result) => {
				let podSpec;
				for (let i in result.body.items) {
					podSpec = result.body.items[i];
					if (podSpec.metadata.deletionTimestamp)
						continue;
					if (podSpec.metadata.name.startsWith(process.env.HIVE_POD_APP)) {
						totalPods++;
						if(podSpec.status.podIP)
							pods.push(podSpec.status.podIP);
					}
				}

				if(totalPods > 0 && pods.length <= 0)
				{
					console.log("No ips found yet, totalPods", totalPods, "pods", pods);
					setTimeout(() => {
						this.getPods().then(resolve);
					}, 300);
				} else {
					console.log("Found pods: ", pods);
					resolve(pods);
				}
			});
		});
	}
};