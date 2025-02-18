import { InputStream } from './InputStream';

export class ChunkHeader {
    readonly blockWidth: number = 64;
    readonly blockHeight: number = 64;
    readonly compressedType: number;
    readonly widthInBlocks: number;
    readonly heightInBlocks: number;
    readonly blockOffsets: number[];

    constructor(stream: InputStream) {
        // Read the fixed part of the header
        this.compressedType = stream.readUint32(); // Compressed flag
        this.widthInBlocks = stream.readInt32(); // Width in blocks
        this.heightInBlocks = stream.readInt32(); // Height in blocks

        // Validate dimensions
        if (this.widthInBlocks <= 0 || this.heightInBlocks <= 0 ||
            this.widthInBlocks > 128 || this.heightInBlocks > 128) {
            throw new Error(`Invalid chunk header dimensions: ${this.widthInBlocks}x${this.heightInBlocks}`);
        }

        // Read the flexible array of block offsets
        const numBlocks = this.widthInBlocks * this.heightInBlocks;
        this.blockOffsets = new Array(numBlocks);
        for (let i = 0; i < numBlocks; i++) {
            const currentOffset = stream.getPos();
            const relativeOffset = stream.readUint32();
            // If the offset is 0, it means the block is empty
            this.blockOffsets[i] = relativeOffset === 0 ? 0 : relativeOffset + currentOffset;
        }
    }

    isBlockBlank(x: number, y: number): boolean {
        const blockIndex = this.getBlockIndex(x, y);
        return this.blockOffsets[blockIndex] === 0;
    }

    getBlockIndex(x: number, y: number): number {
        if (x < 0 || x >= this.widthInBlocks || y < 0 || y >= this.heightInBlocks) {
            return -1;
        }
        return y * this.widthInBlocks + x;
    }

    getBlockSize(x: number, y: number): number {
        const currentIndex = this.getBlockIndex(x, y);
        if (currentIndex === -1 || this.blockOffsets[currentIndex] === 0) {
            return 0;
        }

        const currentOffset = this.blockOffsets[currentIndex];

        // Look for the next non-zero block offset
        for (let i = currentIndex + 1; i < this.blockOffsets.length; i++) {
            if (this.blockOffsets[i] !== 0) {
                return this.blockOffsets[i] - currentOffset;
            }
        }

        // If we didn't find any non-zero blocks after this one,
        // or if this is the last block, return 0
        return 0;
    }

    getBlockOffset(x: number, y: number): number {
        const index = this.getBlockIndex(x, y);
        return index >= 0 ? this.blockOffsets[index] : 0;
    }
}