import { join, dirname } from "path";
import { promises as fs } from 'fs';
import { DatParser } from './src/DatParser';
import { BitmapRender } from './src/BitmapRender';

async function main() {
    const gameDir = join('_INSTALLED_GAME', 'Revenant');
    
    try {
        // Load class definitions first (needed by DatParser)
        await DatParser.loadClassDefinitions(gameDir);

        // Load specific resource file
        const resourcePath = 'Cave/cavbones1.i2d';
        console.log(`Loading resource file: ${resourcePath}`);
        const resource = await DatParser.loadResourceFile(gameDir, resourcePath);
        
        if (resource) {
            console.log('Resource loaded successfully!');
            console.log('Number of bitmaps:', resource.bitmaps.length);
            
            // Print details of each bitmap
            resource.bitmaps.forEach(async (bitmap, index) => {
                console.log(`\nBitmap ${index}:`);
                console.log('Width:', bitmap.width);
                console.log('Height:', bitmap.height);
                console.log('Flags:', bitmap.flags);
                console.log('Palette size:', bitmap.palette?.length);

                // Setup paths for saving the bitmap and palette
                const relativePath = resourcePath.replace('.i2d', '');
                const outputPath = join('_OUTPUT/Imagery', relativePath, `bitmap_${index}.png`);
                const palletOutputPath = join('_OUTPUT/Imagery', relativePath, `palette_${index}.png`);

                // Create directories if they don't exist
                await fs.mkdir(dirname(outputPath), { recursive: true });

                // Save bitmap and palette
                await BitmapRender.renderBitmap(bitmap, outputPath);
                console.log(`Bitmap saved to ${outputPath}`);

                if (bitmap.palette) {
                    await BitmapRender.renderPaletteDebug(bitmap.palette, palletOutputPath);
                    console.log(`Palette saved to ${palletOutputPath}`);
                } else {
                    console.warn(`No palette for bitmap ${index}`);
                }
            });
        } else {
            console.error('Failed to load resource!');
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

main().catch(console.error);