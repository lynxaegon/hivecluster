module.exports = class DiscoveryLocal {
	start(transport) {
		this.transport = transport;
		this.search();
	}

	search() {
		if (!this.transport.onDiscover)
			throw new Error("onDiscover doesn't exist for the current transport!");

		let list = [];

		list.push({
			address: "127.0.0.1",
			port: 6000
		});
		this.transport.onDiscover(list);
	}
};