import { promises as fs } from 'fs';
import type { BitmapDataType } from './types';

export class BitmapRender {
    static async renderBitmap(bitmap: BitmapDataType, outputPath: string): Promise<void> {
        // First, let's validate the input
        if (!bitmap || !bitmap.width || !bitmap.height || !bitmap.data) {
            console.error('Invalid bitmap data');
            debugger;
            return;
        }

        const headerSize = 14;
        const infoSize = 40;
        const bitsPerPixel = 24;
        const bytesPerPixel = bitsPerPixel / 8;

        const rowSize = Math.floor((bitsPerPixel * bitmap.width + 31) / 32) * 4;
        const paddingSize = rowSize - (bitmap.width * bytesPerPixel);
        const imageSize = rowSize * bitmap.height;
        const fileSize = headerSize + infoSize + imageSize;

        const buffer = Buffer.alloc(fileSize);

        // Write headers...
        buffer.write('BM', 0);
        buffer.writeUInt32LE(fileSize, 2);
        buffer.writeUInt32LE(0, 6);
        buffer.writeUInt32LE(headerSize + infoSize, 10);

        buffer.writeUInt32LE(infoSize, 14);
        buffer.writeInt32LE(bitmap.width, 18);
        buffer.writeInt32LE(bitmap.height, 22);
        buffer.writeUInt16LE(1, 26);
        buffer.writeUInt16LE(bitsPerPixel, 28);
        buffer.writeUInt32LE(0, 30);
        buffer.writeUInt32LE(imageSize, 34);
        buffer.writeInt32LE(0, 38);
        buffer.writeInt32LE(0, 42);
        buffer.writeUInt32LE(0, 46);
        buffer.writeUInt32LE(0, 50);

        let offset = headerSize + infoSize;

        // Pixel data writing with more defensive checks
        for (let y = bitmap.height - 1; y >= 0; y--) {
            for (let x = 0; x < bitmap.width; x++) {
                let r = 0, g = 0, b = 0;

                try {
                    if (bitmap.flags.bm_8bit && bitmap.palette && typeof bitmap.palette === 'object') {
                        const index = y * bitmap.width + x;
                        if (index < bitmap.data.length) {
                            const paletteIndex = (bitmap.data as Uint8Array)[index];
                            if (paletteIndex < 256) {
                                if (bitmap.flags.bm_5bitpal) {
                                    // Use the 16-bit color value from colors array for 5-bit palette
                                    const colorData = bitmap.palette.colors[paletteIndex];

                                    // Convert 16-bit color to RGB components
                                    const red = (colorData & 0xF800) >> 11; // Extract top 5 bits
                                    const green = (colorData & 0x07E0) >> 5; // Extract middle 6 bits
                                    const blue = (colorData & 0x001F); // Extract bottom 5 bits

                                    // Convert to 8-bit color values
                                    r = (red * 255) / 31; // Scale 5-bit to 8-bit
                                    g = (green * 255) / 63; // Scale 6-bit to 8-bit
                                    b = (blue * 255) / 31; // Scale 5-bit to 8-bit
                                } else {
                                    // Use the 32-bit rgbcolors array for regular palette
                                    const rgbColor = bitmap.palette.rgbcolors[paletteIndex];
                                    r = (rgbColor >> 16) & 0xFF;
                                    g = (rgbColor >> 8) & 0xFF;
                                    b = rgbColor & 0xFF;
                                }
                            }
                        }
                    }
                    else if (bitmap.flags.bm_15bit) {
                        const index = y * bitmap.width + x;
                        if (index < bitmap.data.length) {
                            const pixel = (bitmap.data as Uint16Array)[index];
                            r = ((pixel & 0x7C00) >> 10) << 3;
                            g = ((pixel & 0x03E0) >> 5) << 3;
                            b = (pixel & 0x001F) << 3;
                        }
                    }
                    else if (bitmap.flags.bm_16bit) {
                        const index = y * bitmap.width + x;
                        if (index < bitmap.data.length) {
                            const pixel = (bitmap.data as Uint16Array)[index];
                            r = ((pixel & 0xF800) >> 11) << 3;
                            g = ((pixel & 0x07E0) >> 5) << 2;
                            b = (pixel & 0x001F) << 3;
                        }
                    }
                    else if (bitmap.flags.bm_24bit) {
                        const pixelOffset = (y * bitmap.width + x) * 3;
                        if (pixelOffset + 2 < bitmap.data.length) {
                            b = (bitmap.data as Uint8Array)[pixelOffset];
                            g = (bitmap.data as Uint8Array)[pixelOffset + 1];
                            r = (bitmap.data as Uint8Array)[pixelOffset + 2];
                        }
                    }
                    else if (bitmap.flags.bm_32bit) {
                        const index = y * bitmap.width + x;
                        if (index < bitmap.data.length) {
                            const pixel = (bitmap.data as Uint32Array)[index];
                            r = (pixel >> 16) & 0xFF;
                            g = (pixel >> 8) & 0xFF;
                            b = pixel & 0xFF;
                        }
                    }
                } catch (error) {
                    console.warn(`Error processing pixel at ${x},${y}:`, error);
                    // Continue with default black pixel
                }

                // Write the pixel
                buffer[offset++] = b;
                buffer[offset++] = g;
                buffer[offset++] = r;
            }

            offset += paddingSize;
        }

        await fs.writeFile(outputPath, buffer);
    }
}