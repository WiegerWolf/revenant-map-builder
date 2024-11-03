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

class ImageryDatParser {
    static QUICKLOAD_FILE_ID = ('H'.charCodeAt(0)) |
        ('D'.charCodeAt(0) << 8) |
        ('R'.charCodeAt(0) << 16) |
        ('S'.charCodeAt(0) << 24);
    static QUICKLOAD_FILE_VERSION = 1;
    static MAX_IMAGERY_FILENAME_LENGTH = 80; // MAXIMFNAMELEN
    static MAXANIMNAME = 32;

    static async loadFile(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            const arrayBuffer = buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
            );
            return ImageryDatParser.parse(arrayBuffer);
        } catch (error) {
            console.error('Error loading IMAGERY.DAT file:', error);
            debugger;
            return null;
        }
    }

    static parse(arrayBuffer) {
        const stream = new InputStream(arrayBuffer);

        // Read QuickLoad Header
        const header = {
            id: stream.readUint32(),
            version: stream.readUint32(),
            numHeaders: stream.readUint32()
        };

        // Validate header
        if (header.id !== this.QUICKLOAD_FILE_ID) {
            throw new Error('Invalid IMAGERY.DAT file ID');
        }

        if (header.version !== this.QUICKLOAD_FILE_VERSION) {
            throw new Error('Unsupported IMAGERY.DAT version');
        }

        // Read imagery entries
        const entries = [];
        for (let i = 0; i < header.numHeaders; i++) {
            // Read filename (fixed-length buffer)
            const filenameBytes = new Uint8Array(arrayBuffer, stream.getPos(), this.MAX_IMAGERY_FILENAME_LENGTH);
            stream.skip(this.MAX_IMAGERY_FILENAME_LENGTH);

            // Convert to string until first null terminator
            let filename = '';
            for (let j = 0; j < filenameBytes.length; j++) {
                if (filenameBytes[j] === 0) break;
                filename += String.fromCharCode(filenameBytes[j]);
            }

            // Read header size
            const headerSize = stream.readUint32();

            // Read imagery header
            const imageryHeader = this.parseImageryHeader(stream, headerSize, arrayBuffer);

            entries.push({
                filename,
                headerSize,
                header: imageryHeader
            });
        }

        return {
            header,
            entries
        };
    }

    static parseImageryHeader(stream, headerSize, arrayBuffer) {
        const startPos = stream.getPos();

        const header = {
            imageryId: stream.readInt32(),    // Id number for imagery handler (index to builder array)
            numStates: stream.readInt32(),    // Number of states
            states: []
        };

        // Read state headers
        for (let i = 0; i < header.numStates; i++) {
            // Read animation name first
            const animNameBytes = new Uint8Array(arrayBuffer, stream.getPos(), this.MAXANIMNAME);
            stream.skip(this.MAXANIMNAME);

            let animName = '';
            for (let j = 0; j < animNameBytes.length; j++) {
                if (animNameBytes[j] === 0) break;
                animName += String.fromCharCode(animNameBytes[j]);
            }

            const state = {
                animName,                    // Array of Ascii Names
                walkMap: stream.readUint32(), // Walkmap (OFFSET type)
                flags: stream.readUint32(),   // Imagery state flags (DWORD)
                aniFlags: stream.readInt16(), // Animation state flags (short)
                frames: stream.readInt16(),   // Number of frames (short)
                width: stream.readInt16(),    // Graphics maximum width (short)
                height: stream.readInt16(),   // Graphics maximum height (short)
                regX: stream.readInt16(),     // Registration point x for graphics (short)
                regY: stream.readInt16(),     // Registration point y for graphics (short)
                regZ: stream.readInt16(),     // Registration point z for graphics (short)
                animRegX: stream.readInt16(), // Registration point of animation x (short)
                animRegY: stream.readInt16(), // Registration point of animation y (short)
                animRegZ: stream.readInt16(), // Registration point of animation z (short)
                wRegX: stream.readInt16(),    // World registration x of walk and bounding box (short)
                wRegY: stream.readInt16(),    // World registration y of walk and bounding box (short)
                wRegZ: stream.readInt16(),    // World registration z of walk and bounding box (short)
                wWidth: stream.readInt16(),   // Object's world width for walk map and bound box (short)
                wLength: stream.readInt16(),  // Object's world length for walk map and bound box (short)
                wHeight: stream.readInt16(),  // Object's world height for walk map and bound box (short)
                invAniFlags: stream.readInt16(), // Animation flags for inventory animation (short)
                invFrames: stream.readInt16()    // Number of frames of inventory animation (short)
            };

            header.states.push(state);
        }

        // Ensure we've read exactly headerSize bytes
        const bytesRead = stream.getPos() - startPos;
        if (bytesRead < headerSize) {
            stream.skip(headerSize - bytesRead);
        }

        return header;
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
            debugger;
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

        if (header.version > this.RESVERSION) {
            throw new Error('Resource file version too new');
        }

        // Skip over header data if present (hdrsize + sizeof(FileResHdr))
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

        // Read the entire resource data first, like the C++ code does
        const resourceData = new Uint8Array(arrayBuffer, stream.getPos(), header.datasize);

        // Create the final result buffer
        const resultBuffer = new Uint8Array(header.objsize);
        resultBuffer.set(resourceData);

        // Read bitmaps using offsets into the resultBuffer
        const bitmaps = [];
        for (const offset of bitmapTable) {
            // Create a new stream starting at the bitmap offset in the result buffer
            const bitmapStream = new InputStream(resultBuffer.buffer);
            bitmapStream.setPos(offset);
            const bitmap = this.readBitmap(bitmapStream, resultBuffer.buffer);
            bitmaps.push(bitmap);
        }

        return {
            header,
            bitmapTable,
            bitmaps,
            data: resultBuffer
        };

    }

    static readBitmap(stream, arrayBuffer) {
        // Match exact TBitmapData structure from bitmapdata.h
        const bitmap = {
            width: stream.readInt16(),       // int width
            height: stream.readInt16(),      // int height
            regx: stream.readInt16(),        // int regx (registration point x)
            regy: stream.readInt16(),        // int regy (registration point y)
            flags: stream.readUint32(),      // DWORD flags
            drawmode: stream.readUint32(),   // DWORD drawmode (default drawing mode)
            keycolor: stream.readUint32(),   // DWORD keycolor (transparent color)
            aliassize: stream.readUint32(),  // DWORD aliassize
            alias: stream.readUint32(),      // OFFSET alias (relative offset to alias data)
            alphasize: stream.readUint32(),  // DWORD alphasize
            alpha: stream.readUint32(),      // OFFSET alpha
            zbuffersize: stream.readUint32(),// DWORD zbuffersize
            zbuffer: stream.readUint32(),    // OFFSET zbuffer
            normalsize: stream.readUint32(), // DWORD normalsize
            normal: stream.readUint32(),     // OFFSET normal
            palettesize: stream.readUint32(),// DWORD palettesize
            palette: null,                   // Will hold SPalette structure if BM_8BIT
            datasize: stream.readUint32(),   // DWORD datasize
            data: null                       // Will hold actual bitmap data
        };

        // Bitmap flags from the original code
        const BM_8BIT = 0x0001;
        const BM_15BIT = 0x0002;

        // Sanity check matching the C++ code
        if (bitmap.width > 8192 || bitmap.height > 8192) {
            throw new Error('Corrupted bitmap dimensions');
        }

        // Read palette if 8-bit (BM_8BIT flag)
        if (bitmap.flags & BM_8BIT) {
            // Match SPalette structure from the C++ code
            bitmap.palette = new Array(256);
            for (let i = 0; i < 256; i++) {
                bitmap.palette[i] = {
                    color: stream.readUint16(),    // WORD colors[256]
                    rgbcolor: stream.readUint32()  // DWORD rgbcolors[256]
                };
            }
        }

        // Calculate data size based on bitmap format
        let dataSize;
        if (bitmap.flags & BM_8BIT) {
            dataSize = bitmap.width * bitmap.height;       // 8-bit = 1 byte per pixel
        } else {
            dataSize = bitmap.width * bitmap.height * 2;   // 15/16-bit = 2 bytes per pixel
        }

        // Read raw bitmap data
        const dataOffset = stream.getPos();
        bitmap.data = new Uint8Array(arrayBuffer, dataOffset, dataSize);
        stream.skip(dataSize);

        // Convert 15-bit to 16-bit if necessary (matching C++ Convert15to16)
        if (bitmap.flags & BM_15BIT) {
            this.convert15to16(bitmap);
        }

        // Convert palette from 15-bit to 16-bit if necessary
        if ((bitmap.flags & BM_8BIT) && (bitmap.flags & BM_15BIT)) {
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
            debugger;
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
    static SectorMapFCC = ('M'.charCodeAt(0) << 0) |
        ('A'.charCodeAt(0) << 8) |
        ('P'.charCodeAt(0) << 16) |
        (' '.charCodeAt(0) << 24);
    static MAXOBJECTCLASSES = 64;
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
            debugger;
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
            console.log(`Loading object ${i + 1} of ${numObjects}`);
            const obj = this.loadObject(stream, version);
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
            debugger;
        }
    }

    static loadObject(stream, version, isMap = true) {
        let uniqueId;
        let objVersion = 0;
        let objClass;
        let objType;
        let blockSize;
        let def = {};
        let forcesimple = false;
        let corrupted = false;

        // ****** Load object block header ******

        // Get object version
        if (version >= 8) {
            objVersion = stream.readInt16();
        }

        if (objVersion < 0) { // Objversion is the placeholder in map version 8 or above
            return null;
        }

        objClass = stream.readInt16();
        if (objClass < 0) {   // Placeholder for empty object slot
            return null;
        }

        // Check the sector map version before we read the type info
        if (version < 1) {
            // Version 0 - No Unique ID's, so just read the objtype directly
            objType = stream.readInt16();
            uniqueId = 0;
            blockSize = -1;
        }
        else if (version < 4) {
            // Version 1 and above - Unique ID's used instead of objtype
            objType = -1;
            uniqueId = stream.readUint32();
            blockSize = -1;
        }
        else {
            // Version 4 has block size
            objType = -1;
            uniqueId = stream.readUint32();
            blockSize = stream.readInt16();
        }

        // ****** Is this object any good? ******

        const cl = this.getObjectClass(objClass);
        if (!cl) {
            if (this.Debug) {
                throw new Error("Object in map file has invalid class - possible file corruption");
            }
            else if (blockSize >= 0) {
                stream.skip(blockSize);  // Just quietly skip this object
                return null;
            }
            else {                      // Try to fix it by assuming its a tile
                objClass = this.OBJCLASS_TILE;
                corrupted = true;
            }
        }

        if (objType < 0) {
            objType = this.findObjectType(uniqueId, objClass);

            if (objType < 0) {
                // not found in this class, so check all of them
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

            if (objType < 0) {  // Still can't find type
                if (this.Debug) {
                    throw new Error(`Object unique id 0x${uniqueId.toString(16)} not found in class.def`);
                }
                else if (blockSize >= 0) {    // Just skip over this object
                    stream.skip(blockSize);
                    return null;
                }
                else {      // If attempting to fix, assume type is type 0
                    objType = 0;
                    corrupted = true;
                }
            }
        }

        // ****** Create the object ******

        def.objClass = objClass;
        def.objType = objType;

        // Get start of object
        const startPos = stream.getPos();
        const typeInfo = this.getTypeInfo(uniqueId, objClass)
        // Load object data
        const objectData = forcesimple ?
            this.loadBaseObjectData(stream, version, objVersion) :  // Used if object changed class
            this.loadObjectData(stream, version, objVersion, typeInfo, this.OBJ_CLASSES[objClass]);       // This should normally be used

        const inventory = this.loadInventory(stream, version);

        // Reset position to start of next object
        if (blockSize >= 0) {
            stream.setPos(startPos + blockSize);
        }

        // If this object is corrupted in some way, return null
        if (corrupted || (isMap && this.hasNonMapFlag(objectData))) {
            return null;
        }

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
            data: objectData,
            inventory
        };
    }

    static loadBaseObjectData(stream, version, objVersion) {
        // Read name (length-prefixed string)
        const name = stream.readString();

        // Note: we might need to adjust the flags handling since we're using ObjectFlags class
        // For now, let's store both raw value and parsed flags
        const flagsRaw = stream.readUint32();
        const flags = new ObjectFlags(flagsRaw);

        const position = {
            x: stream.readInt32(),
            y: stream.readInt32(),
            z: stream.readInt32()
        };

        // Read velocity if mobile and version < 6
        let velocity = { x: 0, y: 0, z: 0 };
        if (version < 6 || !flags.of_immobile) {
            velocity = {
                x: stream.readInt32(),
                y: stream.readInt32(),
                z: stream.readInt32()
            };
        }

        // Read state
        let state;
        if (version < 9) {
            state = stream.readUint8();
        } else {
            state = stream.readUint16();
        }

        // Handle level for non-map objects
        let level = 0;
        if (version >= 6 && flags.of_nonmap) {
            if (version < 9) {
                level = stream.readUint8();
            } else {
                level = stream.readUint16();
            }
        }

        // Handle health for old versions
        let health;
        if (version < 5) {
            health = stream.readUint8();
        }

        // Read inventory and rotation data
        let inventNum, invIndex, shadow, rotateX, rotateY, rotateZ, mapIndex;
        if (version < 3) {
            const facing = stream.readUint8();
            const dummy16 = stream.readInt16();
            inventNum = stream.readInt16();
            const dummy16_2 = stream.readInt16();
            shadow = stream.readInt32();
            const dummy8 = stream.readUint8();

            // ignore inventories in old version
            inventNum = -1;
            mapIndex = -1;
        } else {
            inventNum = stream.readInt16();
            invIndex = stream.readInt16();
            shadow = stream.readInt32();
            rotateX = stream.readUint8();
            rotateY = stream.readUint8();
            rotateZ = stream.readUint8();
            mapIndex = stream.readInt32();
        }

        // Handle animation and stats
        let frame = 0;
        let frameRate = 1;
        let group = 0;
        let stats = [];

        if (version < 5) {
            // Set up empty stat array and stick health in it
            if (this.getNumObjStats() > 0) {
                stats = new Array(this.getNumObjStats()).fill(0);
                this.setHealth(health, stats);
            }
        } else {
            if (version >= 6) {
                if (flags.of_animate) {
                    frame = stream.readInt16();
                    frameRate = stream.readInt16();
                }
            } else {
                frame = stream.readInt16();
                frameRate = stream.readInt16();
            }

            group = stream.readUint8();

            // Read stats
            const numStats = stream.readUint8();
            if (numStats > 0) {
                stats = [];
                for (let st = 0; st < numStats; st++) {
                    const stat = stream.readInt32();
                    const uniqueId = stream.readUint32();
                    stats.push({ stat, uniqueId });
                }
            }
        }

        // Read light data if present
        let lightDef = null;
        if (flags.of_light) {
            lightDef = new SLightDef();

            // Read flags
            const lightFlags = stream.readUint8();
            lightDef.flags = new LightFlags(lightFlags);

            // Read position
            lightDef.pos = new S3DPoint(
                stream.readInt32(),  // x
                stream.readInt32(),  // y
                stream.readInt32()   // z
            );

            // Read color
            lightDef.color = new SColor(
                stream.readUint8(),  // red
                stream.readUint8(),  // green
                stream.readUint8()   // blue
            );

            // Read intensity and multiplier
            lightDef.intensity = stream.readUint8();
            lightDef.multiplier = stream.readInt16();

            // Set the light and animate flags using our ObjectFlags properties
            flags.of_light = true;
            flags.of_animate = true;
        }


        return {
            name,
            flags,         // This will be the ObjectFlags instance
            flagsRaw,     // This is the raw uint32 value
            position,
            velocity,
            state,
            level,
            inventNum,
            invIndex,
            shadow,
            rotation: {
                x: rotateX,
                y: rotateY,
                z: rotateZ
            },
            mapIndex,
            frame,
            frameRate,
            group,
            stats,
            lightDef
        };
    }

    static getNumObjStats() {
        // Implement this method to return the number of object stats
        return 0;
    }

    static setHealth(health, stats) {
        // Implement this method to set health in stats array
        if (stats.length > 0) {
            stats[0] = health;
        }
    }

    static Debug = false; // Add this class property

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
            return resource;
        } catch (error) {
            console.error(`Error loading resource file ${resourcePath}:`, error);
            debugger;
            return null;
        }
    }

    static loadObjectData(stream, version, objVersion, typeInfo, objClassName) {
        switch (objClassName.toLowerCase()) {
            case 'tile':
                return this.loadTileData(stream, version, objVersion);
            case 'exit':
                return this.loadExitData(stream, version, objVersion);
            case 'container':
                return this.loadContainerData(stream, version, objVersion);
            case 'complexobject':
                return this.loadComplexObjectData(stream, version, objVersion);
            default:
                console.warn(`Unknown object class: ${objClassName}`);
                debugger;
                return {};
        }
    }

    static loadComplexObjectData(stream, version, objVersion) {
        let baseData;

        // Load base object data based on version
        if (objVersion >= 1) {
            baseData = this.loadBaseObjectData(stream, version, objVersion);
        } else {
            baseData = this.loadBaseObjectData(stream, version, 0);
        }

        // Load root state
        let actionBlock;
        if (version < 7) {
            actionBlock = new ActionBlock("still"); // DefaultRootState
        } else {
            const action = stream.readUint8();

            // Read fixed-length name (RESNAMELEN)
            const nameBytes = new Uint8Array(stream.dataView.buffer, stream.dataView.byteOffset + stream.offset, RESNAMELEN);
            stream.skip(RESNAMELEN);

            let name = '';
            for (let i = 0; i < nameBytes.length; i++) {
                if (nameBytes[i] === 0) break;
                name += String.fromCharCode(nameBytes[i]);
            }

            actionBlock = new ActionBlock(name, action);
        }

        return {
            ...baseData,
            className: 'complexobject',
            root: actionBlock,
            doing: actionBlock,
            desired: actionBlock,
            state: -1
        };
    }

    static loadTileData(stream, version, objVersion) {
        return this.loadBaseObjectData(stream, version, objVersion);
    }

    static loadContainerData(stream, version, objVersion) {
        // Load base object data first
        const baseData = this.loadBaseObjectData(stream, version, objVersion);

        // Handle container-specific data for versions 2-4
        if (version >= 2 && version < 5) {
            const contflags = stream.readInt32();
            const pickdifficulty = stream.readInt32();

            baseData.stats = baseData.stats || [];
            baseData.stats.push(
                { name: "Locked", value: contflags !== 0 },
                { name: "PickDifficulty", value: pickdifficulty }
            );
        }

        return baseData;
    }

    static loadExitData(stream, version, objVersion) {
        // Load container data first (which includes base object data)
        const containerData = this.loadContainerData(stream, version, objVersion);

        // Load TExit specific data
        const exitflags = stream.readUint32();

        return {
            ...containerData,
            exitflags,
            className: 'exit',
            isOn: () => !!(exitflags & ExitFlags.EX_ON),
            isActivated: () => !!(exitflags & ExitFlags.EX_ACTIVATED),
            isFromExit: () => !!(exitflags & ExitFlags.EX_FROMEXIT)
        };
    }

    static loadInventory(stream, version) {
        // Early return for versions < 3
        if (version < 3) {
            return [];
        }

        // Read number of inventory items
        const num = stream.readInt32();

        // Sanity check for inventory size
        if (num > 2048) {
            console.warn("Invalid inventory size:", num);
            debugger;
            return [];
        }

        // Array to store inventory items
        const inventory = [];

        // Load each inventory object
        for (let i = 0; i < num; i++) {
            debugger; // code is not tested below. investigate if we ever end up here, espesially that recursive load object call
            try {
                const inst = this.loadObject(stream, version);
                if (inst) {
                    // In the C++ version, inst->SetOwner(this) is called
                    // We might need to implement something similar depending on our needs
                    inst.owner = this; // or however we handle ownership
                    inventory.push(inst);
                } else {
                    console.warn("Invalid inventory object loaded");
                }
            } catch (error) {
                console.warn("Error loading inventory object:", error);
                // Continue loading other items even if one fails
            }
        }

        return inventory;
    }

    static hasNonMapFlag(objectData) {
        // Implement flag checking logic here
        return false;
    }
}

// Exit states
const ExitStates = {
    EXIT_CLOSED: 0,
    EXIT_OPEN: 1,
    EXIT_CLOSING: 2,
    EXIT_OPENING: 3
};

// Exit flags
const ExitFlags = {
    EX_ON: 1 << 0,        // player is on exit strip
    EX_ACTIVATED: 1 << 1,  // exit has been activated
    EX_FROMEXIT: 1 << 2   // player just came from another exit.. don't do anything
};

class ExitRef {
    constructor() {
        this.name = '';           // name of exit
        this.target = null;       // position on level (S3DPoint)
        this.level = 0;          // level to change to
        this.mapindex = 0;       // object character is transfered to (usually another exit)
        this.ambient = 0;        // level of ambient light
        this.ambcolor = null;    // color of ambient light (SColor)
        this.next = null;        // next in list
    }
}

const RESNAMELEN = 32;

const ActionTypes = {
    ACTION_NONE: 0,
    ACTION_ANIMATE: 1,
    ACTION_MOVE: 2,
    ACTION_COMBAT: 3,
    ACTION_COMBATMOVE: 4,
    ACTION_COMBATLEAP: 5,
    ACTION_COLLAPSE: 6,
    ACTION_ATTACK: 7,
    ACTION_BLOCK: 8,
    ACTION_DODGE: 9,
    ACTION_MISS: 10,
    ACTION_INVOKE: 11,
    ACTION_IMPACT: 12,
    ACTION_STUN: 13,
    ACTION_KNOCKDOWN: 14,
    ACTION_FLYBACK: 15,
    ACTION_SAY: 16,
    ACTION_PIVOT: 17,
    ACTION_PULL: 18,
    ACTION_DEAD: 19,
    ACTION_PULP: 20,
    ACTION_BURN: 21,
    ACTION_FLAIL: 22,
    ACTION_SLEEP: 23,
    ACTION_LEAP: 24,
    ACTION_BOW: 25,
    ACTION_BOWMOVE: 26,
    ACTION_BOWAIM: 27,
    ACTION_BOWSHOOT: 28
};

class ActionBlock {
    constructor(name, action = ActionTypes.ACTION_ANIMATE) {
        this.action = action;
        this.name = name;
        this.frame = 0;
        this.wait = 0;
        this.angle = 0;
        this.moveangle = 0;
        this.turnrate = 0;
        this.target = null;  // S3DPoint
        this.obj = null;     // ObjectInstance reference
        this.attack = null;
        this.impact = null;
        this.damage = 0;
        this.data = null;
        this.flags = 0;
    }
}

// Light flags
class LightFlags {
    static LIGHT_DIR = 1 << 0;  // Directional light
    static LIGHT_SUN = 1 << 1;  // Sunlight
    static LIGHT_MOON = 1 << 2; // Moonlight

    constructor(value) {
        this.isDirectional = !!(value & LightFlags.LIGHT_DIR);
        this.isSunlight = !!(value & LightFlags.LIGHT_SUN);
        this.isMoonlight = !!(value & LightFlags.LIGHT_MOON);
    }
}

class S3DPoint {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(other) {
        return new S3DPoint(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z
        );
    }

    subtract(other) {
        return new S3DPoint(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z
        );
    }

    multiply(scalar) {
        return new S3DPoint(
            this.x * scalar,
            this.y * scalar,
            this.z * scalar
        );
    }

    inRange(pos, dist) {
        const absX = Math.abs(this.x - pos.x);
        const absY = Math.abs(this.y - pos.y);
        return absY <= dist &&
            absX <= dist &&
            (Math.pow(absY, 2) + Math.pow(absX, 2) <= Math.pow(dist, 2) * 2);
    }

    inRange3D(pos, dist) {
        const absX = Math.abs(this.x - pos.x);
        const absY = Math.abs(this.y - pos.y);
        const absZ = Math.abs(this.z - pos.z);
        return absY <= dist &&
            absX <= dist &&
            absZ <= dist &&
            (Math.pow(absY, 2) + Math.pow(absX, 2) + Math.pow(absZ, 2) <= Math.pow(dist, 2) * 3);
    }
}

class SColor {
    constructor(red = 0, green = 0, blue = 0) {
        this.red = red;
        this.green = green;
        this.blue = blue;
    }
}

class SLightDef {
    constructor() {
        this.flags = new LightFlags(0);    // LIGHT_x
        this.multiplier = 0;               // Multiplier
        this.pos = new S3DPoint();         // Position of light
        this.color = new SColor();         // RGB Color of light 
        this.intensity = 0;                // Intensity of light
        this.lightindex = 0;               // Light index for 3d system
        this.lightid = 0;                  // Light id for dls system
    }
}

class ObjectFlags {
    constructor(value) {
        // Convert number to 32-bit binary string
        const bits = (value >>> 0).toString(2).padStart(32, '0');

        this.of_immobile = !!parseInt(bits[31 - 0]);      // Not affected by gravity etc
        this.of_editorlock = !!parseInt(bits[31 - 1]);    // Object is locked down (can't move in editor)
        this.of_light = !!parseInt(bits[31 - 2]);         // Object generates light (a light is on for object)
        this.of_moving = !!parseInt(bits[31 - 3]);        // Object is a moving object (characters, exits, players, missiles, etc.)
        this.of_animating = !!parseInt(bits[31 - 4]);     // Has animating imagery (animator pointer is set)
        this.of_ai = !!parseInt(bits[31 - 5]);            // Object has A.I.
        this.of_disabled = !!parseInt(bits[31 - 6]);      // Object A.I. is disabled
        this.of_invisible = !!parseInt(bits[31 - 7]);     // Not visible in map pane during normal play
        this.of_editor = !!parseInt(bits[31 - 8]);        // Is editor only object
        this.of_drawflip = !!parseInt(bits[31 - 9]);      // Reverse on the horizontal
        this.of_seldraw = !!parseInt(bits[31 - 10]);      // Editor is manipulating object
        this.of_reveal = !!parseInt(bits[31 - 11]);       // Player needs to see behind object (shutter draw)
        this.of_kill = !!parseInt(bits[31 - 12]);         // Suicidal (tells system to kill object next frame)
        this.of_generated = !!parseInt(bits[31 - 13]);    // Created by map generator
        this.of_animate = !!parseInt(bits[31 - 14]);      // Call the objects Animate() func AND create object animators
        this.of_pulse = !!parseInt(bits[31 - 15]);        // Call the object Pulse() function
        this.of_weightless = !!parseInt(bits[31 - 16]);   // Object can move, but is not affected by gravity
        this.of_complex = !!parseInt(bits[31 - 17]);      // Object is a complex object
        this.of_notify = !!parseInt(bits[31 - 18]);       // Notify object of a system change (see notify codes below)
        this.of_nonmap = !!parseInt(bits[31 - 19]);       // Not created, deleted, saved, or loaded by map (see below)
        this.of_onexit = !!parseInt(bits[31 - 20]);       // Object is currently on an exit (used to prevent exit loops)
        this.of_pause = !!parseInt(bits[31 - 21]);        // Script is paused
        this.of_nowalk = !!parseInt(bits[31 - 22]);       // Don't use walk map for this tile
        this.of_paralize = !!parseInt(bits[31 - 23]);     // Freeze the object in mid-animation
        this.of_nocollision = !!parseInt(bits[31 - 24]);  // Let the object go through boundries
        this.of_iced = !!parseInt(bits[31 - 25]);         // Used to know when to end the iced effect
    }
    // NOTE: OF_NONMAP
    // ----------------
    //
    // OF_NONMAP tells the map system that this object is managed outside of the regular map
    // system.  This object will not be LOADED, SAVED, CREATED, or DELETED by the map or
    // sector system.  Any object with this flag can be inserted into the map and assume that
    // it won't be deleted by the map system. This flag is intended for players, but can be used for
    // other objects. 
}

async function main() {
    const gameDir = path.join('_INSTALLED_GAME', 'Revenant');
    const mapDir = path.join(gameDir, 'Modules', 'Ahkuilon', 'Map');
    const resourcesDir = path.join(gameDir, 'Resources');

    try {
        // Load IMAGERY.DAT first
        console.log('Loading IMAGERY.DAT...');
        const imageryDatPath = path.join(resourcesDir, 'imagery.dat');
        const imageryData = await ImageryDatParser.loadFile(imageryDatPath);
        if (imageryData) {
            console.log(`Loaded ${imageryData.entries.length} imagery entries`);
        }

        // Build the file cache
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
                        // debugger;
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
