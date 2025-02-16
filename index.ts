import { promises as fs } from 'fs';
import { join } from "path";
import { ImageryDatParser } from './src/ImageryDatParser';
import { DatParser } from './src/DatParser';

async function main() {
    const gameDir = join('_INSTALLED_GAME', 'Revenant');
    const mapDir = join(gameDir, 'Modules', 'Ahkuilon', 'Map');
    const resourcesDir = join(gameDir, 'Resources');

    try {
        // Load IMAGERY.DAT first
        console.log('Loading IMAGERY.DAT...');
        const imageryDatPath = join(resourcesDir, 'imagery.dat');
        const imageryData = await ImageryDatParser.loadFile(imageryDatPath, gameDir);
        if (imageryData) {
            console.log(`Loaded ${imageryData.entries.length} imagery entries`);
            debugger;
        }

        // Then proceed with the rest of the processing
        await DatParser.loadClassDefinitions(gameDir);

        const files = await fs.readdir(mapDir);
        const datFiles = files.filter(file => file.toLowerCase().endsWith('.dat'));

        for (const datFile of datFiles) {
            const filePath = join(mapDir, datFile);
            console.log(`Processing ${datFile}...`);
            const result = await DatParser.loadFile(filePath, gameDir);
            if (result && result.numObjects) {
                console.log(`File: ${datFile}`);
                console.log('Version:', result.version);
                console.log('Number of objects:', result.numObjects);

                // Process each object's resource
                for (const obj of result.objects) {
                    // todo
                }

                console.log('-------------------');
            }
        }
    } catch (error) {
        debugger;
        console.error('Error reading directory:', error);
    }
}

main().catch(console.error);
