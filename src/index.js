const fs = require('fs').promises;
const path = require('path');
const { ImageryDatParser } = require('./parsers/ImageryDatParser');
const { DatParser } = require('./parsers/DatParser');
const { ClassDefParser } = require('./parsers/ClassDefParser');
const { CGSResourceParser } = require('./parsers/CGSResourceParser');

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

module.exports = {
    parseImageryDat,
    parseClassDef,
    parseDatFile,
    parseCGSResource
};