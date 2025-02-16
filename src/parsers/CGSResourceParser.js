import { ResourceParser } from './ResourceParser.js';
import { BitmapProcessor } from '../utils/BitmapProcessor.js';
import { ParserError } from '../models/errors/ParserErrors.js';
import { promises as fs } from 'fs';

export class CGSResourceParser extends ResourceParser {
    static RESMAGIC = 0x52534743; // 'CGSR' in little-endian
    static RESVERSION = 1;

    static async loadFile(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            const arrayBuffer = this.createArrayBuffer(buffer);
            console.info(`Reading file: ${filePath}`);
            return await this.parse(arrayBuffer, filePath);
        } catch (error) {
            throw new ParserError('Error loading CGS resource file', error);
        }
    }

    static createArrayBuffer(buffer) {
        return buffer.buffer.slice(
            buffer.byteOffset,
            buffer.byteOffset + buffer.byteLength
        );
    }

    static async parse(arrayBuffer, filePath) {
        const stream = this.createInputStream(arrayBuffer);
        try {
            const header = this.parseHeader(stream);
            const bitmapOffsets = this.parseBitmapOffsets(stream, header.topbm);
            const bitmaps = await this.processBitmaps(
                stream,
                bitmapOffsets,
                header,
                arrayBuffer,
                filePath
            );
            return { header, bitmaps };
        } catch (error) {
            throw new ParserError('Failed to parse CGS resource', error);
        }
    }

    static parseHeader(stream) {
        const header = {
            resmagic: stream.readUint32(),
            topbm: stream.readUint16(),
            comptype: stream.readUint8(),
            version: stream.readUint8(),
            datasize: stream.readUint32(),
            objsize: stream.readUint32(),
            hdrsize: stream.readUint32(),
            imageryId: stream.readUint32(),
            numStates: stream.readUint32(),
        };

        this.validateHeader(header);
        return header;
    }

    static validateHeader(header) {
        this.validateMagic(
            header.resmagic, 
            this.RESMAGIC, 
            'Not a valid CGS resource file'
        );
        this.validateVersion(
            header.version,
            this.RESVERSION,
            'Resource file version not compatible'
        );
        if (header.objsize !== header.datasize) {
            console.warn('Warning: objsize does not match datasize');
        }
    }

    static parseBitmapOffsets(stream, numBitmaps) {
        if (!numBitmaps) return [];
        
        const bitmapOffsets = [];
        for (let i = 0; i < numBitmaps; i++) {
            bitmapOffsets.push(stream.readUint32());
        }
        return bitmapOffsets;
    }

    static async processBitmaps(stream, bitmapOffsets, header, arrayBuffer, filePath) {
        if (!bitmapOffsets?.length) return [];

        const bitmaps = [];
        for (let i = 0; i < header.topbm; i++) {
            try {
                const bitmapData = await BitmapProcessor.processSingleBitmap(
                    stream,
                    bitmapOffsets,
                    i,
                    header,
                    arrayBuffer,
                    filePath
                );
                bitmaps.push(bitmapData);
            } catch (error) {
                throw new ParserError(`Failed to process bitmap ${i}`, error);
            }
        }
        return bitmaps;
    }
}

/* original code
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
            console.info(`Reading file: ${filePath}`);
            return await CGSResourceParser.parse(arrayBuffer, filePath);
        } catch (error) {
            console.error('Error loading CGS resource file:', error);
            debugger;
            return null;
        }
    }

    static async parse(arrayBuffer, filePath) {
        const stream = new InputStream(arrayBuffer);

        // Read FileResHdr according to the C++ structure
        const header = {
            resmagic: stream.readUint32(),    // DWORD resmagic
            topbm: stream.readUint16(),       // WORD topbm
            comptype: stream.readUint8(),     // BYTE comptype
            version: stream.readUint8(),      // BYTE version
            datasize: stream.readUint32(),    // DWORD datasize
            objsize: stream.readUint32(),     // DWORD objsize
            hdrsize: stream.readUint32(),     // DWORD hdrsize
            imageryId: ImageryType.getName(stream.readUint32()),
            numStates: stream.readUint32(),
        };

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

        if (header.objsize !== header.datasize) {
            console.warn('objsize does not match datasize');
            debugger;
        }

        // Read imagery_header_meta for each state
        const imageryMetaData = [];
        for (let i = 0; i < header.numStates; i++) {
            const metaData = {
                ascii: new Uint8Array(32)  // Initialize ASCII array
            };

            // Read ASCII characters first
            for (let j = 0; j < 32; j++) {
                metaData.ascii[j] = stream.readUint8();
            }
            // Convert ASCII array to string
            metaData.ascii = String.fromCharCode(...metaData.ascii)
                .replace(/\0/g, '');  // Remove null characters

            // Then read the rest of the fields
            metaData.walkmap = stream.readUint32(); // Walkmap
            metaData.imageryflags = new ObjectFlags(stream.readUint32()); // Imagery state flags
            metaData.aniflags = new AnimationFlags(stream.readUint16()); // Animation state flags
            metaData.frames = stream.readUint16(); // Number of frames
            metaData.widthmax = stream.readInt16();  // Graphics maximum width/height (for IsOnScreen and refresh rects)
            metaData.heightmax = stream.readUint16();
            metaData.regx = stream.readInt16();  // Registration point x,y,z for graphics
            metaData.regy = stream.readUint16();
            metaData.regz = stream.readUint16();
            metaData.animregx = stream.readUint16(); // Registration point of animation
            metaData.animregy = stream.readUint16();
            metaData.animregz = stream.readUint16();
            metaData.wregx = stream.readUint16(); // World registration x and y of walk and bounding box info
            metaData.wregy = stream.readUint16();
            metaData.wregz = stream.readUint16();
            metaData.wwidth = stream.readUint16(); // Object's world width, length, and height for walk map and bound box
            metaData.wlength = stream.readUint16();
            metaData.wheight = stream.readUint16();
            metaData.invaniflags = new AnimationFlags(stream.readUint16()); // Animation flags for inventory animation
            metaData.invframes = stream.readUint16(); // Number of frames of inventory animation

            imageryMetaData.push(metaData);
        }

        // After all states are read, process walkmap data for states that have it
        for (const metaData of imageryMetaData) {
            if (metaData.walkmap !== 0 && metaData.wwidth > 0 && metaData.wlength > 0) {
                const walkmapSize = metaData.wwidth * metaData.wlength;
                metaData.walkmapData = new Uint8Array(walkmapSize);
                for (let j = 0; j < walkmapSize; j++) {
                    metaData.walkmapData[j] = stream.readUint8();
                }
            }
        }

        // Add padding to align to 4 bytes
        const totalWalkmapSize = imageryMetaData.reduce((sum, metaData) => sum + metaData.wwidth * metaData.wlength, 0);
        const padding = (4 - (totalWalkmapSize % 4)) % 4;
        if (padding > 0) {
            stream.skip(padding);
        }

        // Skip unknown data
        const unknownDataSize = header.hdrsize - 12 - (72 * header.numStates);
        if (unknownDataSize > 0) {
            // stream.skip(unknownDataSize);
            console.warn(`Attempt to skip ${unknownDataSize} bytes of unknown data prevented`);
            if (unknownDataSize > 4) {
                // debugger;
            }
        }

        // Read bitmap offsets
        const bitmapOffsets = [];
        for (let i = 0; i < header.topbm; i++) {
            bitmapOffsets.push(stream.readUint32());
        }

        // Process bitmaps if present
        let bitmaps = [];
        if (bitmapOffsets && bitmapOffsets.length) {
            for (let i = 0; i < header.topbm; i++) {
                const currentOffset = bitmapOffsets[i];
                // Calculate size: either difference to next offset, or remaining data
                const nextOffset = (i < header.topbm - 1)
                    ? bitmapOffsets[i + 1]
                    : header.datasize;
                const bitmapSize = nextOffset - currentOffset;

                // Create a new ArrayBuffer specifically for this bitmap
                const bitmapBuffer = new ArrayBuffer(bitmapSize);
                const bitmapData = new Uint8Array(bitmapBuffer);

                // Copy the bitmap data from the original buffer
                const sourceData = new Uint8Array(
                    arrayBuffer,
                    stream.getPos() + currentOffset,
                    bitmapSize
                );
                bitmapData.set(sourceData);

                // Create a stream with the isolated bitmap data
                const bitmapStream = new InputStream(bitmapBuffer);

                // Read bitmap (now starting from position 0 since we have isolated data)
                const bitmap = BitmapData.readBitmap(bitmapStream, bitmapBuffer);

                // Get the relative path and save bitmap
                const relativePath = filePath
                    .split('Resources/')[1]
                    .replace('.i2d', '');

                const outputPath = join(
                    '_OUTPUT',
                    relativePath,
                    `bitmap_${i}.bmp`
                );

                await fs.mkdir(dirname(outputPath), { recursive: true });
                await BitmapRender.saveToBMP(bitmap, outputPath);

                // Perform sanity checks and conversions
                if (bitmap.width > 8192 || bitmap.height > 8192) {
                    throw new Error('Corrupted bitmap list in resource');
                }

                if (bitmap.flags.bm_15bit) {
                    this.convert15to16(bitmap);
                }

                if (bitmap.flags.bm_8bit) {
                    this.convertPal15to16(bitmap);
                }

                bitmaps.push(bitmap);
            }
        }

        return {
            header,
            imageryMetaData,
            size: header.objsize,
            bitmaps
        };
    }

    static convert15to16(bitmap) {
        if (!bitmap || !bitmap.data) {
            console.warn('No bitmap data, nothing to convert.')
            return;
        }
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
}
*/