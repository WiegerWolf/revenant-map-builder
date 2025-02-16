import { InputStream } from '../utils/InputStream';
import { BufferUtils } from '../utils/BufferUtils';
import BitmapFlags from '../models/flags/BitmapFlags';
import ChunkHeader from '../models/structures/ChunkHeader';

class ImageryDatParser {
    constructor(buffer) {
        this.stream = new InputStream(buffer);
    }

    parse() {
        const header = new ChunkHeader(this.stream);
        const chunks = [];

        for (let y = 0; y < header.height; y++) {
            for (let x = 0; x < header.width; x++) {
                if (!header.isBlockBlank(x, y)) {
                    const blockOffset = header.getBlockOffset(x, y);
                    const blockSize = header.getBlockSize(x, y);
                    
                    if (blockSize > 0) {
                        this.stream.setPos(blockOffset);
                        const chunk = this.parseChunk(blockSize);
                        chunks.push({
                            x,
                            y,
                            data: chunk
                        });
                    }
                }
            }
        }

        return {
            width: header.width,
            height: header.height,
            chunks
        };
    }

    parseChunk(blockSize) {
        const flags = new BitmapFlags(this.stream.readUint32());
        const width = this.stream.readUint16();
        const height = this.stream.readUint16();
        
        // Skip registration point if present
        if (flags.bm_regpoint) {
            this.stream.skip(4); // Skip x, y coordinates (2 bytes each)
        }

        // Handle palette if present
        let palette = null;
        if (flags.needsPalette()) {
            palette = this.parsePalette();
        }

        // Calculate pixel data size
        const bytesPerPixel = flags.getBytesPerPixel();
        const pixelDataSize = width * height * bytesPerPixel;

        // Read pixel data
        let pixelData;
        if (!flags.bm_nobitmap) {
            if (flags.bm_compressed) {
                pixelData = this.parseCompressedData(pixelDataSize);
            } else {
                const slice = BufferUtils.createBufferSlice(
                    this.stream.dataView.buffer,
                    this.stream.getPos(),
                    pixelDataSize
                );
                pixelData = slice.buffer;
                this.stream.skip(pixelDataSize);
            }
        }

        return {
            flags,
            width,
            height,
            palette,
            pixelData
        };
    }

    parsePalette() {
        const palette = new Array(256);
        for (let i = 0; i < 256; i++) {
            palette[i] = {
                r: this.stream.readUint8(),
                g: this.stream.readUint8(),
                b: this.stream.readUint8()
            };
        }
        return palette;
    }

    parseCompressedData(uncompressedSize) {
        // Implement RLE decompression here
        // This is a placeholder - actual implementation would depend on the specific compression format used
        const compressedSize = this.stream.readUint32();
        const compressedData = new Uint8Array(compressedSize);
        
        for (let i = 0; i < compressedSize; i++) {
            compressedData[i] = this.stream.readUint8();
        }

        // TODO: Implement actual decompression
        return compressedData;
    }
}

export default ImageryDatParser;

/* original code
class ImageryDatParser {
    static QUICKLOAD_FILE_ID = ('H'.charCodeAt(0)) |
        ('D'.charCodeAt(0) << 8) |
        ('R'.charCodeAt(0) << 16) |
        ('S'.charCodeAt(0) << 24);
    static QUICKLOAD_FILE_VERSION = 1;
    static MAX_IMAGERY_FILENAME_LENGTH = 80; // MAXIMFNAMELEN
    static MAXANIMNAME = 32;
    static gameDir = "";

    static async loadFile(filePath, gameDir) {
        try {
            this.gameDir = gameDir;
            const buffer = await fs.readFile(filePath);
            const arrayBuffer = buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
            );
            return await ImageryDatParser.parse(arrayBuffer);
        } catch (error) {
            console.error('Error loading IMAGERY.DAT file:', error);
            debugger;
            return null;
        }
    }

    static async parse(arrayBuffer) {
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

            // Read imagery body
            const imageryBody = await this.parseImageryBody(filename, imageryHeader);

            // Add entry to the list
            entries.push({
                filename,
                headerSize,
                header: imageryHeader,
                body: imageryBody
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
            imageryId: ImageryType.getName(stream.readUint32()),    // Id number for imagery handler (index to builder array)
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
                flags: new ObjectFlags(stream.readUint32()),   // Imagery state flags (DWORD)
                aniFlags: new AnimationFlags(stream.readInt16()), // Animation state flags (short)
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
                invAniFlags: new AnimationFlags(stream.readInt16()), // Animation flags for inventory animation (short)
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

    static async parseImageryBody(filename, imageryHeader) {
        // The imagery body is actually stored in separate .I2D or .I3D files
        // We need to load these files using the CGSResourceParser

        // First, determine if it's a 2D or 3D imagery based on the filename extension
        const extension = extname(filename).toLowerCase();
        const is3D = extension === '.i3d';

        // Create a result object to store all imagery data
        const result = {
            filename,
            header: imageryHeader,
            is3D,
            states: []
        };

        // For each state in the imagery header, load its corresponding resource file
        for (let i = 0; i < imageryHeader.numStates; i++) {
            const state = imageryHeader.states[i];

            // Construct the resource filename
            // The resource files are typically stored in the Imagery directory
            const resourcePath = filename;

            try {
                // Load the resource file
                const resource = await DatParser.loadResourceFile(this.gameDir, resourcePath);

                if (resource) {
                    // Add the loaded resource data to our state
                    result.states.push({
                        ...state,
                        resource: resource,
                        bitmaps: resource.bitmaps.map(bitmap => ({
                            ...bitmap,
                        }))
                    });
                } else {
                    console.warn(`Failed to load resource for state ${i} of ${filename}`);
                    result.states.push({
                        ...state,
                        resource: null,
                        bitmaps: []
                    });
                }
            } catch (error) {
                console.error(`Error loading resource for state ${i} of ${filename}:`, error);
                result.states.push({
                    ...state,
                    resource: null,
                    bitmaps: []
                });
            }
        }

        return result;
    }
}

class ImageryType {
    static ANIMATION = 0;
    static MESH3D = 1;
    static MESH3DHELPER = 2;
    static MULTI = 3;
    static MULTIANIMATION = 4;

    static getName(id) {
        switch (id) {
            case this.ANIMATION: return 'ANIMATION';
            case this.MESH3D: return 'MESH3D';
            case this.MESH3DHELPER: return 'MESH3DHELPER';
            case this.MULTI: return 'MULTI';
            case this.MULTIANIMATION: return 'MULTIANIMATION';
            default: return 'UNKNOWN';
        }
    }

    static isValid(id) {
        return id >= this.ANIMATION && id <= this.MULTIANIMATION;
    }
}

*/