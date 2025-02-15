const S3DPoint = require('./S3DPoint');

class ActionBlock {
    constructor(name, action = 1) { // ACTION_ANIMATE = 1
        this.action = action;
        this.name = name;
        this.frame = 0;
        this.wait = 0;
        this.angle = 0;
        this.moveangle = 0;
        this.turnrate = 0;
        this.target = null;  // S3DPoint
        this.obj = null;     // ObjectInstance reference
        this.attack = null;
        this.impact = null;
        this.damage = 0;
        this.data = null;
        this.flags = 0;
    }
}

module.exports = ActionBlock;