import { join, dirname } from "path";
import { promises as fs } from 'fs';
import { DatParser } from './src/DatParser';
import { BitmapRender } from './src/BitmapRender';

async function main() {
    const gameDir = join('_INSTALLED_GAME', 'Revenant');
    
    try {
        await DatParser.loadClassDefinitions(gameDir);
        const resourcePath = 'Cave/cavbones1.i2d';
        console.log(`Loading resource file: ${resourcePath}`);
        const resource = await DatParser.loadResourceFile(gameDir, resourcePath);
        
        if (resource) {
            console.log('Resource loaded successfully!');
            
            for (let bitmapIndex = 0; bitmapIndex < resource.bitmaps.length; bitmapIndex++) {
                const bitmap = resource.bitmaps[bitmapIndex];
                const relativePath = resourcePath.replace('.i2d', '');
                const bitmapDir = join('_OUTPUT/Imagery', relativePath, `bitmap_${bitmapIndex}`);
                
                // Create directory for this bitmap
                await fs.mkdir(bitmapDir, { recursive: true });

                // Save main bitmap if it has direct pixel data
                if (!bitmap.flags.bm_chunked && bitmap.data) {
                    const outputPath = join(bitmapDir, 'full.png');
                    await BitmapRender.renderBitmap(bitmap, outputPath);
                    console.log(`Bitmap saved to ${outputPath}`);
                }

                // Save palette if available
                if (bitmap.palette && typeof bitmap.palette !== 'number') {
                    const palettePath = join(bitmapDir, 'palette.png');
                    await BitmapRender.renderPaletteDebug(bitmap.palette, palettePath);
                    console.log(`Palette saved to ${palettePath}`);
                }

                // Save individual chunk blocks if present
                if (bitmap.chunkHeader && bitmap.chunkBlocks) {
                    console.log(`Processing ${bitmap.chunkBlocks.length} chunk blocks for bitmap ${bitmapIndex}`);
                    const blocksDir = join(bitmapDir, 'blocks');
                    await fs.mkdir(blocksDir, { recursive: true });

                    for (let blockIndex = 0; blockIndex < bitmap.chunkBlocks.length; blockIndex++) {
                        const blockPath = join(blocksDir, `block_${blockIndex}.png`);
                        await BitmapRender.renderChunkBlock(bitmap, blockIndex, blockPath);
                        console.log(`Chunk block ${blockIndex} saved to ${blockPath}`);
                    }
                }
            }
        } else {
            console.error('Failed to load resource!');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);