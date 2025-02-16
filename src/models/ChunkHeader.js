export class ChunkHeader {
    constructor(stream) {
        // Read dimensions
        this.width = stream.readUint32();
        this.height = stream.readUint32();

        // Calculate array sizes
        this.numBlocks = this.width * this.height;
        
        // Read the chunk masks (one bit per block indicating if it's blank)
        const maskBytes = Math.ceil(this.numBlocks / 8);
        this.chunkMasks = new Uint8Array(maskBytes);
        for (let i = 0; i < maskBytes; i++) {
            this.chunkMasks[i] = stream.readUint8();
        }

        // Read block offsets and sizes
        this.blockOffsets = new Array(this.numBlocks);
        this.blockSizes = new Array(this.numBlocks);

        for (let i = 0; i < this.numBlocks; i++) {
            if (!this.isBlockBlank(i % this.width, Math.floor(i / this.width))) {
                this.blockOffsets[i] = stream.readUint32();
                this.blockSizes[i] = stream.readUint32();
            }
        }
    }

    isBlockBlank(x, y) {
        const blockIndex = y * this.width + x;
        const maskByte = this.chunkMasks[Math.floor(blockIndex / 8)];
        const maskBit = 1 << (blockIndex % 8);
        return (maskByte & maskBit) !== 0;
    }

    getBlockOffset(x, y) {
        return this.blockOffsets[y * this.width + x] || 0;
    }

    getBlockSize(x, y) {
        return this.blockSizes[y * this.width + x] || 0;
    }
}