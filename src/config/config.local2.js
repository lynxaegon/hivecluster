module.exports = {
	networks: {
		Nodes: {
			name: "ExoSkeleton-TestNetwork",
			type: HiveClusterModules.HiveNetwork.TYPE.SYSTEM,
			transports: [
				{
					transport: require("libs/tcp/TCPTransport"),
					options: {
						port: HiveCluster.args.port
					}
				}
			],
			networkReadyCheck: true,
			plugins: [
				{
					path: "plugins/minecraft/minecraft"
				}
			]
		},
	},
	services: {
		HiveDB: {
			name: "HiveDB-Client",
			type: HiveClusterModules.HiveNetwork.TYPE.CLIENTS,
			transports: [
				{
					transport: require("libs/tcp/TCPTransport"),
					options: {
						discovery: require("libs/discovery/db")
					}
				}
			]
		}
	}
};