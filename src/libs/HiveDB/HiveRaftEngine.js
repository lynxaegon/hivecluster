const EventEmitter = require('events').EventEmitter;
const HiveRaftStates = Object.freeze({
    CANDIDATE: 1,
    FOLLOWER: 2,
    LEADER: 3
});

class HiveRaftEngine extends EventEmitter {
    constructor() {
        super();
        this.state = HiveRaftStates.CANDIDATE;
    }

    add() {

    }

    remove(){

    }

    isLeader(){

    }

    setLeader(){

    }

    write() {

    }

    delete() {

    }

    handle(){

    }

    forward(){

    }

    send(){

    }

    getLeader() {

    }

    getFollowers(){

    }

    // TODO: check if needed
    getNodes(){

    }

    // TODO: check if needed
    getAllNodes() {

    }

    // TODO: check if needed
    getNode(){

    }

    hiveRaftPacket(id, data, type){
        return {
            id: id,
            data: data,
            type: type,
            leader: _LEADER_ID_HERE//this._leaderID
        };
    }
}
module.exports = HiveRaftEngine;