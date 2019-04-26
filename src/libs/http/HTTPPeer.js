const httpResult = Symbol("httpResult");
const reqSymbol = Symbol("req");
const resSymbol = Symbol("res");
const endSymbol = Symbol("ended");
const debug = HiveCluster.debug("HiveCluster:http:peer");

const url = require('url');
//////////////////////////////////////////////////////////////
// TODO: implement `formidable` package for parsing requests
// https://www.npmjs.com/package/formidable
//////////////////////////////////////////////////////////////

module.exports = HiveCluster.BaseClass.extend({
	init: function(req, res){
		let self = this;
		let qs = url.parse(req.url, true);

		self[reqSymbol] = req;
		self[resSymbol] = res;
		self[httpResult] = {
			_headers: {
				"HIVE-NODE-ID": HiveCluster.id
			},
			_body: [],
			_url: qs.pathname,
			_query: {
				post: req.body,
				get: qs.query
			},
			_status: 200
		};
		self[endSymbol] = false;

		console.log(self[httpResult]);
	},
	url: function(){
		return this[httpResult]._url;
	},
	query: function(){
		return this[httpResult]._query;
	},
	status: function(code){
		if(this[endSymbol]) {
			debug("Connection already ended!");
			return this;
		}

		this[httpResult]._status = code;
		return this;
	},
	header: function(name, body){
		if(this[endSymbol]) {
			debug("Connection already ended!");
			return this;
		}

		this[httpResult]._headers[name] = body;
		return this;
	},
	body: function(chunk){
		if(this[endSymbol]) {
			debug("Connection already ended!");
			return this;
		}

		this[httpResult]._body.push(chunk);
		return this;
	},
	end: function(){
		if(this[endSymbol]) {
			debug("Connection already ended!");
			return this;
		}

		this[endSymbol] = true;
		this[resSymbol].writeHead(this[httpResult]._status, this[httpResult]._headers);

		if(this[httpResult]._body.length > 0)
			for(let i in this[httpResult]._body){
				if(!this[httpResult]._body.hasOwnProperty(i))
					continue;
				this[resSymbol].write(this[httpResult]._body[i]);
			}

		this[resSymbol].end();
	}
});