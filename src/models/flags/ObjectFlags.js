export class ObjectFlags {
    static OF_NOCHANGE = 0x00000001;
    static OF_MULTISTATE = 0x00000002;
    static OF_ANIMATE = 0x00000004;
    static OF_NONMAP = 0x00000008;
    static OF_IMMOBILE = 0x00000010;
    static OF_DYNAMIC = 0x00000020;
    static OF_LIGHT = 0x00000040;
    static OF_ETHEREAL = 0x00000080;
    static OF_SHADOW = 0x00000100;
    static OF_LOCKED = 0x00000200;
    static OF_WALKABLE = 0x00000400;
    static OF_BOXWALK = 0x00000800;
    static OF_BOXVIEW = 0x00001000;
    static OF_CONTOUR = 0x00002000;
    static OF_NOWALK = 0x00004000;
    static OF_NOVIEW = 0x00008000;
    static OF_INVALID = 0x00010000;

    constructor(flags) {
        this.flags = flags;
    }

    get of_nochange() { return !!(this.flags & ObjectFlags.OF_NOCHANGE); }
    get of_multistate() { return !!(this.flags & ObjectFlags.OF_MULTISTATE); }
    get of_animate() { return !!(this.flags & ObjectFlags.OF_ANIMATE); }
    get of_nonmap() { return !!(this.flags & ObjectFlags.OF_NONMAP); }
    get of_immobile() { return !!(this.flags & ObjectFlags.OF_IMMOBILE); }
    get of_dynamic() { return !!(this.flags & ObjectFlags.OF_DYNAMIC); }
    get of_light() { return !!(this.flags & ObjectFlags.OF_LIGHT); }
    get of_ethereal() { return !!(this.flags & ObjectFlags.OF_ETHEREAL); }
    get of_shadow() { return !!(this.flags & ObjectFlags.OF_SHADOW); }
    get of_locked() { return !!(this.flags & ObjectFlags.OF_LOCKED); }
    get of_walkable() { return !!(this.flags & ObjectFlags.OF_WALKABLE); }
    get of_boxwalk() { return !!(this.flags & ObjectFlags.OF_BOXWALK); }
    get of_boxview() { return !!(this.flags & ObjectFlags.OF_BOXVIEW); }
    get of_contour() { return !!(this.flags & ObjectFlags.OF_CONTOUR); }
    get of_nowalk() { return !!(this.flags & ObjectFlags.OF_NOWALK); }
    get of_noview() { return !!(this.flags & ObjectFlags.OF_NOVIEW); }
    get of_invalid() { return !!(this.flags & ObjectFlags.OF_INVALID); }

    isValid() {
        // Check for mutually exclusive flags
        const hasWalkFlags = this.of_walkable || this.of_boxwalk || this.of_nowalk;
        const hasViewFlags = this.of_boxview || this.of_noview;
        
        // Only one walk flag should be set
        const validWalk = !hasWalkFlags || 
            ((this.flags & (ObjectFlags.OF_WALKABLE | ObjectFlags.OF_BOXWALK | ObjectFlags.OF_NOWALK)) & 
            (this.flags & (ObjectFlags.OF_WALKABLE | ObjectFlags.OF_BOXWALK | ObjectFlags.OF_NOWALK) - 1)) === 0;

        // Only one view flag should be set
        const validView = !hasViewFlags || 
            ((this.flags & (ObjectFlags.OF_BOXVIEW | ObjectFlags.OF_NOVIEW)) & 
            (this.flags & (ObjectFlags.OF_BOXVIEW | ObjectFlags.OF_NOVIEW) - 1)) === 0;

        return validWalk && validView && !this.of_invalid;
    }
}