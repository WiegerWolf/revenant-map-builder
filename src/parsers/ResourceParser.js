import { ParserError } from '../models/errors/ParserErrors.js';
import { InputStream } from '../utils/InputStream.js';
import { promises as fs } from 'fs';

export class ResourceParser {
    static async loadFile(filePath) {
        try {
            const buffer = await fs.readFile(filePath);
            const arrayBuffer = buffer.buffer.slice(
                buffer.byteOffset,
                buffer.byteOffset + buffer.byteLength
            );
            return await this.parse(arrayBuffer, filePath);
        } catch (error) {
            console.error(`Error loading resource file ${filePath}:`, error);
            throw new ParserError(`Failed to load file: ${filePath}`, error);
        }
    }

    static async parse(arrayBuffer, filePath) {
        throw new Error('parse() method must be implemented by subclass');
    }

    static createInputStream(arrayBuffer) {
        return new InputStream(arrayBuffer);
    }

    static validateMagic(actual, expected, errorMessage) {
        if (actual !== expected) {
            throw new ParserError(errorMessage || 'Invalid magic number');
        }
    }

    static validateVersion(actual, expected, errorMessage) {
        if (actual < expected) {
            throw new ParserError(errorMessage || 'File version too old');
        }
        if (actual > expected) {
            throw new ParserError(errorMessage || 'File version too new');
        }
    }

    static async saveOutput(data, outputPath) {
        try {
            await fs.mkdir(dirname(outputPath), { recursive: true });
            await fs.writeFile(outputPath, data);
        } catch (error) {
            throw new ParserError(`Failed to save output to ${outputPath}`, error);
        }
    }
}