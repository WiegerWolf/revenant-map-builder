import { BitmapFlags } from './BitmapFlags';
import { BufferUtils } from './BufferUtils';
import { ChunkDecompressor } from './ChunkDecompressor';
import { ChunkHeader } from './ChunkHeader';
import { DrawModeFlags } from './DrawModeFlags';
import { InputStream } from './InputStream';
import type { BitmapDataType } from './types';

export class BitmapData {
    static readBitmap(stream: InputStream, arrayBuffer: ArrayBuffer): BitmapDataType {
        // Read the fixed-size header structure
        const bitmap: BitmapDataType = {
            width: stream.readInt32(),
            height: stream.readInt32(),
            regx: stream.readInt32(),
            regy: stream.readInt32(),
            flags: new BitmapFlags(stream.readUint32()),
            drawmode: new DrawModeFlags(stream.readUint32()),
            keycolor: stream.readUint32(),
            aliassize: 0,
            alias: 0,
            alphasize: 0,
            alpha: 0,
            zbuffersize: 0,
            zbuffer: 0,
            normalsize: 0,
            normal: 0,
            palettesize: 0,
            palette: 0,
            datasize: 0,
            data: null
        };

        // Read sizes and offsets, adjusting the offsets based on their position
        bitmap.aliassize = stream.readUint32();
        const aliasOffsetPos = stream.getPos();
        bitmap.alias = stream.readUint32();
        if (bitmap.alias !== 0) {
            bitmap.alias += aliasOffsetPos;
        }

        bitmap.alphasize = stream.readUint32();
        const alphaOffsetPos = stream.getPos();
        bitmap.alpha = stream.readUint32();
        if (bitmap.alpha !== 0) {
            bitmap.alpha += alphaOffsetPos;
        }

        bitmap.zbuffersize = stream.readUint32();
        const zbufferOffsetPos = stream.getPos();
        bitmap.zbuffer = stream.readUint32();
        if (bitmap.zbuffer !== 0) {
            bitmap.zbuffer += zbufferOffsetPos;
        }

        bitmap.normalsize = stream.readUint32();
        const normalOffsetPos = stream.getPos();
        bitmap.normal = stream.readUint32();
        if (bitmap.normal !== 0) {
            bitmap.normal += normalOffsetPos;
        }

        bitmap.palettesize = stream.readUint32();
        const paletteOffsetPos = stream.getPos();
        bitmap.palette = stream.readUint32();

        // Fix: Adjust palette offset relative to stream position
        if (bitmap.palette !== 0) {
            bitmap.palette += paletteOffsetPos;
        }

        bitmap.datasize = stream.readUint32();

        // Sanity checks
        if (bitmap.width > 8192 || bitmap.height > 8192) {
            throw new Error('Corrupted bitmap dimensions');
        }

        if (!bitmap.flags.isValid()) {
            throw new Error('Invalid bitmap flags configuration');
        }

        // Handle pixel data
        if (bitmap.flags.bm_nobitmap) {
            // No pixel data
            bitmap.data = null;
            console.log('Bitmap has no pixel data');
            return bitmap;
        }

        const baseOffset = stream.getPos();

        const { buffer: bitmapBuffer, stream: bitmapStream } = BufferUtils.createBufferSlice(
            arrayBuffer,
            baseOffset,
            bitmap.datasize
        );

        if (bitmap.flags.bm_compressed) {
            if (bitmap.flags.bm_chunked) {
                // The bitmap data directly points to a ChunkHeader
                const mainHeader = new ChunkHeader(bitmapStream);

                // Allocate the final bitmap data
                if (bitmap.flags.bm_8bit) {
                    bitmap.data = new Uint8Array(bitmap.width * bitmap.height * 1);
                } else if (bitmap.flags.bm_15bit || bitmap.flags.bm_16bit) {
                    bitmap.data = new Uint16Array(bitmap.width * bitmap.height * 1);
                } else if (bitmap.flags.bm_24bit) {
                    // For 24-bit, we need to handle RGBTRIPLE structure
                    bitmap.data = new Uint8Array(bitmap.width * bitmap.height * 3);
                } else if (bitmap.flags.bm_32bit) {
                    bitmap.data = new Uint32Array(bitmap.width * bitmap.height * 1);
                }

                // Process each block
                for (let y = 0; y < mainHeader.height; y++) {
                    for (let x = 0; x < mainHeader.width; x++) {
                        if (mainHeader.isBlockBlank(x, y)) {
                            // This is a blank block, skip it
                            continue;
                        }

                        // Calculate the block width and height for each block
                        const blockWidth = BitmapData.calculateBlockWidth(x, bitmap, mainHeader);
                        const blockHeight = BitmapData.calculateBlockHeight(y, bitmap, mainHeader);

                        const destX = x * BitmapData.calculateBlockWidth(0, bitmap, mainHeader);
                        const destY = y * BitmapData.calculateBlockHeight(0, bitmap, mainHeader);

                        // Process non-blank block
                        const blockOffset = mainHeader.getBlockOffset(x, y);
                        let blockSize = mainHeader.getBlockSize(x, y);
                        if (blockSize === 0) {
                            // This is a special case where the block size is 0,
                            // which means it's the last block in the file
                            blockSize = bitmapBuffer.byteLength - blockOffset;
                        }
                        const { buffer: blockBuffer, stream: blockStream } = BufferUtils.createBufferSlice(
                            bitmapBuffer,
                            blockOffset,
                            blockSize
                        );
                        const { number, data: decompressed } = ChunkDecompressor.decompressChunk(blockStream, blockWidth, blockHeight);

                        // Copy the decompressed chunk to the right position
                        if (bitmap.flags.bm_8bit && bitmap.data instanceof Uint8Array) {
                            // Copy each row of the decompressed data to the correct position
                            for (let row = 0; row < blockHeight; row++) {
                                // Skip if we're past the bitmap height
                                if (destY + row >= bitmap.height) break;

                                // Calculate source and destination positions for this row
                                const srcOffset = row * blockWidth;
                                const dstOffset = (destY + row) * bitmap.width + destX;

                                // Calculate how many pixels to copy (handle edge cases)
                                const pixelsToCopy = Math.min(
                                    blockWidth, // Pixels in this row in the block
                                    bitmap.width - destX, // Available width in destination
                                    decompressed.length - srcOffset // Available data in source
                                );

                                // Copy the row
                                bitmap.data.set(
                                    decompressed.subarray(srcOffset, srcOffset + pixelsToCopy),
                                    dstOffset
                                );
                            }
                        } else {
                            console.warn('Unsupported bitmap format, will be implemented later', bitmap.flags);
                            debugger;
                        }
                    }
                }
            } else {
                // The bitmap data is compressed, but not chunked
                console.warn('Compressed, but not chunked bitmap data is not supported yet');
                debugger;
            }
        } else {
            // Create a view into the pixel data based on the bit depth
            // This more closely matches the union structure in the C++ code
            if (bitmap.flags.bm_8bit) {
                bitmap.data = new Uint8Array(arrayBuffer, baseOffset, bitmap.datasize);
            } else if (bitmap.flags.bm_15bit || bitmap.flags.bm_16bit) {
                bitmap.data = new Uint16Array(arrayBuffer, baseOffset, bitmap.datasize / 2);
            } else if (bitmap.flags.bm_24bit) {
                // For 24-bit, we need to handle RGBTRIPLE structure
                bitmap.data = new Uint8Array(arrayBuffer, baseOffset, bitmap.datasize);
            } else if (bitmap.flags.bm_32bit) {
                bitmap.data = new Uint32Array(arrayBuffer, baseOffset, bitmap.datasize / 4);
            }
        }

        // Handle palette data if present
        if (bitmap.palettesize > 0 && typeof bitmap.palette === 'number' && bitmap.palette > 0) {
            const paletteOffset = bitmap.palette;
            const expectedSize = (256 * 2) + (256 * 4); // 256 * (2 bytes for colors + 4 bytes for rgbcolors)

            // Validate palette size
            if (bitmap.palettesize !== expectedSize) {
                console.warn(`Unexpected palette size: ${bitmap.palettesize} bytes (expected ${expectedSize} bytes)`);
                debugger;
            }

            // Validate that the palette data fits within the buffer
            if (paletteOffset + expectedSize <= arrayBuffer.byteLength) {
                const tempBuffer = new ArrayBuffer(expectedSize);
                const tempColors = new Uint16Array(tempBuffer, 0, 256);
                const tempRGBColors = new Uint32Array(tempBuffer, 512, 256);

                // Copy data byte by byte
                const view = new DataView(arrayBuffer);
                for (let i = 0; i < 256; i++) {
                    tempColors[i] = view.getUint16(paletteOffset + i * 2, true);
                    tempRGBColors[i] = view.getUint32(paletteOffset + 512 + i * 4, true);
                }

                bitmap.palette = {
                    colors: tempColors,
                    rgbcolors: tempRGBColors
                };
            } else {
                console.warn('Palette data extends beyond buffer bounds');
            }
        }

        // Handle additional buffers if present and not compressed
        if (!bitmap.flags.bm_compressed) {
            if (bitmap.flags.bm_zbuffer && bitmap.zbuffersize > 0 && typeof bitmap.zbuffer === 'number') {
                bitmap.zbuffer = new Uint16Array(
                    arrayBuffer,
                    baseOffset + bitmap.zbuffer,
                    bitmap.zbuffersize / 2
                );
            }

            if (bitmap.flags.bm_normals && bitmap.normalsize > 0 && typeof bitmap.normal === 'number') {
                bitmap.normal = new Uint16Array(
                    arrayBuffer,
                    baseOffset + bitmap.normal,
                    bitmap.normalsize / 2
                );
            }

            if (bitmap.flags.bm_alpha && bitmap.alphasize > 0 && typeof bitmap.alpha === 'number') {
                bitmap.alpha = new Uint8Array(
                    arrayBuffer,
                    baseOffset + bitmap.alpha,
                    bitmap.alphasize
                );
            }

            if (bitmap.flags.bm_alias && bitmap.aliassize > 0 && typeof bitmap.alias === 'number') {
                bitmap.alias = new Uint8Array(
                    arrayBuffer,
                    baseOffset + bitmap.alias,
                    bitmap.aliassize
                );
            }
        }

        return bitmap;
    }

    // Helper functions to calculate block dimensions
    private static calculateBlockWidth(x: number, bitmap: BitmapDataType, mainHeader: ChunkHeader): number {
        const baseBlockWidth = Math.floor(bitmap.width / mainHeader.width);
        if (x < mainHeader.width - 1) {
            return baseBlockWidth;
        } else {
            // Last block may be wider if bitmap.width is not perfectly divisible
            return bitmap.width - baseBlockWidth * (mainHeader.width - 1);
        }
    }

    private static calculateBlockHeight(y: number, bitmap: BitmapDataType, mainHeader: ChunkHeader): number {
        const baseBlockHeight = Math.floor(bitmap.height / mainHeader.height);
        if (y < mainHeader.height - 1) {
            return baseBlockHeight;
        } else {
            // Last block may be taller if bitmap.height is not perfectly divisible
            return bitmap.height - baseBlockHeight * (mainHeader.height - 1);
        }
    }
}