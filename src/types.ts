import { BitmapFlags } from './BitmapFlags';
import { DrawModeFlags } from './DrawModeFlags';

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
}