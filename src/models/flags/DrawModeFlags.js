export class DrawModeFlags {
    static DM_NORMAL = 0x00000000;
    static DM_TRANSPARENT = 0x00000001;
    static DM_ALPHA = 0x00000002;
    static DM_ADD = 0x00000004;
    static DM_SUBTRACT = 0x00000008;
    static DM_MULTIPLY = 0x00000010;
    static DM_WIRE = 0x00000020;
    static DM_SHADE = 0x00000040;

    constructor(flags) {
        this.flags = flags;
    }

    get dm_normal() { return this.flags === DrawModeFlags.DM_NORMAL; }
    get dm_transparent() { return !!(this.flags & DrawModeFlags.DM_TRANSPARENT); }
    get dm_alpha() { return !!(this.flags & DrawModeFlags.DM_ALPHA); }
    get dm_add() { return !!(this.flags & DrawModeFlags.DM_ADD); }
    get dm_subtract() { return !!(this.flags & DrawModeFlags.DM_SUBTRACT); }
    get dm_multiply() { return !!(this.flags & DrawModeFlags.DM_MULTIPLY); }
    get dm_wire() { return !!(this.flags & DrawModeFlags.DM_WIRE); }
    get dm_shade() { return !!(this.flags & DrawModeFlags.DM_SHADE); }

    isValid() {
        // Only one draw mode should be set at a time (except for shade which can be combined)
        const baseModes = this.flags & ~DrawModeFlags.DM_SHADE;
        return baseModes === 0 || (baseModes & (baseModes - 1)) === 0;
    }
}

export default DrawModeFlags;