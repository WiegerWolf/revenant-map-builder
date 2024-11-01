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

class CGSResourceParser {
    static RESMAGIC = 0x52534743; // 'CGSR' in little-endian
    static RESVERSION = 1;

    static async loadFile(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            const arrayBuffer = buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
            );
            return CGSResourceParser.parse(arrayBuffer);
        } catch (error) {
            console.error('Error loading CGS resource file:', error);
            return null;
        }
    }

    static parse(arrayBuffer) {
        const stream = new InputStream(arrayBuffer);
        
        // Read FileResHdr according to the C++ structure
        const header = {
            resmagic: stream.readUint32(),    // DWORD resmagic
            topbm: stream.readUint16(),       // WORD topbm
            comptype: stream.readUint8(),     // BYTE comptype
            version: stream.readUint8(),      // BYTE version
            datasize: stream.readUint32(),    // DWORD datasize
            objsize: stream.readUint32(),     // DWORD objsize
            hdrsize: stream.readUint32()      // DWORD hdrsize
        };
    
        // Add compression type constants
        const COMP_NONE = 0;  // No Compression
        const COMP_ZIP = 1;   // ZIP implode compression
    
        // Validate magic number and version
        if (header.resmagic !== this.RESMAGIC) {
            throw new Error('Not a valid CGS resource file');
        }
    
        if (header.version < this.RESVERSION) {
            throw new Error('Resource file version too old');
        }
    
        // Skip header data if present
        if (header.hdrsize > 0) {
            stream.skip(header.hdrsize);
        }
    
        // Read bitmap table if present
        const bitmapTable = [];
        if (header.topbm > 0) {
            for (let i = 0; i < header.topbm; i++) {
                bitmapTable.push(stream.readUint32());
            }
        }
    
        // Read bitmaps
        const bitmaps = [];
        for (const offset of bitmapTable) {
            stream.setPos(offset);
            const bitmap = this.readBitmap(stream);
            bitmaps.push(bitmap);
        }
    
        return {
            header,
            bitmapTable,
            bitmaps
        };
    }
    

    static readBitmap(stream) {
        const bitmap = {
            width: stream.readUint16(),
            height: stream.readUint16(),
            flags: stream.readUint16(),
            hotx: stream.readInt16(),
            hoty: stream.readInt16(),
            transparent: stream.readUint16(),
            compression: stream.readUint16(),
            bytewidth: stream.readUint16(),
            bpp: stream.readUint16(),
            palette: null,
            data: null
        };

        // Sanity check
        if (bitmap.width > 8192 || bitmap.height > 8192) {
            throw new Error('Corrupted bitmap dimensions');
        }

        // Read palette if 8-bit
        if (bitmap.flags & 0x0001) { // BM_8BIT
            bitmap.palette = new Array(256);
            for (let i = 0; i < 256; i++) {
                bitmap.palette[i] = {
                    r: stream.readUint8(),
                    g: stream.readUint8(),
                    b: stream.readUint8(),
                    a: stream.readUint8()
                };
            }
        }

        // Calculate data size and read bitmap data
        let dataSize;
        if (bitmap.flags & 0x0001) { // 8-bit
            dataSize = bitmap.width * bitmap.height;
        } else if (bitmap.flags & 0x0002) { // 15-bit
            dataSize = bitmap.width * bitmap.height * 2;
        } else { // 16-bit
            dataSize = bitmap.width * bitmap.height * 2;
        }

        // Read raw bitmap data
        bitmap.data = new Uint8Array(arrayBuffer, stream.getPos(), dataSize);
        
        // Convert 15-bit to 16-bit if necessary
        if (bitmap.flags & 0x0002) { // BM_15BIT
            this.convert15to16(bitmap);
        }

        // Convert palette from 15-bit to 16-bit if necessary
        if (bitmap.flags & 0x0001 && bitmap.flags & 0x0002) { // BM_8BIT && BM_15BIT
            this.convertPal15to16(bitmap);
        }

        return bitmap;
    }

    static convert15to16(bitmap) {
        // Convert 15-bit color to 16-bit color
        const data = new Uint16Array(bitmap.data.buffer);
        for (let i = 0; i < data.length; i++) {
            const color15 = data[i];
            const r = (color15 & 0x7C00) >> 10;
            const g = (color15 & 0x03E0) >> 5;
            const b = color15 & 0x001F;
            data[i] = (r << 11) | (g << 6) | b;
        }
        bitmap.flags &= ~0x0002; // Clear BM_15BIT flag
    }

    static convertPal15to16(bitmap) {
        // Convert palette entries from 15-bit to 16-bit color
        for (let i = 0; i < bitmap.palette.length; i++) {
            const color15 = bitmap.palette[i];
            const r = (color15.r & 0x7C00) >> 10;
            const g = (color15.g & 0x03E0) >> 5;
            const b = color15.b & 0x001F;
            bitmap.palette[i] = {
                r: (r << 11),
                g: (g << 6),
                b: b,
                a: color15.a
            };
        }
    }

    // Helper function to convert bitmap to canvas
    static bitmapToCanvas(bitmap) {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(bitmap.width, bitmap.height);

        if (bitmap.flags & 0x0001) { // 8-bit palettized
            for (let i = 0; i < bitmap.data.length; i++) {
                const paletteIndex = bitmap.data[i];
                const color = bitmap.palette[paletteIndex];
                imageData.data[i * 4] = color.r;
                imageData.data[i * 4 + 1] = color.g;
                imageData.data[i * 4 + 2] = color.b;
                imageData.data[i * 4 + 3] = color.a;
            }
        } else { // 16-bit
            const data = new Uint16Array(bitmap.data.buffer);
            for (let i = 0; i < data.length; i++) {
                const color = data[i];
                const r = ((color & 0xF800) >> 11) << 3;
                const g = ((color & 0x07E0) >> 5) << 2;
                const b = (color & 0x001F) << 3;
                imageData.data[i * 4] = r;
                imageData.data[i * 4 + 1] = g;
                imageData.data[i * 4 + 2] = b;
                imageData.data[i * 4 + 3] = 255;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        return canvas;
    }
}

class ClassDefParser {
    static async loadFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return ClassDefParser.parse(content);
        } catch (error) {
            console.error('Error loading class definition file:', error);
            return null;
        }
    }

    static parse(content) {
        const result = {
            uniqueTypeId: null,
            classes: new Map()
        };
        
        let currentClass = null;
        let currentSection = null;
        let inStats = false;
        let inObjStats = false;

        const lines = content.split('\n');
        
        for (let line of lines) {
            line = line.trim();
            
            if (line === '' || line.startsWith('//')) continue;

            if (line.startsWith('Unique Type ID')) {
                result.uniqueTypeId = parseInt(line.split('=')[1].trim(), 16);
                continue;
            }

            if (line.startsWith('CLASS')) {
                currentClass = {
                    className: line.split('"')[1],
                    stats: [],        // Changed to array to maintain order
                    objStats: [],     // Changed to array to maintain order
                    types: []
                };
                result.classes.set(currentClass.className, currentClass);
                currentSection = null;
                inStats = false;
                inObjStats = false;
                continue;
            }

            if (!currentClass) continue;

            if (line === 'STATS') {
                currentSection = 'stats';
                inStats = false;
                continue;
            } else if (line === 'OBJSTATS') {
                currentSection = 'objStats';
                inObjStats = false;
                continue;
            } else if (line === 'TYPES') {
                currentSection = 'types';
                continue;
            }

            if (line === 'BEGIN') {
                if (currentSection === 'stats') inStats = true;
                if (currentSection === 'objStats') inObjStats = true;
                continue;
            }
            if (line === 'END') {
                inStats = false;
                inObjStats = false;
                continue;
            }

            if (inStats && currentSection === 'stats') {
                const parts = line.split(' ').filter(part => part !== '');
                if (parts.length >= 5) {
                    currentClass.stats.push({
                        name: parts[0],
                        id: parts[1],
                        default: parseInt(parts[2]),
                        min: parseInt(parts[3]),
                        max: parseInt(parts[4])
                    });
                }
            } else if (inObjStats && currentSection === 'objStats') {
                const parts = line.split(' ').filter(part => part !== '');
                if (parts.length >= 5) {
                    currentClass.objStats.push({
                        name: parts[0],
                        id: parts[1],
                        default: parseInt(parts[2]),
                        min: parseInt(parts[3]),
                        max: parseInt(parts[4])
                    });
                }
            } else if (currentSection === 'types') {
                const match = line.match(/"([^"]+)"\s+"([^"]+)"\s+(0x[0-9a-fA-F]+)\s+{([^}]+)}\s*{([^}]*)}/)
                if (match) {
                    const values = match[4].split(',').map(v => parseInt(v.trim()));
                    const extra = match[5] ? match[5].split(',').map(v => v.trim()) : [];
                    
                    // Create mapped stats object
                    const mappedStats = {};
                    currentClass.stats.forEach((stat, index) => {
                        if (index < values.length) {
                            mappedStats[stat.name] = {
                                value: values[index],
                                ...stat
                            };
                        }
                    });

                    // Create mapped objStats object if they exist
                    const mappedObjStats = {};
                    if (currentClass.objStats.length > 0 && extra.length > 0) {
                        currentClass.objStats.forEach((stat, index) => {
                            if (index < extra.length) {
                                mappedObjStats[stat.name] = {
                                    value: parseInt(extra[index]) || extra[index],
                                    ...stat
                                };
                            }
                        });
                    }

                    currentClass.types.push({
                        name: match[1],
                        model: match[2],
                        id: parseInt(match[3], 16),
                        stats: mappedStats,
                        objStats: mappedObjStats
                    });
                }
            }
        }

        return result;
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

    // Add static property for game directory
    static gameDir = '';

    // Modify the main loading function to accept gameDir
    static async loadFile(filePath, gameDir) {
        this.gameDir = gameDir; // Store gameDir for resource loading
        try {
            const buffer = await fs.readFile(filePath);
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

    static classDefs = new Map();

    static async loadClassDefinitions(gameDir) {
        const classDefPath = path.join(gameDir, 'Resources', 'class.def');
        try {
            const classDefs = await ClassDefParser.loadFile(classDefPath);
            if (classDefs) {
                this.classDefs = classDefs;
            }
        } catch (error) {
            console.error('Error loading class definitions:', error);
        }
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


        // After determining objClass and uniqueId
        const typeInfo = this.getTypeInfo(uniqueId, objClass);
        
        // If we have type info and it has a model path, load the resource
        if (typeInfo && typeInfo.model) {
            // Store the resource loading promise
            typeInfo.resourcePromise = this.loadResourceFile(this.gameDir, typeInfo.model);
        }

        const data = this.readObjectData(stream, objClass, blockSize);

        return {
            version: objVersion,
            class: {
                id: objClass,
                name: this.OBJ_CLASSES[objClass] || 'unknown'
            },
            type: objType,
            typeInfo,
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
        // Get class name from classId
        const className = this.OBJ_CLASSES[classId];
        if (!className) return -1;

        // Get class definition from our loaded class definitions
        const classDefs = this.classDefs.classes;
        const classDef = classDefs.get(className.toUpperCase());
        if (!classDef) return -1;

        // Find the type with matching uniqueId
        const typeIndex = classDef.types.findIndex(t => t.id === uniqueId);
        if (typeIndex !== -1) {
            return typeIndex;
        }

        // If not found in the expected class, optionally search all classes
        for (const [otherClassName, otherClassDef] of classDefs) {
            if (otherClassName !== className.toUpperCase()) {
                const index = otherClassDef.types.findIndex(t => t.id === uniqueId);
                if (index !== -1) {
                    console.warn(`Found object type ${uniqueId.toString(16)} in class ${otherClassName} instead of ${className}`);
                    return index;
                }
            }
        }

        return -1;
    }

    // Add a helper method to get type information
    static getTypeInfo(uniqueId, classId) {
        const className = this.OBJ_CLASSES[classId];
        if (!className) return null;

        const classDefs = this.classDefs.classes;
        const classDef = classDefs.get(className.toUpperCase());
        if (!classDef) return null;

        return classDef.types.find(t => t.id === uniqueId) || null;
    }

    static fileCache = new Map(); // Cache for file paths

    static async buildFileCache(baseDir) {
        const cache = new Map();
        
        async function scanDirectory(dir) {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.relative(baseDir, fullPath).toLowerCase();
                
                if (entry.isDirectory()) {
                    await scanDirectory(fullPath);
                } else {
                    cache.set(relativePath, fullPath);
                }
            }
        }

        await scanDirectory(baseDir);
        return cache;
    }

    static async findRealPath(baseDir, searchPath) {
        // Normalize the search path
        const normalizedSearch = searchPath.toLowerCase().replace(/\\/g, path.sep);

        // Initialize cache if needed
        if (this.fileCache.size === 0) {
            this.fileCache = await this.buildFileCache(baseDir);
        }

        // Look up the real path in the cache
        const realPath = this.fileCache.get(normalizedSearch);
        if (realPath) {
            return realPath;
        }

        return null;
    }

    static async loadResourceFile(gameDir, resourcePath) {
        try {
            const resourcesDir = path.join(gameDir, 'Resources');
            
            // Prepend 'Imagery' to the resource path
            const imageryPath = path.join('Imagery', resourcePath);
            
            const realPath = await this.findRealPath(resourcesDir, imageryPath);
            
            if (!realPath) {
                console.warn(`Resource file not found: ${resourcePath}`);
                return null;
            }

            const resource = await CGSResourceParser.loadFile(realPath);
            debugger;
            return resource;
        } catch (error) {
            console.error(`Error loading resource file ${resourcePath}:`, error);
            return null;
        }
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
    const gameDir = path.join('_INSTALLED_GAME', 'Revenant');
    const mapDir = path.join(gameDir, 'Modules', 'Ahkuilon', 'Map');
    const resourcesDir = path.join(gameDir, 'Resources');

    try {
        // Build the file cache first
        console.log('Building file cache...');
        await DatParser.buildFileCache(resourcesDir);
        
        // Then proceed with the rest of the processing
        await DatParser.loadClassDefinitions(gameDir);

        const files = await fs.readdir(mapDir);
        const datFiles = files.filter(file => file.toLowerCase().endsWith('.dat'));

        for (const datFile of datFiles) {
            const filePath = path.join(mapDir, datFile);
            console.log(`Processing ${datFile}...`);

            const result = await DatParser.loadFile(filePath, gameDir);
            if (result && result.numObjects) {
                console.log(`File: ${datFile}`);
                console.log('Version:', result.version);
                console.log('Number of objects:', result.numObjects);
                
                // Process each object's resource
                for (const obj of result.objects) {
                    if (obj.typeInfo && obj.typeInfo.resourcePromise) {
                        const resource = await obj.typeInfo.resourcePromise;
                        // The debugger will break in loadResourceFile when resources are loaded
                    }
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
