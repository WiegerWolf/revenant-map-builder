const fs = require('fs').promises;
const path = require("path");

class InputStream {
    constructor(buffer) {
        this.dataView = new DataView(buffer);
        this.offset = 0;
    }

    readInt32() {
        const value = this.dataView.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readInt16() {
        const value = this.dataView.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint32() {
        const value = this.dataView.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    skip(bytes) {
        this.offset += bytes;
    }

    setPos(pos) {
        this.offset = pos;
    }

    getPos() {
        return this.offset;
    }
}

class DatParser {
    static SectorMapFCC = ('M'.charCodeAt(0) << 0) | 
                         ('A'.charCodeAt(0) << 8) | 
                         ('P'.charCodeAt(0) << 16) | 
                         (' '.charCodeAt(0) << 24);
    static MAXOBJECTCLASSES = 256; // Adjust this value as needed
    static OBJCLASS_TILE = 1; // Adjust this value based on your needs

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

        // Array to store all loaded objects
        const objects = [];

        // Load each object
        for (let i = 0; i < numObjects; i++) {
            const obj = this.loadObject(stream, version, true);
            if (obj) {
                objects.push(obj);
            }
        }

        return {
            version,
            numObjects,
            objects
        };
    }

    static loadObject(stream, version, isMap) {
        let uniqueId = 0;
        let objVersion = 0;
        let objClass;
        let objType;
        let blockSize;
        let forcesimple = false;
        let corrupted = false;

        // Load object block header
        if (version >= 8) {
            objVersion = stream.readInt16();
        }

        if (objVersion < 0) {
            return null;
        }

        objClass = stream.readInt16();
        if (objClass < 0) {
            return null;
        }

        // Handle different versions
        if (version < 1) {
            // Version 0 - No Unique ID's
            objType = stream.readInt16();
            uniqueId = 0;
            blockSize = -1;
        } else if (version < 4) {
            // Version 1-3 - Unique ID's used
            objType = -1;
            uniqueId = stream.readUint32();
            blockSize = -1;
        } else {
            // Version 4+ has block size
            objType = -1;
            uniqueId = stream.readUint32();
            blockSize = stream.readInt16();
        }

        // Validate object class
        const objectClass = this.getObjectClass(objClass);
        if (!objectClass) {
            if (blockSize >= 0) {
                // Skip this object
                stream.skip(blockSize);
                return null;
            } else {
                // Try to fix it by assuming it's a tile
                objClass = this.OBJCLASS_TILE;
                corrupted = true;
            }
        }

        // Handle object type resolution
        if (objType < 0) {
            objType = this.findObjectType(uniqueId, objClass);
            
            if (objType < 0) {
                // Search all classes for the unique ID
                for (let newObjClass = 0; newObjClass < this.MAXOBJECTCLASSES; newObjClass++) {
                    const newType = this.findObjectType(uniqueId, newObjClass);
                    if (newType >= 0) {
                        objClass = newObjClass;
                        objType = newType;
                        forcesimple = true;
                        break;
                    }
                }
            }

            if (objType < 0) {
                if (blockSize >= 0) {
                    stream.skip(blockSize);
                    return null;
                } else {
                    objType = 0;
                    corrupted = true;
                }
            }
        }

        // Record the start position for block size handling
        const startPos = stream.offset;

        // Load object data
        const objectData = this.loadObjectData(stream, version, objVersion, forcesimple);
        const inventory = this.loadInventory(stream, version);

        // Handle block size positioning
        if (blockSize >= 0) {
            stream.setPos(startPos + blockSize);
        }

        // Skip corrupted objects
        if (corrupted || (isMap && this.hasNonMapFlag(objectData))) {
            return null;
        }

        return {
            class: objClass,
            type: objType,
            version: objVersion,
            uniqueId,
            data: objectData,
            inventory
        };
    }

    static getObjectClass(classId) {
        // Implement your object class lookup logic here
        return true; // Placeholder
    }

    static findObjectType(uniqueId, classId) {
        // Implement your object type lookup logic here
        return 0; // Placeholder
    }

    static loadObjectData(stream, version, objVersion, forcesimple) {
        // Implement object-specific loading logic here
        return {};
    }

    static loadInventory(stream, version) {
        // Implement inventory loading logic here
        return [];
    }

    static hasNonMapFlag(objectData) {
        // Implement flag checking logic here
        return false;
    }
}

async function main() {
    const mapDir = path.join('_INSTALLED_GAME', 'Revenant', 'Modules', 'Ahkuilon', 'Map');
    
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
