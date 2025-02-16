interface IInputStream {
    readInt32(): number;
    readInt16(): number;
    readUint32(): number;
    readUint16(): number;
    readUint8(): number;
    readString(): string;
    skip(bytes: number): void;
    setPos(pos: number): void;
    getPos(): number;
    eof(): boolean;
}

export class InputStream implements IInputStream {
    private dataView: DataView;
    private offset: number;

    constructor(arrayBuffer: ArrayBuffer) {
        this.dataView = new DataView(arrayBuffer);
        this.offset = 0;
    }

    /**
     * Check if there are enough bytes left in the buffer to read the requested number of bytes
     * @param bytesToRead Number of bytes to read
     * @throws EOFError if there are not enough bytes left in the buffer
     */
    private checkBounds(bytesToRead: number): void {
        if (this.offset + bytesToRead > this.dataView.byteLength) {
            throw new EOFError();
        }
    }

    readInt32(): number {
        this.checkBounds(4);
        const value = this.dataView.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readInt16(): number {
        this.checkBounds(2);
        const value = this.dataView.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint32(): number {
        this.checkBounds(4);
        const value = this.dataView.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readUint16(): number {
        this.checkBounds(2);
        const value = this.dataView.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint8(): number {
        this.checkBounds(1);
        const value = this.dataView.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readString(): string {
        const length = this.readUint8();
        this.checkBounds(length);
        const bytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.offset, length);
        this.offset += length;
        return new TextDecoder('ascii').decode(bytes);
    }

    skip(bytes: number): void {
        this.checkBounds(bytes);
        this.offset += bytes;
    }

    setPos(pos: number): void {
        this.offset = pos;
    }

    getPos(): number {
        return this.offset;
    }

    eof(): boolean {
        return this.offset >= this.dataView.byteLength;
    }
}

export class EOFError extends Error {
    constructor(message: string = "End of file reached") {
        super(message);
        this.name = "EOFError";
    }
}

