import { readFile } from "node:fs/promises";

// CRC32 calculation (needed for PNG format)
interface CRCTable extends Int32Array {
    [index: number]: number;
}

export function calculateCRC32(data: Uint8Array | Buffer): number {
    let crc: number = -1;
    const crcTable: CRCTable = new Int32Array(256) as CRCTable;

    for (let n = 0; n < 256; n++) {
        let c: number = n;
        for (let k = 0; k < 8; k++) {
            c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }

    for (let i = 0; i < data.length; i++) {
        crc = crcTable[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
    }

    return crc ^ -1;
}

interface FileBuffer extends Buffer {
    buffer: ArrayBuffer;
    byteOffset: number;
    byteLength: number;
}

export async function readFileAsArrayBuffer(filePath: string): Promise<ArrayBuffer> {
    const buffer = await readFile(filePath) as FileBuffer;
    const arrayBuffer = buffer.buffer.slice(
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
    );
    return arrayBuffer;
}


export function getNullTerminatedStringFromByteArray(byteArray: Uint8Array): string {
    let resString = '';
    for (let j = 0; j < byteArray.length; j++) {
        if (byteArray[j] === 0) break;
        resString += String.fromCharCode(byteArray[j]);
    }
    return resString;
}