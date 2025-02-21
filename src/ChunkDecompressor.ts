import { EOFError } from './InputStream';
import type { ChunkBlock } from './types';
import { DecompressionMethod } from './types';
import { InputStream } from './InputStream';
import { CHUNK_SIZE, CHUNK_WIDTH, CHUNK_HEIGHT } from './constants';

export class ChunkDecompressor {
    static decompressChunk(stream: InputStream): ChunkBlock {
        // Get chunk 32-bit header value (stored as 4 separate bytes for compatibility)
        const number = stream.readUint8();
        const flag1 = stream.readUint8();
        const flag2 = stream.readUint8();
        const flag3 = stream.readUint8();

        // Get compression markers (DLE bytes)
        const rleMarker = stream.readUint8();
        const lzMarker = stream.readUint8();

        // Initialize destination buffer
        let dest = new Uint8Array(CHUNK_SIZE);
        let decompMap = new Uint8Array(CHUNK_SIZE);
        
        let dstPos = 0; // Destination position
        let row = 0;    // Current row being processed

        try {
            while (row < CHUNK_HEIGHT && !stream.eof()) {
                const byte = stream.readUint8();

                if (byte === rleMarker) {
                    let count = stream.readUint8();

                    if (count === 0) {
                        // End of row marker
                        row++;
                        continue;
                    } else if ((count & 0x80) !== 0) {
                        // Skip mode
                        count &= 0x7F;
                        for (let i = 0; i < count; i++) {
                            decompMap[dstPos + i] = DecompressionMethod.RLE_SKIP;
                        }
                        dstPos += count;
                    } else {
                        // Normal RLE mode
                        const value = stream.readUint8();
                        for (let i = 0; i < count; i++) {
                            dest[dstPos] = value;
                            decompMap[dstPos] = DecompressionMethod.RLE_REPEAT;
                            dstPos++;
                        }
                    }
                } else if (byte === lzMarker) {
                    // LZ compression mode
                    const count = stream.readUint8();
                    const offset = stream.readUint16();
                    
                    // Calculate source position using same formula as Go
                    const srcPos = dstPos - offset - 4;
                    
                    for (let i = 0; i < count; i++) {
                        dest[dstPos] = dest[srcPos + i];
                        decompMap[dstPos] = DecompressionMethod.LZ;
                        dstPos++;
                    }
                } else {
                    // Raw byte copy
                    dest[dstPos] = byte;
                    decompMap[dstPos] = DecompressionMethod.RAW;
                    dstPos++;
                }
            }
        } catch (e) {
            if (!(e instanceof EOFError)) {
                console.error("Error decompressing chunk:", e);
                throw e;
            }
        }

        return {
            number,
            flag1,
            flag2,
            flag3,
            data: dest,
            decompressionMap: decompMap
        };
    }
}