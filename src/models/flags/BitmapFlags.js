export class BitmapFlags {
    static BM_NOBITMAP = 0x00000001;
    static BM_COMPRESSED = 0x00000002;
    static BM_CHUNKED = 0x00000004;
    static BM_8BIT = 0x00000008;
    static BM_15BIT = 0x00000010;
    static BM_16BIT = 0x00000020;
    static BM_24BIT = 0x00000040;
    static BM_32BIT = 0x00000080;
    static BM_ALPHA = 0x00000100;
    static BM_NORMALS = 0x00000200;
    static BM_ZBUFFER = 0x00000400;
    static BM_ALIAS = 0x00000800;

    constructor(flags) {
        this.flags = flags;
    }

    isValid() {
        // Check that only one bit depth flag is set
        const bitDepthFlags = this.flags & (
            BitmapFlags.BM_8BIT |
            BitmapFlags.BM_15BIT |
            BitmapFlags.BM_16BIT |
            BitmapFlags.BM_24BIT |
            BitmapFlags.BM_32BIT
        );

        // If no bitmap, no other flags should be set except compression
        if (this.bm_nobitmap) {
            return (this.flags & ~(BitmapFlags.BM_NOBITMAP | BitmapFlags.BM_COMPRESSED)) === 0;
        }

        // Must have exactly one bit depth flag unless no bitmap
        const validBitDepth = !this.bm_nobitmap && 
            bitDepthFlags !== 0 && 
            (bitDepthFlags & (bitDepthFlags - 1)) === 0;

        // Chunked requires compressed
        const validChunked = !this.bm_chunked || this.bm_compressed;

        return validBitDepth && validChunked;
    }

    get bm_nobitmap() { return !!(this.flags & BitmapFlags.BM_NOBITMAP); }
    get bm_compressed() { return !!(this.flags & BitmapFlags.BM_COMPRESSED); }
    get bm_chunked() { return !!(this.flags & BitmapFlags.BM_CHUNKED); }
    get bm_8bit() { return !!(this.flags & BitmapFlags.BM_8BIT); }
    get bm_15bit() { return !!(this.flags & BitmapFlags.BM_15BIT); }
    get bm_16bit() { return !!(this.flags & BitmapFlags.BM_16BIT); }
    get bm_24bit() { return !!(this.flags & BitmapFlags.BM_24BIT); }
    get bm_32bit() { return !!(this.flags & BitmapFlags.BM_32BIT); }
    get bm_alpha() { return !!(this.flags & BitmapFlags.BM_ALPHA); }
    get bm_normals() { return !!(this.flags & BitmapFlags.BM_NORMALS); }
    get bm_zbuffer() { return !!(this.flags & BitmapFlags.BM_ZBUFFER); }
    get bm_alias() { return !!(this.flags & BitmapFlags.BM_ALIAS); }
}