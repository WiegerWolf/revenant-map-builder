
export class InputStream {
    constructor(arrayBuffer) {
        this.dataView = new DataView(arrayBuffer);
        this.offset = 0;
    }

    checkBounds(bytesToRead) {
        if (this.offset + bytesToRead > this.dataView.byteLength) {
            throw new EOFError();
        }
    }

    readInt32() {
        this.checkBounds(4);
        const value = this.dataView.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readInt16() {
        this.checkBounds(2);
        const value = this.dataView.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint32() {
        this.checkBounds(4);
        const value = this.dataView.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    readUint16() {
        this.checkBounds(2);
        const value = this.dataView.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    readUint8() {
        this.checkBounds(1);
        const value = this.dataView.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    readString() {
        const length = this.readUint8();
        this.checkBounds(length);
        const bytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.offset, length);
        this.offset += length;
        return new TextDecoder('ascii').decode(bytes);
    }

    skip(bytes) {
        this.checkBounds(bytes);
        this.offset += bytes;
    }

    setPos(pos) {
        this.offset = pos;
    }

    getPos() {
        return this.offset;
    }

    eof() {
        return this.offset >= this.dataView.byteLength;
    }
}
export class EOFError extends Error {
    constructor(message = "End of file reached") {
        super(message);
        this.name = "EOFError";
    }
}

