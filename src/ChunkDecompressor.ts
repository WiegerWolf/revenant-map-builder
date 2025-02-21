import { EOFError } from './InputStream';
import type { ChunkBlock } from './types';
import { DecompressionMethod } from './types';
import { InputStream } from './InputStream';
import { CHUNK_SIZE } from './constants';

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

        // Initialize destination buffer with zeros - ensure DWORD alignment
        const alignedBuffer = new ArrayBuffer(Math.ceil(CHUNK_SIZE / 4) * 4);
        let dest = new Uint8Array(alignedBuffer, 0, CHUNK_SIZE);
        let decompMap = new Uint8Array(CHUNK_SIZE);
        dest.fill(0);
        let dstPos = 0;

        try {
            while (dstPos < CHUNK_SIZE && !stream.eof()) {
                const byte = stream.readUint8();

                if (byte === rleMarker) {
                    let count = stream.readUint8();
                    
                    if (count & 0x80) {
                        // Skip RLE mode
                        count &= 0x7F;
                        for (let i = 0; i < count; i++) {
                            decompMap[dstPos + i] = DecompressionMethod.RLE_SKIP;
                        }
                        dstPos += count;
                    } else {
                        // Normal RLE mode - optimize for DWORD alignment when possible
                        const value = stream.readUint8();
                        const dwordCount = Math.floor(count / 4);
                        const remainingBytes = count % 4;
                        
                        // Fill DWORDs
                        const dwordValue = (value << 24) | (value << 16) | (value << 8) | value;
                        
                        if (dwordCount > 0) {
                            const dwordView = new Uint32Array(alignedBuffer, Math.floor(dstPos / 4) * 4);
                            for (let i = 0; i < dwordCount && dstPos + (i * 4) < CHUNK_SIZE; i++) {
                                if ((dstPos & 3) === 0) {
                                    dwordView[i] = dwordValue;
                                    decompMap.fill(DecompressionMethod.RLE_REPEAT, dstPos, dstPos + 4);
                                    dstPos += 4;
                                } else {
                                    // Fallback for unaligned positions
                                    for (let j = 0; j < 4 && dstPos < CHUNK_SIZE; j++) {
                                        dest[dstPos] = value;
                                        decompMap[dstPos] = DecompressionMethod.RLE_REPEAT;
                                        dstPos++;
                                    }
                                }
                            }
                        }
                        
                        // Handle remaining bytes
                        for (let i = 0; i < remainingBytes && dstPos < CHUNK_SIZE; i++) {
                            dest[dstPos] = value;
                            decompMap[dstPos] = DecompressionMethod.RLE_REPEAT;
                            dstPos++;
                        }
                    }
                } else if (byte === lzMarker) {
                    // LZ compression - sliding window copy
                    const count = stream.readUint8();
                    const offset = stream.readUint16();
                    
                    if (count < 4 || offset < 4) {
                        // Short copies or small offsets - byte by byte
                        for (let i = 0; i < count && dstPos < CHUNK_SIZE; i++) {
                            dest[dstPos] = dest[dstPos - offset];
                            decompMap[dstPos] = DecompressionMethod.LZ;
                            dstPos++;
                        }
                    } else {
                        // Optimize longer copies based on alignment
                        let srcPos = dstPos - offset;
                        let remaining = count;
                        
                        // Handle DWORD-aligned copies when possible
                        if ((srcPos & 3) === 0 && (dstPos & 3) === 0 && remaining >= 4) {
                            const srcView = new Uint32Array(alignedBuffer, Math.floor(srcPos / 4) * 4);
                            const dstView = new Uint32Array(alignedBuffer, Math.floor(dstPos / 4) * 4);
                            
                            while (remaining >= 4 && dstPos + 4 <= CHUNK_SIZE) {
                                dstView[0] = srcView[0];
                                decompMap.fill(DecompressionMethod.LZ, dstPos, dstPos + 4);
                                dstPos += 4;
                                srcPos += 4;
                                remaining -= 4;
                            }
                        }
                        
                        // Handle remaining bytes
                        while (remaining > 0 && dstPos < CHUNK_SIZE) {
                            dest[dstPos] = dest[dstPos - offset];
                            decompMap[dstPos] = DecompressionMethod.LZ;
                            dstPos++;
                            remaining--;
                        }
                    }
                } else {
                    // Raw byte copy
                    if (dstPos < CHUNK_SIZE) {
                        dest[dstPos] = byte;
                        decompMap[dstPos] = DecompressionMethod.RAW;
                        dstPos++;
                    }
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