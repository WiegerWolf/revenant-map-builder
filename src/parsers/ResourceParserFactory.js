import { CGSResourceParser } from './CGSResourceParser.js';
import { ImageryDatParser } from './ImageryDatParser.js';
import { DatParser } from './DatParser.js';
import { ClassDefParser } from './ClassDefParser.js';
import { ParserError } from '../models/errors/ParserErrors.js';

export class ResourceParserFactory {
    static #parserMap = new Map();

    static {
        this.registerParser('.i2d', CGSResourceParser);
        this.registerParser('.dat', DatParser);
        this.registerParser('imagery.dat', ImageryDatParser);
        this.registerParser('class.def', ClassDefParser);
    }

    static registerParser(extension, parserClass) {
        this.#parserMap.set(extension.toLowerCase(), parserClass);
    }

    static getParser(filePath) {
        const fileName = filePath.toLowerCase();
        
        // First try exact filename match
        for (const [key, parser] of this.#parserMap) {
            if (fileName.endsWith(key)) {
                return parser;
            }
        }

        throw new ParserError(`No parser found for file: ${filePath}`);
    }

    static async parseFile(filePath) {
        const parser = this.getParser(filePath);
        return await parser.loadFile(filePath);
    }
}