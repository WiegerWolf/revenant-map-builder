import { ResourceParser } from '../parsers/ResourceParser.js';
import { BitmapData } from '../models/BitmapData.js';
import { BitmapRender } from '../utils/BitmapRender.js';
import { join } from 'path';
import { ParserError } from '../models/errors/ParserErrors.js';

export class BitmapProcessor {
    static async processSingleBitmap(stream, bitmapOffsets, index, header, arrayBuffer, filePath) {
        const { currentOffset, nextOffset } = this.calculateOffsets(bitmapOffsets, index, header);
        const bitmapSize = nextOffset - currentOffset;
        
        const bitmapBuffer = this.createBitmapBuffer(arrayBuffer, stream, currentOffset, bitmapSize);
        const bitmapStream = ResourceParser.createInputStream(bitmapBuffer);
        
        const bitmap = BitmapData.readBitmap(bitmapStream, bitmapBuffer);
        
        if (filePath) {
            await this.saveBitmap(bitmap, filePath, index);
        }
        
        return bitmap;
    }

    static calculateOffsets(bitmapOffsets, index, header) {
        return {
            currentOffset: bitmapOffsets[index],
            nextOffset: (index < header.topbm - 1)
                ? bitmapOffsets[index + 1]
                : header.datasize
        };
    }

    static createBitmapBuffer(arrayBuffer, stream, currentOffset, bitmapSize) {
        const bitmapBuffer = new ArrayBuffer(bitmapSize);
        const bitmapData = new Uint8Array(bitmapBuffer);
        const sourceData = new Uint8Array(
            arrayBuffer,
            stream.getPos() + currentOffset,
            bitmapSize
        );
        bitmapData.set(sourceData);
        return bitmapBuffer;
    }

    static async saveBitmap(bitmap, sourcePath, index) {
        try {
            const outputPath = this.getOutputPath(sourcePath, index);
            await BitmapRender.saveToBMP(bitmap, outputPath);
        } catch (error) {
            throw new ParserError(`Failed to save bitmap ${index}`, error);
        }
    }

    static getOutputPath(sourcePath, index) {
        const relativePath = sourcePath
            .split('Resources/')[1]
            .replace('.i2d', '');
        return join('_OUTPUT', relativePath, `bitmap_${index}.bmp`);
    }
}