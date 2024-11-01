const fs = require('fs').promises;
const path = require("path");

class InputStream {
    constructor(arrayBuffer) {
        this.dataView = new DataView(arrayBuffer);
        this.offset = 0;
    }

    readInt32() {
        const value = this.dataView.getInt32(this.offset, true); // true for little-endian
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

    readUint16() {
        const value = this.dataView.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint8() {
        const value = this.dataView.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readString() {
        const length = this.readUint8();
        const bytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.offset, length);
        this.offset += length;
        return new TextDecoder('ascii').decode(bytes);
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
    static OBJ_CLASSES = {
        0: 'item',
        1: 'weapon',
        2: 'armor',
        3: 'talisman',
        4: 'food',
        5: 'container',
        6: 'lightsource',
        7: 'tool',
        8: 'money',
        9: 'tile',
        10: 'exit',
        11: 'player',
        12: 'character',
        13: 'trap',
        14: 'shadow',
        15: 'helper',
        16: 'key',
        17: 'invcontainer',
        18: 'poison',
        19: 'unused1',
        20: 'unused2',
        21: 'ammo',
        22: 'scroll',
        23: 'rangedweapon',
        24: 'unused3',
        25: 'effect',
        26: 'mapscroll'
    };
    static SectorMapFCC = ('M'.charCodeAt(0) << 0) |
        ('A'.charCodeAt(0) << 8) |
        ('P'.charCodeAt(0) << 16) |
        (' '.charCodeAt(0) << 24);
    static MAXOBJECTCLASSES = 64;
    static OBJCLASS_TILE = 9;

    static async loadFile(filePath) {
        try {
            const fs = require('fs').promises;
            const buffer = await fs.readFile(filePath);
            // Convert Buffer to ArrayBuffer
            const arrayBuffer = buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
            );

            return DatParser.parse(arrayBuffer);
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
            const obj = this.readObject(stream, version);
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

    static readBaseObjectData(stream) {
        return {
            name: stream.readString(),
            flags: new ObjectFlags(stream.readUint32()),
            position: {
                x: stream.readInt32(),
                y: stream.readInt32(),
                z: stream.readInt32()
            }
        };
    }

    static readBaseObjectDataAfterPos(stream) {
        return {
            state: stream.readUint16(),
            inventNum: stream.readInt16(),
            inventIndex: stream.readInt16(),
            shadowMapId: stream.readInt32(),
            rotation: {
                x: stream.readUint8(),
                y: stream.readUint8(),
                z: stream.readUint8()
            },
            mapIndex: stream.readInt32()
        };
    }

    static readVelocityData(stream) {
        return {
            velocity: {
                x: stream.readInt32(),
                y: stream.readInt32(),
                z: stream.readInt32()
            }
        };
    }

    static readObjectStats(stream) {
        const numStats = stream.readUint8();
        const stats = [];

        for (let i = 0; i < numStats; i++) {
            stats.push({
                value: stream.readInt32(),
                encryptedId: stream.readUint32()
            });
        }

        return stats;
    }

    static readCharacterData(stream) {
        const complexObjVer = stream.readUint8();
        const charObjVer = stream.readUint8();

        const baseData = this.readBaseObjectData(stream);
        const velocityData = this.readVelocityData(stream);
        const baseDataAfterPos = this.readBaseObjectDataAfterPos(stream);

        return {
            complexObjVer,
            charObjVer,
            ...baseData,
            ...velocityData,
            ...baseDataAfterPos,
            frame: stream.readInt16(),
            frameRate: stream.readInt16(),
            group: stream.readUint8(),
            stats: this.readObjectStats(stream),
            actionCode: stream.readUint8(),
            actionName: stream.readString(),
            timestamps: {
                lastHealth: stream.readUint32(),
                lastFatigue: stream.readUint32(),
                lastMana: stream.readUint32(),
                lastPoison: stream.readUint32()
            },
            teleport: {
                x: stream.readInt32(),
                y: stream.readInt32(),
                z: stream.readInt32(),
                level: stream.readInt32()
            }
        };
    }

    static readObjectData(stream, objClass, dataSize) {
        const startPos = stream.getPos();

        let data;
        switch (objClass) {
            case 12: // character
                data = this.readCharacterData(stream);
                break;
            case 5: // container
                data = {
                    ...this.readBaseObjectData(stream),
                    ...this.readVelocityData(stream),
                    ...this.readBaseObjectDataAfterPos(stream),
                    numItems: stream.readUint32()
                };
                break;
            default:
                data = {
                    ...this.readBaseObjectData(stream),
                    ...this.readBaseObjectDataAfterPos(stream)
                };
        }

        // Ensure we've read exactly dataSize bytes
        const bytesRead = stream.getPos() - startPos;
        if (bytesRead < dataSize) {
            stream.skip(dataSize - bytesRead);
        }

        return data;
    }

    static readObject(stream, version, isMap = true) {
        let uniqueId = 0;
        let objType = -1;
        let blockSize = -1;
        let forcesimple = false;
        let corrupted = false;

        // Get object version
        let objVersion = version >= 8 ? stream.readInt16() : 0;
        if (objVersion < 0) return null;  // Placeholder in map version 8 or above

        // Read object class
        const objClass = stream.readInt16();
        if (objClass < 0) return null;    // Placeholder for empty object slot

        // Handle different version cases
        if (version < 1) {
            // Version 0 - No Unique ID's, read objtype directly
            objType = stream.readInt16();
            uniqueId = 0;
            blockSize = -1;
        }
        else if (version < 4) {
            // Version 1-3 - Unique ID's used instead of objtype
            objType = -1;
            uniqueId = stream.readUint32();
            blockSize = -1;
        }
        else {
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

        // If we got this far, read the object data
        const data = this.readObjectData(stream, objClass, blockSize);

        return {
            version: objVersion,
            class: {
                id: objClass,
                name: this.OBJ_CLASSES[objClass] || 'unknown'
            },
            type: objType,
            uniqueId,
            blockSize,
            corrupted,
            forcesimple,
            data
        };
    }

    static getObjectClass(classId) {
        // For now, just check if it's a valid class ID
        return this.OBJ_CLASSES.hasOwnProperty(classId);
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

class ObjectFlags {
    constructor(value) {
        // Convert number to 32-bit binary string
        const bits = (value >>> 0).toString(2).padStart(32, '0');

        this.of_immobile = !!parseInt(bits[31]);
        this.of_editorlock = !!parseInt(bits[30]);
        this.of_light = !!parseInt(bits[29]);
        this.of_moving = !!parseInt(bits[28]);
        this.of_animating = !!parseInt(bits[27]);
        this.of_ai = !!parseInt(bits[26]);
        this.of_disabled = !!parseInt(bits[25]);
        this.of_invisible = !!parseInt(bits[24]);
        this.of_editor = !!parseInt(bits[23]);
        this.of_foreground = !!parseInt(bits[22]);
        this.of_seldraw = !!parseInt(bits[21]);
        this.of_reveal = !!parseInt(bits[20]);
        this.of_kill = !!parseInt(bits[19]);
        this.of_generated = !!parseInt(bits[18]);
        this.of_animate = !!parseInt(bits[17]);
        this.of_pulse = !!parseInt(bits[16]);
        this.of_weightless = !!parseInt(bits[15]);
        this.of_complex = !!parseInt(bits[14]);
        this.of_notify = !!parseInt(bits[13]);
        this.of_nonmap = !!parseInt(bits[12]);
        this.of_onexit = !!parseInt(bits[11]);
        this.of_pause = !!parseInt(bits[10]);
        this.of_nowalk = !!parseInt(bits[9]);
        this.of_paralize = !!parseInt(bits[8]);
        this.of_nocollision = !!parseInt(bits[7]);
        this.of_iced = !!parseInt(bits[6]);
        this.of_virgin = !!parseInt(bits[5]);
        this.of_loading = !!parseInt(bits[4]);
        this.of_shadow = !!parseInt(bits[3]);
        this.of_background = !!parseInt(bits[2]);
        this.of_inventory = !!parseInt(bits[1]);
        this.of_calledpredel = !!parseInt(bits[0]);
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
