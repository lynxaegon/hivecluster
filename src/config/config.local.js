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
			plugins: []
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
					transport: require("libs/ws/WSTransport"),
					options: {
						port: 3000
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
					path: "plugins/ws_echo"
				}
			]
		}
	}
};