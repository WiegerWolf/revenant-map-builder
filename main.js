const fs = require('fs').promises;
const path = require("path");

class InputStream {
    constructor(buffer) {
        this.buffer = buffer;
        this.offset = 0;
    }

    // Read 32-bit integer
    readInt32() {
        const value = this.buffer.readInt32LE(this.offset);
        this.offset += 4;
        return value;
    }

    // Read bytes
    readBytes(length) {
        const value = this.buffer.slice(this.offset, this.offset + length);
        this.offset += length;
        return value;
    }
}

class DatParser {
    static SectorMapFCC = ('M'.charCodeAt(0) << 0) | 
                         ('A'.charCodeAt(0) << 8) | 
                         ('P'.charCodeAt(0) << 16) | 
                         (' '.charCodeAt(0) << 24);

    static async loadFile(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            return DatParser.parse(buffer);
        } catch (error) {
            console.error('Error loading file:', error);
            return null;
        }
    }

    static parse(buffer) {
        const stream = new InputStream(buffer);
        let version = 0;

        // Read number of objects
        let numObjects = stream.readInt32();

        // Check if this is a sector map with header information
        if (numObjects === this.SectorMapFCC) {
            // Get sector map version
            version = stream.readInt32();
            numObjects = stream.readInt32();
        }

        return {
            version,
            numObjects,
            // Add more parsing logic here based on your needs
        };
    }
}

async function main() {
    const mapDir = path.join('..', '_INSTALLED_GAME', 'Revenant', 'Modules', 'Ahkuilon', 'Map');
    
    try {
        // Read all files in the directory
        const files = await fs.readdir(mapDir);
        
        // Filter for .dat files and process each one
        const datFiles = files.filter(file => file.toLowerCase().endsWith('.dat'));
        
        for (const datFile of datFiles) {
            const filePath = path.join(mapDir, datFile);
            console.log(`Processing ${datFile}...`);
            
            const result = await DatParser.loadFile(filePath);
            if (result && result.numObjects) {
                debugger;
                console.log(`File: ${datFile}`);
                console.log('Version:', result.version);
                console.log('Number of objects:', result.numObjects);
                console.log('-------------------');
            }
        }
    } catch (error) {
        console.error('Error reading directory:', error);
    }
}

main().catch(console.error);
