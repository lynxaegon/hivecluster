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
						discovery: require("libs/discovery/kube-api")
					}
				}
			],
			networkReadyCheck: true,
			plugins: []
		},
		Clients: {
			name: "ExoSkeleton-TestNetwork",
			type: HiveClusterModules.HiveNetwork.TYPE.CLIENTS,
			transports: [
				{
					transport: require("libs/http/HTTPTransport"),
					options: {
						port: 80
					}
				},
				{
					transport: require("libs/ws/WSTransport"),
					options: {
						port: 8080
					}
				}
			],
			plugins: [
				{
					path: "libs/http/httpRouter"
				},
				{
					path: "plugins/monitoring/monitoring"
				}
			]
		}
	}
};