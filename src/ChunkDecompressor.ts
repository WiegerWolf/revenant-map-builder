import { EOFError } from './InputStream';
import type { ChunkBlock } from './types';
import { DecompressionMethod } from './types';
import { InputStream } from './InputStream';

export class ChunkDecompressor {
    static decompressChunk(stream: InputStream): ChunkBlock {
        // Get chunk number from stream
        const number = stream.readUint8();
        const flag1 = stream.readUint8();
        const flag2 = stream.readUint8();
        const flag3 = stream.readUint8();
        console.log(`Decompressing chunk ${number} with flags ${flag1} ${flag2} ${flag3}`);

        // Get compression markers
        const rleMarker = stream.readUint8();
        const lzMarker = stream.readUint8();

        // Start with a small buffer that will grow as needed
        let dest = new Uint8Array(1024);
        let decompMap = new Uint8Array(1024);  // Track decompression method
        let dstPos = 0;

        try {
            while (!stream.eof()) {
                const byte = stream.readUint8();

                // Ensure we have room for at least a few more bytes
                if (dstPos >= dest.length - 256) {
                    const newDest = new Uint8Array(dest.length * 2);
                    const newDecompMap = new Uint8Array(dest.length * 2);
                    newDest.set(dest);
                    newDecompMap.set(decompMap);
                    dest = newDest;
                    decompMap = newDecompMap;
                }

                if (byte === rleMarker) {
                    // RLE compression
                    let count = stream.readUint8();

                    if (count & 0x80) {
                        // Skip RLE
                        count &= 0x7F;
                        for (let i = 0; i < count; i++) {
                            decompMap[dstPos + i] = DecompressionMethod.RLE_SKIP;
                        }
                        dstPos += count;
                    } else {
                        // Normal RLE
                        const value = stream.readUint8();
                        for (let i = 0; i < count; i++) {
                            dest[dstPos] = value;
                            decompMap[dstPos] = DecompressionMethod.RLE_REPEAT;
                            dstPos++;
                        }
                    }
                } else if (byte === lzMarker) {
                    // LZ compression
                    const count = stream.readUint8();
                    const offset = stream.readUint16();

                    // Copy from earlier in the output
                    for (let i = 0; i < count; i++) {
                        dest[dstPos] = dest[dstPos - offset];
                        decompMap[dstPos] = DecompressionMethod.LZ;
                        dstPos++;
                    }
                } else {
                    // Raw byte
                    dest[dstPos] = byte;
                    decompMap[dstPos] = DecompressionMethod.RAW;
                    dstPos++;
                }
            }
        } catch (e) {
            if (!(e instanceof EOFError)) {
                console.error("Error decompressing chunk:", e);
                debugger;
            }
        }

        // Trim the arrays to actual size
        const finalDest = new Uint8Array(dstPos);
        const finalDecompMap = new Uint8Array(dstPos);
        finalDest.set(dest.subarray(0, dstPos));
        finalDecompMap.set(decompMap.subarray(0, dstPos));

        return {
            number,
            flag1,
            flag2,
            flag3,
            data: finalDest,
            decompressionMap: finalDecompMap
        };
    }
}