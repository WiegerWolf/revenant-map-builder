import { promises as fs } from 'fs';
import { join, relative, sep } from "path";
import { CGSResourceParser } from './CGSResourceParser';
import { ClassDefParser } from './ClassDefParser';
import { InputStream } from './InputStream';
import { ExitFlags } from './ExitFlags';
import { ActionBlock } from './ActionBlock';
import { LightFlags } from './LightFlags';
import { S3DPoint } from './S3DPoint';
import { SColor } from './SColor';
import { SLightDef } from './SLightDef';
import { ObjectFlags } from './ObjectFlags';


export class DatParser {
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

    static classDefs = new Map();

    static async loadClassDefinitions(gameDir) {
        const classDefPath = join(gameDir, 'Resources', 'class.def');
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

    static loadObject(stream, version, isMap = false) {
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
        if (objClass < 0) { // Placeholder for empty object slot
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
                stream.skip(blockSize); // Just quietly skip this object
                return null;
            }
            else { // Try to fix it by assuming its a tile
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

            if (objType < 0) { // Still can't find type
                if (this.Debug) {
                    throw new Error(`Object unique id 0x${uniqueId.toString(16)} not found in class.def`);
                }
                else if (blockSize >= 0) { // Just skip over this object
                    stream.skip(blockSize);
                    return null;
                }
                else { // If attempting to fix, assume type is type 0
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
        const typeInfo = this.getTypeInfo(uniqueId, objClass);
        // Load object data
        const objectData = forcesimple ?
            this.loadBaseObjectData(stream, version, objVersion) : // Used if object changed class
            this.loadObjectData(stream, version, objVersion, typeInfo, this.OBJ_CLASSES[objClass]); // This should normally be used

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
                stream.readInt32(), // x
                stream.readInt32(), // y
                stream.readInt32() // z
            );

            // Read color
            lightDef.color = new SColor(
                stream.readUint8(), // red
                stream.readUint8(), // green
                stream.readUint8() // blue
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
            flags, // This will be the ObjectFlags instance
            flagsRaw, // This is the raw uint32 value
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

        // If still not found, return -1
        console.warn(`Could not find object type ${uniqueId.toString(16)} in class ${className}`);
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
                const fullPath = join(dir, entry.name);
                const relativePath = relative(baseDir, fullPath).toLowerCase();

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
        const normalizedSearch = searchPath.toLowerCase().replace(/\\/g, sep);

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
            const resourcesDir = join(gameDir, 'Resources');

            // Prepend 'Imagery' to the resource path
            const imageryPath = join('Imagery', resourcePath);

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
            case 'effect':
            case 'helper':
            case 'shadow':
            case 'trap':
            case 'food':
            case 'item':
                return this.loadBaseObjectData(stream, version, objVersion);
            case 'exit':
                return this.loadExitData(stream, version, objVersion);
            case 'container':
                return this.loadContainerData(stream, version, objVersion);
            case 'complexobject':
                return this.loadComplexObjectData(stream, version, objVersion);
            case 'character':
                return this.loadCharacterData(stream, version, objVersion);
            case 'scroll':
                return this.loadScrollData(stream, version, objVersion);
            case 'weapon':
                return this.loadWeaponData(stream, version, objVersion);
            default:
                console.warn(`Unknown object class: ${objClassName}`);
                debugger;
                return {};
        }
    }

    static loadWeaponData(stream, version, objVersion) {
        // Load base object data first
        const baseData = this.loadBaseObjectData(stream, version, objVersion);

        // Read poison value
        const poison = stream.readInt32();

        return {
            ...baseData,
            className: 'weapon',
            poison,

            // Add helper methods and getters for stats
            getPoison: () => poison,
            getType: () => baseData.stats?.find(s => s.name === "Type")?.value ?? 0,
            getDamage: () => baseData.stats?.find(s => s.name === "Damage")?.value ?? 0,
            getEqSlot: () => baseData.stats?.find(s => s.name === "EqSlot")?.value ?? 0,
            getCombining: () => baseData.stats?.find(s => s.name === "Combining")?.value ?? 0,
            getValue: () => baseData.stats?.find(s => s.name === "Value")?.value ?? 0,

            // Helper method to clear weapon (matches C++ ClearWeapon())
            clearWeapon: function () {
                this.poison = 0;
            }
        };
    }

    static loadScrollData(stream, version, objVersion) {
        // Load base object data first
        const baseData = this.loadBaseObjectData(stream, version, objVersion);

        // Read text length
        const textLength = stream.readInt16();

        let text = null;
        if (textLength > 0) {
            // Read text characters
            const textBytes = new Uint8Array(textLength);
            for (let i = 0; i < textLength; i++) {
                textBytes[i] = stream.readUint8();
            }
            // Convert to string
            text = new TextDecoder('ascii').decode(textBytes);
        }

        return {
            ...baseData,
            className: 'scroll',
            text,

            // Add helper methods
            getText: () => text,
            cursorType: (inst) => inst ? CURSOR_NONE : CURSOR_EYE
        };
    }

    static loadCharacterData(stream, version, objVersion) {
        let baseData;

        // Load base complex object data based on version
        if (objVersion >= 3) {
            // Read complex object version byte first
            const complexObjVersion = stream.readUint8();
            baseData = this.loadComplexObjectData(stream, version, complexObjVersion);
        } else {
            baseData = this.loadComplexObjectData(stream, version, 0);
        }

        // Early return for old versions
        if (objVersion < 1) {
            return {
                ...baseData,
                className: 'character'
            };
        }

        // Load recovery timestamps
        const lasthealthrecov = stream.readInt32();
        const lastfatiguerecov = stream.readInt32();
        let lastmanarecov = -1;
        try {

            lastmanarecov = stream.readInt32();
        } catch (error) {
            debugger;
        }

        // Load poison damage (version 4+)
        let lastpoisondamage = -1;
        if (objVersion >= 4) {
            lastpoisondamage = stream.readInt32();
        }

        // Load teleport data (version 2+)
        let teleportPosition = new S3DPoint(-1, -1, -1);
        let teleportLevel = -1;
        if (objVersion >= 2) {
            teleportPosition = new S3DPoint(
                stream.readInt32(), // x
                stream.readInt32(), // y
                stream.readInt32() // z
            );
            teleportLevel = stream.readInt32();
        }

        return {
            ...baseData,
            className: 'character',
            lasthealthrecov,
            lastfatiguerecov,
            lastmanarecov,
            lastpoisondamage,
            teleportPosition,
            teleportLevel
        };
    }

    static loadComplexObjectData(stream, version, objVersion) {
        let baseData;

        // Load base object data based on version
        if (objVersion >= 1) {
            // Read base class version byte first
            const baseObjVersion = stream.readUint8();
            baseData = this.loadBaseObjectData(stream, version, baseObjVersion);
        } else {
            baseData = this.loadBaseObjectData(stream, version, 0);
        }

        // Load root state
        let actionBlock;
        if (version < 7) {
            actionBlock = new ActionBlock("still"); // DefaultRootState
        } else {
            const action = stream.readUint8();
            const name = stream.readString();

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
            return [];
        }

        // Array to store inventory items
        const inventory = [];

        // Load each inventory object
        for (let i = 0; i < num; i++) {
            try {
                // the code below is commented out because it's not working properly
                // it supposed to load objects into inventory recursevely, but it's not working
                // when we attempt to read inventory from the dat map file for an object like a
                // chatacter, it starts to read garbage. I coulnd't figure out why or find where
                // the problem is.
                // Anyways, for the purpose of building a map inventory is not needed anyways.
                // const inst = this.loadObject(stream, version);
                console.log("Skipping loading inventory object " + i);
                continue;
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
        return objectData.flags.of_nonmap;
    }
}
