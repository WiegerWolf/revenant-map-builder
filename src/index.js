import { promises as fs } from 'fs';
import { ImageryDatParser } from './parsers/ImageryDatParser';
import { DatParser } from './parsers/DatParser';
import { ClassDefParser } from './parsers/ClassDefParser';
import { CGSResourceParser } from './parsers/CGSResourceParser';

async function loadFile(filePath) {
    try {
        const buffer = await fs.readFile(filePath);
        return buffer.buffer;
    } catch (error) {
        console.error(`Error loading file ${filePath}:`, error);
        throw error;
    }
}

async function parseImageryDat(filePath) {
    const buffer = await loadFile(filePath);
    const parser = new ImageryDatParser(buffer);
    return parser.parse();
}

async function parseClassDef(filePath) {
    const buffer = await loadFile(filePath);
    const parser = new ClassDefParser(buffer);
    return parser.parse();
}

async function parseDatFile(filePath) {
    const buffer = await loadFile(filePath);
    const parser = new DatParser(buffer);
    return parser.parse();
}

async function parseCGSResource(filePath) {
    const buffer = await loadFile(filePath);
    const parser = new CGSResourceParser(buffer);
    return parser.parse();
}

export default {
    parseImageryDat,
    parseClassDef,
    parseDatFile,
    parseCGSResource
};