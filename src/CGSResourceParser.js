import { promises as fs } from 'fs';
import { join, dirname } from "path";
import { AnimationFlags } from './AnimationFlags';
import { BitmapData } from './BitmapData';
import { BitmapRender } from './BitmapRender';
import { ImageryType } from './ImageryType';
import { InputStream } from './InputStream';
import { ObjectFlags } from './ObjectFlags';
import { readFileAsArrayBuffer, readNullTerminatedStringFromStream } from './utils';

export class CGSResourceParser {
    static RESMAGIC = 0x52534743; // 'CGSR' in little-endian
    static RESVERSION = 1;

    static async loadFile(filePath) {
        try {
            console.info(`Reading file: ${filePath}`);
            const arrayBuffer = await readFileAsArrayBuffer(filePath);
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
            resmagic: stream.readUint32(), // DWORD resmagic
            topbm: stream.readUint16(), // WORD topbm
            comptype: stream.readUint8(), // BYTE comptype
            version: stream.readUint8(), // BYTE version
            datasize: stream.readUint32(), // DWORD datasize
            objsize: stream.readUint32(), // DWORD objsize
            hdrsize: stream.readUint32(), // DWORD hdrsize
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
                ascii: readNullTerminatedStringFromStream(stream, 32), // char ascii[32]
            };

            // Then read the rest of the fields
            metaData.walkmap = stream.readUint32(); // Walkmap
            metaData.imageryflags = new ObjectFlags(stream.readUint32()); // Imagery state flags
            metaData.aniflags = new AnimationFlags(stream.readUint16()); // Animation state flags
            metaData.frames = stream.readUint16(); // Number of frames
            metaData.widthmax = stream.readInt16(); // Graphics maximum width/height (for IsOnScreen and refresh rects)
            metaData.heightmax = stream.readUint16();
            metaData.regx = stream.readInt16(); // Registration point x,y,z for graphics
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
            console.warn(`Padding walkmap data by ${padding} bytes`);
            stream.skip(padding);
        }

        // Skip unknown data
        // const unknownDataSize = header.hdrsize - 12 - (72 * header.numStates);
        // if (unknownDataSize > 0) {
        //     console.warn(`Attempt to skip ${unknownDataSize} bytes of unknown data`);
        //     stream.skip(unknownDataSize);
        //     debugger;
        // }

        // Skip to the start of the bitmaps offsets section
        stream.setPos(0x14+header.hdrsize);
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
                    `bitmap_${i}.png`
                );
                const palletOutputPath = join(
                    '_OUTPUT',
                    relativePath,
                    `palette_${i}.png`
                );

                await fs.mkdir(dirname(palletOutputPath), { recursive: true });
                await BitmapRender.renderPaletteDebug(bitmap.palette, palletOutputPath);
                // await fs.mkdir(dirname(outputPath), { recursive: true });
                // await BitmapRender.renderBitmap(bitmap, outputPath);

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
            console.warn('No bitmap data, nothing to convert.');
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
