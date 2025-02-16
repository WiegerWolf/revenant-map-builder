import { createCanvas } from 'canvas';
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

        // Create a canvas with the bitmap dimensions
        const canvas = createCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');

        // Create pixel data array (RGBA format)
        const pixelData = new Uint8ClampedArray(bitmap.width * bitmap.height * 4);

        // Process pixels based on bitmap format
        for (let y = 0; y < bitmap.height; y++) {
            for (let x = 0; x < bitmap.width; x++) {
                const pixelIndex = (y * bitmap.width + x) * 4;
                let r = 0, g = 0, b = 0, a = 255;

                try {
                    if (bitmap.flags.bm_8bit && bitmap.palette && typeof bitmap.palette === 'object') {
                        const index = y * bitmap.width + x;
                        if (index < bitmap.data.length) {
                            const paletteIndex = (bitmap.data as Uint8Array)[index];
                            if (paletteIndex < 256) {
                                if (bitmap.flags.bm_5bitpal) {
                                    const colorData = bitmap.palette.colors[paletteIndex];
                                    const red = (colorData & 0xF800) >> 11;
                                    const green = (colorData & 0x07E0) >> 5;
                                    const blue = (colorData & 0x001F);
                                    r = (red * 255) / 31;
                                    g = (green * 255) / 63;
                                    b = (blue * 255) / 31;
                                } else {
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
                }

                // Set RGBA values in the pixel data array
                pixelData[pixelIndex] = r;     // R
                pixelData[pixelIndex + 1] = g; // G
                pixelData[pixelIndex + 2] = b; // B
                pixelData[pixelIndex + 3] = a; // A
            }
        }

        // Create ImageData and put it on the canvas
        const imageData = new ImageData(pixelData, bitmap.width, bitmap.height);
        ctx.putImageData(imageData, 0, 0);

        // Save the canvas to a file
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputPath, buffer);
    }
}