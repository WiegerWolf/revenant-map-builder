const { InputStream } = require('../utils/InputStream');
const { BufferUtils } = require('../utils/BufferUtils');
const BitmapFlags = require('../models/flags/BitmapFlags');
const ChunkHeader = require('../models/structures/ChunkHeader');

class ImageryDatParser {
    constructor(buffer) {
        this.stream = new InputStream(buffer);
    }

    parse() {
        const header = new ChunkHeader(this.stream);
        const chunks = [];

        for (let y = 0; y < header.height; y++) {
            for (let x = 0; x < header.width; x++) {
                if (!header.isBlockBlank(x, y)) {
                    const blockOffset = header.getBlockOffset(x, y);
                    const blockSize = header.getBlockSize(x, y);
                    
                    if (blockSize > 0) {
                        this.stream.setPos(blockOffset);
                        const chunk = this.parseChunk(blockSize);
                        chunks.push({
                            x,
                            y,
                            data: chunk
                        });
                    }
                }
            }
        }

        return {
            width: header.width,
            height: header.height,
            chunks
        };
    }

    parseChunk(blockSize) {
        const flags = new BitmapFlags(this.stream.readUint32());
        const width = this.stream.readUint16();
        const height = this.stream.readUint16();
        
        // Skip registration point if present
        if (flags.bm_regpoint) {
            this.stream.skip(4); // Skip x, y coordinates (2 bytes each)
        }

        // Handle palette if present
        let palette = null;
        if (flags.needsPalette()) {
            palette = this.parsePalette();
        }

        // Calculate pixel data size
        const bytesPerPixel = flags.getBytesPerPixel();
        const pixelDataSize = width * height * bytesPerPixel;

        // Read pixel data
        let pixelData;
        if (!flags.bm_nobitmap) {
            if (flags.bm_compressed) {
                pixelData = this.parseCompressedData(pixelDataSize);
            } else {
                const slice = BufferUtils.createBufferSlice(
                    this.stream.dataView.buffer,
                    this.stream.getPos(),
                    pixelDataSize
                );
                pixelData = slice.buffer;
                this.stream.skip(pixelDataSize);
            }
        }

        return {
            flags,
            width,
            height,
            palette,
            pixelData
        };
    }

    parsePalette() {
        const palette = new Array(256);
        for (let i = 0; i < 256; i++) {
            palette[i] = {
                r: this.stream.readUint8(),
                g: this.stream.readUint8(),
                b: this.stream.readUint8()
            };
        }
        return palette;
    }

    parseCompressedData(uncompressedSize) {
        // Implement RLE decompression here
        // This is a placeholder - actual implementation would depend on the specific compression format used
        const compressedSize = this.stream.readUint32();
        const compressedData = new Uint8Array(compressedSize);
        
        for (let i = 0; i < compressedSize; i++) {
            compressedData[i] = this.stream.readUint8();
        }

        // TODO: Implement actual decompression
        return compressedData;
    }
}

module.exports = ImageryDatParser;