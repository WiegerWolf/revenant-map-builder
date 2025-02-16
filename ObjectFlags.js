
export class ObjectFlags {
    constructor(value) {
        // Convert number to 32-bit binary string
        const bits = (value >>> 0).toString(2).padStart(32, '0');

        this.of_immobile = !!parseInt(bits[31 - 0]); // Not affected by gravity etc
        this.of_editorlock = !!parseInt(bits[31 - 1]); // Object is locked down (can't move in editor)
        this.of_light = !!parseInt(bits[31 - 2]); // Object generates light (a light is on for object)
        this.of_moving = !!parseInt(bits[31 - 3]); // Object is a moving object (characters, exits, players, missiles, etc.)
        this.of_animating = !!parseInt(bits[31 - 4]); // Has animating imagery (animator pointer is set)
        this.of_ai = !!parseInt(bits[31 - 5]); // Object has A.I.
        this.of_disabled = !!parseInt(bits[31 - 6]); // Object A.I. is disabled
        this.of_invisible = !!parseInt(bits[31 - 7]); // Not visible in map pane during normal play
        this.of_editor = !!parseInt(bits[31 - 8]); // Is editor only object
        this.of_drawflip = !!parseInt(bits[31 - 9]); // Reverse on the horizontal
        this.of_seldraw = !!parseInt(bits[31 - 10]); // Editor is manipulating object
        this.of_reveal = !!parseInt(bits[31 - 11]); // Player needs to see behind object (shutter draw)
        this.of_kill = !!parseInt(bits[31 - 12]); // Suicidal (tells system to kill object next frame)
        this.of_generated = !!parseInt(bits[31 - 13]); // Created by map generator
        this.of_animate = !!parseInt(bits[31 - 14]); // Call the objects Animate() func AND create object animators
        this.of_pulse = !!parseInt(bits[31 - 15]); // Call the object Pulse() function
        this.of_weightless = !!parseInt(bits[31 - 16]); // Object can move, but is not affected by gravity
        this.of_complex = !!parseInt(bits[31 - 17]); // Object is a complex object
        this.of_notify = !!parseInt(bits[31 - 18]); // Notify object of a system change (see notify codes below)
        this.of_nonmap = !!parseInt(bits[31 - 19]); // Not created, deleted, saved, or loaded by map (see below)
        this.of_onexit = !!parseInt(bits[31 - 20]); // Object is currently on an exit (used to prevent exit loops)
        this.of_pause = !!parseInt(bits[31 - 21]); // Script is paused
        this.of_nowalk = !!parseInt(bits[31 - 22]); // Don't use walk map for this tile
        this.of_paralize = !!parseInt(bits[31 - 23]); // Freeze the object in mid-animation
        this.of_nocollision = !!parseInt(bits[31 - 24]); // Let the object go through boundries
        this.of_iced = !!parseInt(bits[31 - 25]); // Used to know when to end the iced effect
    }
}
