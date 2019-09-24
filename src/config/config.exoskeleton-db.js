module.exports = {
	networks: {
		Nodes: {
			name: "ExoSkeleton-HiveDB",
			type: HiveClusterModules.HiveNetwork.TYPE.SYSTEM,
			transports: [
				{
					transport: require("libs/tcp/TCPTransport"),
					options: {
						port: HiveCluster.args.port,
						discovery: require("libs/discovery/kube-api")
					}
				}
			],
			networkReadyCheck: true,
			plugins: [
				{
					path: "plugins/HiveDB/HiveDB"
				}
			]
		},
		Clients: {
			name: "ExoSkeleton-HiveDB",
			type: HiveClusterModules.HiveNetwork.TYPE.CLIENTS,
			transports: [
				{
					transport: require("libs/http/HTTPTransport"),
					options: {
						port: 80
					}
				}
			],
			plugins: [
				{
					path: "libs/http/httpRouter"
				},
				{
					path: "plugins/monitoring/monitoring"
				},
				{
					path: "plugins/HiveDB/HiveDBDriver",
					options: {
						network: "Nodes"
					}
				}
			]
		}
	}
};