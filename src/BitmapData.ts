import { BitmapFlags } from './BitmapFlags';
import { BufferUtils } from './BufferUtils';
import { ChunkDecompressor } from './ChunkDecompressor';
import { ChunkHeader } from './ChunkHeader';
import { DrawModeFlags } from './DrawModeFlags';
import { InputStream } from './InputStream';
import type { BitmapDataType } from './types';

export class BitmapData {
    /**
     * Read a size/offset pair from the stream and store it in the bitmap object.
     * It's important to note that the offset value is relative to the position of the offset field itself
     * (i.e. the position of the stream once the offset field was read). And NOT the start of the bitmap data.
     */
    private static readSizeOffsetPair(stream: InputStream, bitmap: BitmapDataType, propName: 'alias' | 'alpha' | 'zbuffer' | 'normal' | 'palette') {
        const sizeKey = `${propName}size` as const;
        bitmap[sizeKey] = stream.readUint32();
        const offsetPos = stream.getPos();
        const value = stream.readUint32();
        if (value !== 0) {
            bitmap[propName] = value + offsetPos;
        } else {
            bitmap[propName] = value;
        }
    }

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
            data: null,
            chunkHeader: null,
            chunkBlocks: null
        };

        // Read all size/offset pairs
        BitmapData.readSizeOffsetPair(stream, bitmap, 'alias');
        BitmapData.readSizeOffsetPair(stream, bitmap, 'alpha');
        BitmapData.readSizeOffsetPair(stream, bitmap, 'zbuffer');
        BitmapData.readSizeOffsetPair(stream, bitmap, 'normal');
        BitmapData.readSizeOffsetPair(stream, bitmap, 'palette');

        bitmap.datasize = stream.readUint32();

        // Sanity checks
        if (bitmap.width > 8192 || bitmap.height > 8192) {
            throw new Error('Corrupted bitmap dimensions');
        }

        // if datasize is bigger than width * height, it's likely a corrupt bitmap
        // we want to set the width to datasize/height to get a valid bitmap
        if (bitmap.datasize > bitmap.width * bitmap.height) {
            console.warn('Corrupted bitmap detected, adjusting width');
            bitmap.width = bitmap.datasize / bitmap.height;
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
                const chunkHeader = new ChunkHeader(bitmapStream);
                bitmap.chunkHeader = chunkHeader;

                // Process each block
                for (let y = 0; y < chunkHeader.heightInBlocks; y++) {
                    for (let x = 0; x < chunkHeader.widthInBlocks; x++) {
                        bitmap.chunkBlocks = bitmap.chunkBlocks || [];
                        if (chunkHeader.isBlockBlank(x, y)) {
                            // This is a blank block, skip it
                            bitmap.chunkBlocks.push({
                                number: chunkHeader.getBlockIndex(x, y),
                                flag1: 0,
                                flag2: 0,
                                flag3: 0,
                                data: new Uint8Array(63 * 63) // Blank block
                            });
                            continue;
                        }

                        // Process non-blank block
                        const blockOffset = chunkHeader.getBlockOffset(x, y);
                        let blockSize = chunkHeader.getBlockSize(x, y);
                        if (blockSize === 0) {
                            // This is a special case where the block size is 0,
                            // which means it's the last block in the file
                            blockSize = bitmapBuffer.byteLength - blockOffset;
                        }
                        const { stream: blockStream } = BufferUtils.createBufferSlice(
                            bitmapBuffer,
                            blockOffset,
                            blockSize
                        );
                        const chunkBlock = ChunkDecompressor.decompressChunk(blockStream);
                        bitmap.chunkBlocks.push(chunkBlock);
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
}