#!/usr/bin/env node
const spawn = require('child_process').spawn;
const fs = require("fs");
const http = require("http");
// change dir to codebase
process.chdir('src');

var TTY_POOL = [9, 10, 11, 12];
for(var i in TTY_POOL){
	TTY_POOL[i] = "/dev/ttys" + TTY_POOL[i].toString().padStart(3, '0');
	TTY_POOL[i] = {
		port: 5000 + parseInt(i),
		fs: fs.openSync(TTY_POOL[i], "a"),
		reset: function(){
			var self = this;
			if(this.inUse && this.pid > 0) {
				var tmp = spawn("kill", ["-9", this.pid]);

				printTTY(this, "\033]0;" + this.name + " - DEAD\007");
				tmp.on('close', function (code){
					printTTY(self, "\n============\tKILLED by Console!");
				});
			}

			this.pid = -1;
			this.inUse = false;
			this.name = "";
		},
		attach: function(pid){
			this.pid = pid;
			this.inUse = true;
		},
		setName: function(name){
			this.name = name;
			printTTY(this, "\033]0;" + this.name + " - ALIVE\007");
		}
	};
	TTY_POOL[i].reset();
}

function bootApp(tty, customArgs, kv){
	console.log(kv);
	customArgs = customArgs || [];
	customArgs = customArgs.concat(["--port", tty.port]);

	clearTTY(tty);
	var env = Object.create( process.env );
	env.DEBUG = kv.DEBUG;

	var options = {detached: true, env: env};
	var child;
	printTTY(tty, "command: node hive.js " + customArgs.join(" ") + "\n\n");
	child = spawn("node", ["hive.js", "--colors"].concat(customArgs), options);

	var foundGUID = false;
	child.stdout.on("data", function(data){
		data = data.toString();
		if(!foundGUID){
			var matches = data.match(/GUID:\s+(.+)/);
			if(matches){
				tty.setName("GUID: " + matches[1] + " -- port: " + tty.port);
				foundGUID = true;
			}
		}
		echoTTY(tty, data);
	});
	child.stderr.on("data", function(data){
		data = data.toString();
		if(!foundGUID){
			var matches = data.match(/About to join network as\s+(.+)/);
			if(matches){
				tty.setName("GUID: " + matches[1] + " -- port: " + tty.port);
				foundGUID = true;
			}
		}
		echoTTY(tty, data);
	});

	child.on('close', function (code){
		tty.reset();
	});

	tty.attach(child.pid);
	child.unref();
}

// custom shell script
var readline = require('readline');
var rl = readline.createInterface({
	input : process.stdin,
	output : process.stdout
});

function input (prompt, callback) {
	rl.question(prompt, function (res) {
		callback(res);
		input(prompt, callback);
	});
}

rl.once('SIGINT', function() {
	commands.quit();
});

input("#> ", function(cmd){
	cmd = CommandInfo(cmd);
	if(!commands[cmd.command]){
		console.error("Invalid command '"+cmd.command+"' ("+cmd.args.join(",")+")");
	} else {
		commands[cmd.command].apply(commands, cmd.args);
	}
});

function CommandInfo(cmd){
	cmd = cmd.split(" ");
	return {
		"command": cmd[0],
		"args": cmd.splice(1)
	};
}

function clearTTY(tty){
	printTTY(tty, "\\033[2J\\033[3J\\033[1;1H");
}

function printTTY(tty, text){
	spawn("printf", [text], {stdio: [ 'ignore', tty.fs, tty.fs ]});
}

function echoTTY(tty, text){
	text = text.toString().trim();
	spawn("echo", [text], {stdio: [ 'ignore', tty.fs, tty.fs ]});
}

const commands = {
	_kv: {
		DEBUG: "null"
	},
	start: function(count){
		count = count || TTY_POOL.length;
		var total = 0;
		for(var i in TTY_POOL){
			(function(index, tty){
				clearTTY(tty);
				var delay = index == 0 ? 0 : 500;
				setTimeout(function(){
					var args = [];
					if(index == 2){
						args = args.concat(["--test-seed", "tcp://127.0.0.1:5001"])
					}

					commands.spawn.apply(commands.spawn, args);
				}, delay + (i * 50));
			})(i, TTY_POOL[i]);
			total++;
			if(total >= count){
				break;
			}
		}
	},
	stop: function(){
		for(var i in TTY_POOL){
			if(TTY_POOL[i].inUse) {
				TTY_POOL[i].reset();
			}
		}
	},
	kill: function(pid){
		if(TTY_POOL[pid].inUse) {
			TTY_POOL[pid].reset();
		}
	},
	clear: function(type){
		if(type == "logs"){
			console.error("Not implemented!");
			// var child = spawn("ls", ["-lah", "logs"]);
			// child.stdout.on("data", function(data){
			// 	data = data.toString();
			// 	console.log(data);
			// });
			// child.stderr.on("data", function(data){
			// 	data = data.toString();
			// 	console.log(data);
			// });
		} else {
			console.error("Invalid arguments supplied (" + type + ")");
		}
	},
	spawn: function(){
		var args = Array.from(arguments);
		var masterExists = false;
		for(var i in TTY_POOL){
			if(TTY_POOL[i].inUse == true){
				masterExists = true;
				break;
			}
		}

		for(var i in TTY_POOL){
			if(TTY_POOL[i].inUse == false){
				if(!masterExists){
					args.push("--no-seed");
				}
				bootApp(TTY_POOL[i], args, commands._kv);
				break;
			}
		}
	},
	test: function(name){
		switch (name){
			case "1":
				setTimeout(function(){
					commands.spawn();
					setTimeout(function(){
						commands.spawn();
						setTimeout(function(){
							commands.spawn();
							setTimeout(function(){
								commands.spawn();
								setTimeout(function(){
									commands.kill(0);
								}, 1500);
							}, 500);
						}, 500);
					}, 500);
				}, 500);
				break;
			case "queries":
				var interval = setInterval(function(){
					var id = makeid(6);
					var document = {};
					for(var i = 0; i < 10; i++){
						document[makeid(4)] = makeid(12);
					}
					http.get('http://127.0.0.1:8017/hivedb/write?id='+id+'&document=' + JSON.stringify(document), function(resp) {
					}).on("error", function(err) {
						console.log("Error: " + err.message);
					});
				}, 10);
				setTimeout(function(){
					clearInterval(interval);
					var id = "test";
					var document = {
						"hello": "world"
					};
					http.get('http://127.0.0.1:8017/hivedb/write?id='+id+'&document=' + JSON.stringify(document), function(resp) {
					}).on("error", function(err) {
						console.log("Error: " + err.message);
					});
				}, 5000);
				break;
		}
	},
	replace: function(){
		commands.kill(getRandomInt(0, TTY_POOL.length - 1));
		setTimeout(function(){
			commands.spawn();
		}, 500);
	},
	benchmark: function(name){
		commands.spawn.apply(commands.spawn, ["--benchmark"]);
		setTimeout(function(){
			commands.spawn.apply(commands.spawn, []);
		}, 500);
	},
	quit: function(){
		this.stop();
		rl.close();
		process.exit(0);
	},
	debug: function(value){
		this._kv['DEBUG'] = value;
	}
};

function makeid(length) {
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < length; i++)
		text += possible.charAt(Math.floor(Math.random() * possible.length));

	return text;
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}