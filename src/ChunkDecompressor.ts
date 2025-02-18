import { EOFError } from './InputStream';
import type { ChunkBlock } from './types';
import { InputStream } from './InputStream';

export class ChunkDecompressor {
    static decompressChunk(stream: InputStream, blockWidth: number, blockHeight: number, clear: number = 1): ChunkBlock {
        // Get chunk number from stream
        const number = stream.readUint8();
        const flag1 = stream.readUint8();
        const flag2 = stream.readUint8();
        const flag3 = stream.readUint8();
        console.log(`Decompressing chunk ${number} with flags ${flag1} ${flag2} ${flag3}`);

        // Get compression markers
        const rleMarker = stream.readUint8();
        const lzMarker = stream.readUint8();

        // Create destination buffer with the correct size
        let dest = new Uint8Array(blockWidth * blockHeight);
        const clearValue = clear === 1 ? 0x00 : 0xFF;
        dest.fill(clearValue);

        let dstPos = 0;

        try {
            while (!stream.eof()) {
                const byte = stream.readUint8();

                if (byte === rleMarker) {
                    // RLE compression
                    let count = stream.readUint8();

                    if (count & 0x80) {
                        // Skip RLE
                        count &= 0x7F;
                        dstPos += count;
                    } else {
                        // Normal RLE
                        const value = stream.readUint8();
                        // Ensure dest array is large enough
                        if (dstPos + count > dest.length) {
                            const newDest = new Uint8Array(dest.length * 2);
                            newDest.set(dest);
                            dest = newDest;
                        }
                        for (let i = 0; i < count; i++) {
                            dest[dstPos++] = value;
                        }
                    }
                } else if (byte === lzMarker) {
                    // LZ compression
                    const count = stream.readUint8();
                    const offset = stream.readUint16();

                    // Ensure dest array is large enough
                    if (dstPos + count > dest.length) {
                        const newDest = new Uint8Array(dest.length * 2);
                        newDest.set(dest);
                        dest = newDest;
                    }

                    // Copy from earlier in the output
                    for (let i = 0; i < count; i++) {
                        dest[dstPos] = dest[dstPos - offset];
                        dstPos++;
                    }
                } else {
                    // Raw byte
                    // Ensure dest array is large enough
                    if (dstPos >= dest.length) {
                        const newDest = new Uint8Array(dest.length * 2);
                        newDest.set(dest);
                        dest = newDest;
                    }
                    dest[dstPos++] = byte;
                }
            }
        } catch (e) {
            if (!(e instanceof EOFError)) {
                console.error("Error decompressing chunk:", e);
                debugger;
            }
        }

        // Trim the array to actual size
        const finalDest = new Uint8Array(dstPos);
        finalDest.set(dest.subarray(0, dstPos));

        return {
            number,
            flag1,
            flag2,
            flag3,
            data: finalDest
        };
    }
}