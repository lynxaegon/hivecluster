const levelup = require('levelup');
const leveldown = require('leveldown');
const BASE_LOCATION = 'db/';
// 1) Create our store
class HiveRaftMetaDB {
    constructor(name) {
        console.log("Started");
        this.filename = BASE_LOCATION + name + ".metadata";
        this.db = levelup(leveldown(this.filename));
    }


}

module.exports = HiveRaftMetaDB;