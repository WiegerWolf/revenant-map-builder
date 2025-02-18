import { BitmapFlags } from './BitmapFlags';
import { DrawModeFlags } from './DrawModeFlags';
import { ChunkHeader } from './ChunkHeader';

export interface Palette {
    colors: Uint16Array;
    rgbcolors: Uint32Array;
}

export interface BitmapDataType {
    width: number;
    height: number;
    regx: number;
    regy: number;
    flags: BitmapFlags;
    drawmode: DrawModeFlags;
    keycolor: number;
    aliassize: number;
    alias: number | Uint8Array;
    alphasize: number;
    alpha: number | Uint8Array;
    zbuffersize: number;
    zbuffer: number | Uint16Array;
    normalsize: number;
    normal: number | Uint16Array;
    palettesize: number;
    palette: number | Palette;
    datasize: number;
    data: Uint8Array | Uint16Array | Uint32Array | null;
    chunkHeader: ChunkHeader | null;
    chunkBlocks: ChunkBlock[] | null;
}

export enum DecompressionMethod {
    RAW = 0,
    RLE_SKIP = 1,
    RLE_REPEAT = 2,
    LZ = 3
}

export interface ChunkBlock {
    number: number;
    flag1: number;
    flag2: number;
    flag3: number;
    data: Uint8Array;
    decompressionMap?: Uint8Array;  // Tracks which method was used to decompress each byte
}