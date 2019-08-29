// private config
const memStore = true;


const fs = require('fs-extra');
const DBEngine = require('tingodb')({
    memStore: memStore,
    nativeObjectID: true,
    cacheSize: 10000, // 10k objs
    cacheMaxObjSize: 1024 * 10 // 10 kb
});

const DB = DBEngine.Db;

class HiveDBEngine {
    constructor(collection, type, group) {
        this.collectionName = collection;
        this.type = type;
        let dbDirectory = './db/' + collection + '/' + group;
        if(!memStore) {
			fs.ensureDirSync(dbDirectory);
        }
        this.db = new DB(dbDirectory, {});
        this.collection = this.db.collection(this.type);
        this._debug = false;
        this.group = group;
    }

    getType() {
        return this.type;
    }

    getCollectionName() {
        return this.collectionName;
    }

    isMetadata() {
        return this.getCollectionName() == "metadata";
    }

    isData() {
        return this.getCollectionName() == "data";
    }

    /**
     * TODO: we should remove this and implement full mongodb api
     * now we only support single write & multi read
     */
    write(packet) {
        let self = this;

        if (!packet.id) {
            throw new Error("Received packet without packet id;" + JSON.stringify(packet));
        }
        return new Promise(function (resolve) {
            packet.data._id = packet.id;
            // console.log("Writing (" + (self.isMetadata() ? "metadata" : "data") + " " + self.group + "): ", packet.id, packet.data);
            self.collection.update({_id: packet.id}, packet.data, {upsert: 1}, function (err, result) {
                if (err) {
                    Logger.log("HiveRaftDBEngine (write):", err);
                    process.exit(-1);
                    return false;
                }

                resolve();
            });
        });
    }

    delete(packet) {
        let self = this;

        // packet.id is not required here, and it will also be sent as -1 (for consistency)
        if (!packet.id) {
            throw new Error("Received packet without packet id;" + JSON.stringify(packet));
        }
		// console.log("Delete (" + (self.isMetadata() ? "metadata" : "data") + " " + self.group + "): ", packet.id, packet.data);
        return new Promise(function (resolve) {
            // if (self._debug)
            //     Logger.log("Delete ID (" + (self.isMetadata() ? "metadata" : "data") + " " + self.group + "): ", packet.id, packet.data);
            self.collection.remove(packet.data, function (err, count) {
                if (err) {
                    Logger.log("HiveDBEngine (delete):", err);
                    process.exit(-1);
                    return false;
                }

                resolve(count);
            });
        });
    }

    find(query, fields) {
        return this.collection.find(query, fields);
    }

    findOne(query, cb) {
        if (!HiveClusterModules.Utils.isFunction(cb))
            return;

        return this.collection.findOne(query, cb);
    }
}

module.exports = HiveDBEngine;
