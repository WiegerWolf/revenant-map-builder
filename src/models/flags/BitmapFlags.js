class BitmapFlags {
    constructor(value) {
        // Convert number to 32-bit binary string
        const bits = (value >>> 0).toString(2).padStart(32, '0');

        // Bit depth flags
        this.bm_8bit = !!parseInt(bits[31 - 0]);     // Bitmap data is 8 bit
        this.bm_15bit = !!parseInt(bits[31 - 1]);    // Bitmap data is 15 bit
        this.bm_16bit = !!parseInt(bits[31 - 2]);    // Bitmap data is 16 bit
        this.bm_24bit = !!parseInt(bits[31 - 3]);    // Bitmap data is 24 bit
        this.bm_32bit = !!parseInt(bits[31 - 4]);    // Bitmap data is 32 bit

        // Buffer flags
        this.bm_zbuffer = !!parseInt(bits[31 - 5]);  // Bitmap has ZBuffer
        this.bm_normals = !!parseInt(bits[31 - 6]);  // Bitmap has Normal Buffer
        this.bm_alias = !!parseInt(bits[31 - 7]);    // Bitmap has Alias Buffer
        this.bm_alpha = !!parseInt(bits[31 - 8]);    // Bitmap has Alpha Buffer
        this.bm_palette = !!parseInt(bits[31 - 9]);  // Bitmap has 256 Color SPalette Structure

        // Special flags
        this.bm_regpoint = !!parseInt(bits[31 - 10]);    // Bitmap has registration point
        this.bm_nobitmap = !!parseInt(bits[31 - 11]);    // Bitmap has no pixel data
        this.bm_5bitpal = !!parseInt(bits[31 - 12]);     // Bitmap palette is 5 bit for r,g,b instead of 8 bit
        this.bm_compressed = !!parseInt(bits[31 - 14]);  // Bitmap is compressed
        this.bm_chunked = !!parseInt(bits[31 - 15]);     // Bitmap is chunked out
    }

    // Helper methods to check bit depth
    getBitDepth() {
        if (this.bm_8bit) return 8;
        if (this.bm_15bit) return 15;
        if (this.bm_16bit) return 16;
        if (this.bm_24bit) return 24;
        if (this.bm_32bit) return 32;
        return 0;
    }

    // Helper method to get bytes per pixel
    getBytesPerPixel() {
        if (this.bm_8bit) return 1;
        if (this.bm_15bit || this.bm_16bit) return 2;
        if (this.bm_24bit) return 3;
        if (this.bm_32bit) return 4;
        return 0;
    }

    // Helper method to check if bitmap needs palette
    needsPalette() {
        return this.bm_8bit && this.bm_palette;
    }

    // Helper method to check if bitmap is valid
    isValid() {
        // Check that only one bit depth flag is set
        const bitDepthFlags = [
            this.bm_8bit,
            this.bm_15bit,
            this.bm_16bit,
            this.bm_24bit,
            this.bm_32bit
        ].filter(flag => flag).length;

        return bitDepthFlags === 1 || this.bm_nobitmap;
    }
}

export default BitmapFlags;