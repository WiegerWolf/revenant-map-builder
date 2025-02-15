class DrawModeFlags {
    constructor(value) {
        // Convert number to 32-bit binary string
        const bits = (value >>> 0).toString(2).padStart(32, '0');

        // Clipping flags
        this.dm_noclip = !!parseInt(bits[31 - 0]);       // Disables clipping when drawing
        this.dm_wrapclip = !!parseInt(bits[31 - 1]);     // Enables wrap clipping
        this.dm_wrapclipsrc = !!parseInt(bits[31 - 2]);  // Enables wrap clipping of source buffer
        this.dm_nowrapclip = !!parseInt(bits[31 - 26]);  // Overrides surface clipping mode to not wrap clip

        // Drawing mode flags
        this.dm_stretch = !!parseInt(bits[31 - 3]);      // Enables Stretching when drawing
        this.dm_background = !!parseInt(bits[31 - 4]);    // Draws bitmap to background
        this.dm_norestore = !!parseInt(bits[31 - 5]);    // Disables automatic background restoring
        this.dm_fill = !!parseInt(bits[31 - 29]);        // Fills the destination with the current color

        // Orientation flags
        this.dm_reversevert = !!parseInt(bits[31 - 6]);  // Reverses vertical orientation
        this.dm_reversehorz = !!parseInt(bits[31 - 7]);  // Reverses horizontal orientation

        // Transparency and effects flags
        this.dm_transparent = !!parseInt(bits[31 - 8]);   // Enables transparent drawing
        this.dm_shutter = !!parseInt(bits[31 - 14]);     // Enable Shutter transparent drawing
        this.dm_translucent = !!parseInt(bits[31 - 15]); // Enables Translucent drawing
        this.dm_fade = !!parseInt(bits[31 - 16]);        // Fade image to key color

        // Buffer flags
        this.dm_zmask = !!parseInt(bits[31 - 9]);        // Enables ZBuffer Masking
        this.dm_zbuffer = !!parseInt(bits[31 - 10]);     // Draws bitmap ZBuffer to destination ZBuffer
        this.dm_normals = !!parseInt(bits[31 - 11]);     // Draws bitmap Normals to dest. Normal buffer
        this.dm_zstatic = !!parseInt(bits[31 - 23]);     // Draws bitmap at a static z value
        this.dm_nocheckz = !!parseInt(bits[31 - 28]);    // Causes ZBuffer Draws to use transparency only

        // Enhancement flags
        this.dm_alias = !!parseInt(bits[31 - 12]);       // Antiailiases edges using bitmap alias data
        this.dm_alpha = !!parseInt(bits[31 - 13]);       // Enables Alpha drawing
        this.dm_alphalighten = !!parseInt(bits[31 - 24]);// Enables Alpha drawing lighten only

        // Color modification flags
        this.dm_changecolor = !!parseInt(bits[31 - 19]); // Draw in a different color
        this.dm_changehue = !!parseInt(bits[31 - 20]);   // Use color to modify hue of image
        this.dm_changesv = !!parseInt(bits[31 - 21]);    // Use color to modify saturation and brightness

        // Special flags
        this.dm_usereg = !!parseInt(bits[31 - 17]);      // Draws bitmap based on registration point
        this.dm_selected = !!parseInt(bits[31 - 18]);    // Draw selection highlight around bitmap
        this.dm_nodraw = !!parseInt(bits[31 - 22]);      // Prevents bitmap graphics buffer from drawing
        this.dm_doescallback = !!parseInt(bits[31 - 25]);// Flag set by low level draw func
        this.dm_nohardware = !!parseInt(bits[31 - 27]);  // Force no hardware use
        this.dm_usedefault = !!parseInt(bits[31 - 31]);  // Causes draw routines to supply default value
    }

    isDefault() {
        return this.value === 0;
    }

    hasTransparencyEffect() {
        return this.dm_transparent || this.dm_translucent ||
            this.dm_shutter || this.dm_alpha ||
            this.dm_alphalighten;
    }

    hasColorModification() {
        return this.dm_changecolor || this.dm_changehue ||
            this.dm_changesv;
    }

    isFlipped() {
        return this.dm_reversevert || this.dm_reversehorz;
    }

    usesZBuffer() {
        return this.dm_zmask || this.dm_zbuffer ||
            this.dm_zstatic || !this.dm_nocheckz;
    }
}

module.exports = DrawModeFlags;