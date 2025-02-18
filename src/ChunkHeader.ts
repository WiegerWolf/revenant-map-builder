import { InputStream } from './InputStream';

export class ChunkHeader {
    readonly type: number;
    readonly width: number;
    readonly height: number;
    readonly blocks: number[];

    constructor(stream: InputStream) {
        // Read the fixed part of the header
        this.type = stream.readUint32(); // Compressed flag
        this.width = stream.readInt32(); // Width in blocks
        this.height = stream.readInt32(); // Height in blocks

        // Validate dimensions
        if (this.width <= 0 || this.height <= 0 ||
            this.width > 128 || this.height > 128) {
            throw new Error(`Invalid chunk header dimensions: ${this.width}x${this.height}`);
        }

        // Read the flexible array of block offsets
        const numBlocks = this.width * this.height;
        this.blocks = new Array(numBlocks);
        for (let i = 0; i < numBlocks; i++) {
            const currentOffset = stream.getPos();
            const relativeOffset = stream.readUint32();
            // If the offset is 0, it means the block is empty
            this.blocks[i] = relativeOffset === 0 ? 0 : relativeOffset + currentOffset;
        }
    }

    isBlockBlank(x: number, y: number): boolean {
        const blockIndex = this.getBlockIndex(x, y);
        return this.blocks[blockIndex] === 0;
    }

    getBlockIndex(x: number, y: number): number {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return -1;
        }
        return y * this.width + x;
    }

    getBlockSize(x: number, y: number): number {
        const currentIndex = this.getBlockIndex(x, y);
        if (currentIndex === -1 || this.blocks[currentIndex] === 0) {
            return 0;
        }

        const currentOffset = this.blocks[currentIndex];

        // Look for the next non-zero block offset
        for (let i = currentIndex + 1; i < this.blocks.length; i++) {
            if (this.blocks[i] !== 0) {
                return this.blocks[i] - currentOffset;
            }
        }

        // If we didn't find any non-zero blocks after this one,
        // or if this is the last block, return 0
        return 0;
    }

    getBlockOffset(x: number, y: number): number {
        const index = this.getBlockIndex(x, y);
        return index >= 0 ? this.blocks[index] : 0;
    }
}