import { createCanvas, ImageData } from 'canvas';
import { promises as fs } from 'fs';
import { BitmapFlags } from './BitmapFlags';
import { DecompressionMethod } from './types';
import type { BitmapDataType, Palette } from './types';

interface RGBColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

export class BitmapRender {
    private static readonly DEFAULT_ALPHA = 255;

    static async renderBitmap(bitmap: BitmapDataType, outputPath: string): Promise<void> {
        if (!BitmapRender.validateBitmap(bitmap)) {
            throw new Error('Invalid bitmap data');
        }

        const canvas = createCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d');
        const imageData = BitmapRender.createImageData(bitmap);
        
        ctx.putImageData(imageData, 0, 0);
        
        // Save the canvas to a file
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputPath, buffer);
    }

    private static getPaletteColor(palette: Palette, index: number, use5BitPal: boolean = false): RGBColor {
        // Make index 0 transparent
        if (index === 0) {
            return { r: 0, g: 0, b: 0, a: 0 };
        }

        if (index >= 256) {
            return { r: 0, g: 0, b: 0, a: 255 };
        }

        if (use5BitPal && 'colors' in palette) {
            // Handle 5-bit palette
            const colorData = palette.colors[index];
            return {
                b: ((colorData & 0xF800) >> 11) * 255 / 31,  // Swapped r to b
                g: ((colorData & 0x07E0) >> 5) * 255 / 63,
                r: (colorData & 0x001F) * 255 / 31,          // Swapped b to r
                a: 255
            };
        } else if ('rgbcolors' in palette) {
            // Handle RGB palette
            const rgbColor = palette.rgbcolors[index];
            return {
                b: (rgbColor >> 16) & 0xFF,  // Swapped r to b
                g: (rgbColor >> 8) & 0xFF,
                r: rgbColor & 0xFF,          // Swapped b to r
                a: 255
            };
        }
        
        // Default case if neither palette type is available
        return { r: 0, g: 0, b: 0, a: 255 };
    }

    static async renderPaletteDebug(palette: Palette, outputPath: string): Promise<void> {
        const CELL_SIZE = 32; // pixels per color cell
        const GRID_SIZE = 16; // 16x16 grid for 256 colors
        const canvas = createCanvas(CELL_SIZE * GRID_SIZE, CELL_SIZE * GRID_SIZE);
        const ctx = canvas.getContext('2d');

        // Draw each palette color as a rectangle
        for (let i = 0; i < 256; i++) {
            const x = (i % GRID_SIZE) * CELL_SIZE;
            const y = Math.floor(i / GRID_SIZE) * CELL_SIZE;

            const color = this.getPaletteColor(palette, i);
            ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a / 255})`;
            ctx.fillRect(x, y, CELL_SIZE, CELL_SIZE);

            // Draw color index in hex and decimal
            ctx.fillStyle = this.getContrastingColor(color);
            ctx.font = '10px Arial';
            ctx.fillText(`0x${i.toString(16).padStart(2, '0')}`, x + 2, y + 12);
            ctx.fillText(`${i}`, x + 2, y + 24);
        }

        // Save the canvas to a file
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputPath, buffer);
    }

    private static getContrastingColor(color: RGBColor): string {
        // Calculate relative luminance
        const luminance = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b) / 255;
        // Return white for dark colors, black for light colors
        return luminance < 0.5 ? 'white' : 'black';
    }

    private static validateBitmap(bitmap: BitmapDataType): boolean {
        return Boolean(
            bitmap &&
            bitmap.width > 0 &&
            bitmap.height > 0 &&
            bitmap.data &&
            bitmap.flags
        );
    }

    private static createImageData(bitmap: BitmapDataType): ImageData {
        const pixelData = new Uint8ClampedArray(bitmap.width * bitmap.height * 4);

        for (let y = 0; y < bitmap.height; y++) {
            for (let x = 0; x < bitmap.width; x++) {
                const pixelIndex = (y * bitmap.width + x) * 4;
                const color = this.getPixelColor(bitmap, x, y);
                
                pixelData[pixelIndex] = color.r;     // R
                pixelData[pixelIndex + 1] = color.g; // G
                pixelData[pixelIndex + 2] = color.b; // B
                pixelData[pixelIndex + 3] = color.a; // A
            }
        }

        return new ImageData(pixelData, bitmap.width, bitmap.height);
    }

    private static getPixelColor(bitmap: BitmapDataType, x: number, y: number): RGBColor {
        try {
            const index = y * bitmap.width + x;
            const flags = bitmap.flags;

            if (flags.bm_8bit && bitmap.palette && typeof bitmap.palette !== 'number') {
                return this.process8BitColor(bitmap.data as Uint8Array, bitmap.palette, index, flags);
            }
            if (flags.bm_15bit) {
                return this.process15BitColor(bitmap.data as Uint16Array, index);
            }
            if (flags.bm_16bit) {
                return this.process16BitColor(bitmap.data as Uint16Array, index);
            }
            if (flags.bm_24bit) {
                return this.process24BitColor(bitmap.data as Uint8Array, index);
            }
            if (flags.bm_32bit) {
                return this.process32BitColor(bitmap.data as Uint32Array, index);
            }
        } catch (error) {
            console.warn(`Error processing pixel at ${x},${y}:`, error);
        }

        return { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };
    }

    private static process8BitColor(data: Uint8Array, palette: Palette, index: number, flags: BitmapFlags): RGBColor {
        if (index >= data.length) {
            return { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };
        }

        const paletteIndex = data[index];
        return this.getPaletteColor(palette, paletteIndex, flags.bm_5bitpal);
    }

    private static process15BitColor(data: Uint16Array, index: number): RGBColor {
        if (index >= data.length) {
            return { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };
        }

        const pixel = data[index];
        return {
            b: ((pixel & 0x7C00) >> 10) << 3,  // Swapped r to b
            g: ((pixel & 0x03E0) >> 5) << 3,
            r: (pixel & 0x001F) << 3,          // Swapped b to r
            a: this.DEFAULT_ALPHA
        };
    }

    private static process16BitColor(data: Uint16Array, index: number): RGBColor {
        if (index >= data.length) {
            return { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };
        }

        const pixel = data[index];
        return {
            b: ((pixel & 0xF800) >> 11) << 3,  // Swapped r to b
            g: ((pixel & 0x07E0) >> 5) << 2,
            r: (pixel & 0x001F) << 3,          // Swapped b to r
            a: this.DEFAULT_ALPHA
        };
    }

    private static process24BitColor(data: Uint8Array, index: number): RGBColor {
        const pixelOffset = index * 3;
        if (pixelOffset + 2 >= data.length) {
            return { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };
        }

        return {
            r: data[pixelOffset],     // Was b
            g: data[pixelOffset + 1],
            b: data[pixelOffset + 2], // Was r
            a: this.DEFAULT_ALPHA
        };
    }

    private static process32BitColor(data: Uint32Array, index: number): RGBColor {
        if (index >= data.length) {
            return { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };
        }

        const pixel = data[index];
        return {
            b: (pixel >> 16) & 0xFF,  // Swapped r to b
            g: (pixel >> 8) & 0xFF,
            r: pixel & 0xFF,          // Swapped b to r
            a: this.DEFAULT_ALPHA
        };
    }

    static async renderChunkBlock(bitmap: BitmapDataType, blockIndex: number, outputPath: string): Promise<void> {
        if (!bitmap.chunkHeader || !bitmap.chunkBlocks || !bitmap.chunkBlocks[blockIndex]) {
            throw new Error('Invalid chunk block data');
        }

        const chunkHeader = bitmap.chunkHeader;
        const blockWidth = chunkHeader.blockWidth;
        const blockHeight = chunkHeader.blockHeight;
        const canvas = createCanvas(blockWidth, blockHeight);
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(blockWidth, blockHeight);
        const chunkBlock = bitmap.chunkBlocks[blockIndex];

        // Fill the image data with the chunk block data
        for (let y = 0; y < blockHeight; y++) {
            for (let x = 0; x < blockWidth; x++) {
                const pixelIndex = (y * blockWidth + x);
                const dataIndex = pixelIndex * 4;
                const paletteIndex = chunkBlock.data[pixelIndex];
                
                const color = bitmap.palette && typeof bitmap.palette !== 'number' 
                    ? this.getPaletteColor(bitmap.palette, paletteIndex, bitmap.flags.bm_5bitpal)
                    : { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };

                imageData.data[dataIndex] = color.r;
                imageData.data[dataIndex + 1] = color.g;
                imageData.data[dataIndex + 2] = color.b;
                imageData.data[dataIndex + 3] = color.a;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        
        // Save the canvas to a file
        const buffer = canvas.toBuffer('image/png');
        await fs.writeFile(outputPath, buffer);
    }

    static async renderChunkBlockWithDecompressionMap(bitmap: BitmapDataType, blockIndex: number, outputPath: string, decompressionMapPath: string, overlayPath: string): Promise<void> {
        if (!bitmap.chunkHeader || !bitmap.chunkBlocks || !bitmap.chunkBlocks[blockIndex]) {
            throw new Error('Invalid chunk block data');
        }

        const chunkHeader = bitmap.chunkHeader;
        const blockWidth = chunkHeader.blockWidth;
        const blockHeight = chunkHeader.blockHeight;
        const chunkBlock = bitmap.chunkBlocks[blockIndex];

        // First render the normal image to a canvas
        const baseCanvas = createCanvas(blockWidth, blockHeight);
        const baseCtx = baseCanvas.getContext('2d');
        const baseImageData = baseCtx.createImageData(blockWidth, blockHeight);

        // Fill the base image data with the chunk block data
        for (let y = 0; y < blockHeight; y++) {
            for (let x = 0; x < blockWidth; x++) {
                const pixelIndex = (y * blockWidth + x);
                const dataIndex = pixelIndex * 4;
                const paletteIndex = chunkBlock.data[pixelIndex];
                
                const color = bitmap.palette && typeof bitmap.palette !== 'number' 
                    ? this.getPaletteColor(bitmap.palette, paletteIndex, bitmap.flags.bm_5bitpal)
                    : { r: 0, g: 0, b: 0, a: this.DEFAULT_ALPHA };

                baseImageData.data[dataIndex] = color.r;
                baseImageData.data[dataIndex + 1] = color.g;
                baseImageData.data[dataIndex + 2] = color.b;
                baseImageData.data[dataIndex + 3] = color.a;
            }
        }

        baseCtx.putImageData(baseImageData, 0, 0);
        
        // Save the base image
        await fs.writeFile(outputPath, baseCanvas.toBuffer('image/png'));

        // Create decompression map visualization
        const decompCanvas = createCanvas(blockWidth, blockHeight);
        const decompCtx = decompCanvas.getContext('2d');
        const decompImageData = decompCtx.createImageData(blockWidth, blockHeight);

        // Define colors for each decompression method
        const methodColors: Record<DecompressionMethod, RGBColor> = {
            [DecompressionMethod.RAW]: { r: 0, g: 255, b: 0, a: 128 },       // RAW: Green
            [DecompressionMethod.RLE_SKIP]: { r: 255, g: 0, b: 0, a: 128 },  // RLE_SKIP: Red
            [DecompressionMethod.RLE_REPEAT]: { r: 0, g: 0, b: 255, a: 128 },// RLE_REPEAT: Blue
            [DecompressionMethod.LZ]: { r: 255, g: 255, b: 0, a: 128 }       // LZ: Yellow
        };

        const defaultColor: RGBColor = { r: 128, g: 128, b: 128, a: 128 };  // Gray for unknown methods

        // Fill the decompression map data
        if (chunkBlock.decompressionMap) {
            for (let y = 0; y < blockHeight; y++) {
                for (let x = 0; x < blockWidth; x++) {
                    const pixelIndex = (y * blockWidth + x);
                    const dataIndex = pixelIndex * 4;
                    const method = chunkBlock.decompressionMap[pixelIndex];
                    const color = methodColors[method as DecompressionMethod] || defaultColor;

                    decompImageData.data[dataIndex] = color.r;
                    decompImageData.data[dataIndex + 1] = color.g;
                    decompImageData.data[dataIndex + 2] = color.b;
                    decompImageData.data[dataIndex + 3] = color.a;
                }
            }
        }

        decompCtx.putImageData(decompImageData, 0, 0);
        
        // Save the decompression map
        await fs.writeFile(decompressionMapPath, decompCanvas.toBuffer('image/png'));

        // Create the overlay by combining both images
        const overlayCanvas = createCanvas(blockWidth, blockHeight);
        const overlayCtx = overlayCanvas.getContext('2d');
        
        // Draw the base image first
        overlayCtx.drawImage(baseCanvas, 0, 0);
        // Then overlay the decompression map with alpha blending
        overlayCtx.drawImage(decompCanvas, 0, 0);

        // Save the overlay
        await fs.writeFile(overlayPath, overlayCanvas.toBuffer('image/png'));
    }
}