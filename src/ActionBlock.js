import { ActionTypes } from './ActionTypes';


export class ActionBlock {
    constructor(name, action = ActionTypes.ACTION_ANIMATE) {
        this.action = action;
        this.name = name;
        this.frame = 0;
        this.wait = 0;
        this.angle = 0;
        this.moveangle = 0;
        this.turnrate = 0;
        this.target = null; // S3DPoint
        this.obj = null; // ObjectInstance reference
        this.attack = null;
        this.impact = null;
        this.damage = 0;
        this.data = null;
        this.flags = 0;
    }
}
