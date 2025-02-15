class LightFlags {
    static LIGHT_DIR = 1 << 0;  // Directional light
    static LIGHT_SUN = 1 << 1;  // Sunlight
    static LIGHT_MOON = 1 << 2; // Moonlight

    constructor(value) {
        this.isDirectional = !!(value & LightFlags.LIGHT_DIR);
        this.isSunlight = !!(value & LightFlags.LIGHT_SUN);
        this.isMoonlight = !!(value & LightFlags.LIGHT_MOON);
    }
}

export default LightFlags;