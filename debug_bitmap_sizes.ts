import { join } from "path";
import { promises as fs } from 'fs';
import { DatParser } from './src/DatParser';
import { BitmapRender } from './src/BitmapRender';

async function generateWidthVariants(bitmap: any, basePath: string, index: number) {
    const TEST_HEIGHT = 64;
    const MAX_WIDTH = 128;

    for (let width = 1; width <= MAX_WIDTH; width++) {
        // Create a modified copy of the bitmap with new dimensions
        const modifiedBitmap = {
            ...bitmap,
            width: width,
            height: TEST_HEIGHT,
            data: bitmap.data // Keep original data for now
        };

        const variantPath = join(basePath, `bitmap_${index}_w${width.toString().padStart(3, '0')}.png`);
        try {
            await BitmapRender.renderBitmap(modifiedBitmap, variantPath);
            console.log(`Generated variant with width ${width} at ${variantPath}`);
        } catch (error) {
            console.warn(`Failed to generate variant with width ${width}:`, error);
        }
    }
}

async function main() {
    const gameDir = join('_INSTALLED_GAME', 'Revenant');
    
    try {
        // Load class definitions first (needed by DatParser)
        await DatParser.loadClassDefinitions(gameDir);

        // Load specific resource file - you can change this path as needed
        const resourcePath = 'Cave/cavbones1.i2d';
        console.log(`Loading resource file: ${resourcePath}`);
        const resource = await DatParser.loadResourceFile(gameDir, resourcePath);
        
        if (resource) {
            console.log('Resource loaded successfully!');
            console.log('Number of bitmaps:', resource.bitmaps.length);
            
            // Process each bitmap
            for (let index = 0; index < resource.bitmaps.length; index++) {
                const bitmap = resource.bitmaps[index];
                console.log(`\nProcessing Bitmap ${index}:`);
                console.log('Original Width:', bitmap.width);
                console.log('Original Height:', bitmap.height);
                console.log('Flags:', bitmap.flags);

                // Setup base path for saving the bitmap variants
                const relativePath = resourcePath.replace('.i2d', '');
                const outputBaseDir = join('_OUTPUT/Imagery', relativePath, `bitmap_${index}_size_test`);
                
                // Create variant directory
                await fs.mkdir(outputBaseDir, { recursive: true });

                // Generate width variants
                await generateWidthVariants(bitmap, outputBaseDir, index);

                // Save palette debug if available
                if (bitmap.palette) {
                    const palletOutputPath = join(outputBaseDir, `palette.png`);
                    await BitmapRender.renderPaletteDebug(bitmap.palette, palletOutputPath);
                    console.log(`Palette saved to ${palletOutputPath}`);
                }
            }
        } else {
            console.error('Failed to load resource!');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

if (require.main === module) {
    main().catch(console.error);
}