module.exports = {
	networks: {
		Nodes: {
			name: "ExoSkeleton-TestNetwork",
			type: HiveClusterModules.HiveNetwork.TYPE.SYSTEM,
			transports: [
				{
					transport: require("libs/tcp/TCPTransport"),
					options: {
						port: HiveCluster.args.port,
						discovery: require("libs/discovery/local")
					}
				}
			],
			networkReadyCheck: true,
			plugins: [
				{
                    path: "plugins/HiveDB/HiveDB"
                }
				// {
				// 	path: "plugins/minecraft/minecraft"
				// }
			]
		},
		Clients: {
			name: "ExoSkeleton-TestNetwork",
			type: HiveClusterModules.HiveNetwork.TYPE.CLIENTS,
			transports: [
				{
					transport: require("libs/http/HTTPTransport"),
					options: {
						port: HiveCluster.args.port - 4920 + 8000
					}
				},
				{
					transport: require("libs/tcp/TCPTransport"),
					options: {
						port: HiveCluster.args.port + 5920
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