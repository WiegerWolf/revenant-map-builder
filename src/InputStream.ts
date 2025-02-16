/**
 * Interface defining the contract for reading various data types from an input stream
 */
interface IInputStream {
    /** Reads a 32-bit signed integer */
    readInt32(): number;
    /** Reads a 16-bit signed integer */
    readInt16(): number;
    /** Reads a 32-bit unsigned integer */
    readUint32(): number;
    /** Reads a 16-bit unsigned integer */
    readUint16(): number;
    /** Reads an 8-bit unsigned integer */
    readUint8(): number;
    /** Reads a length-prefixed ASCII string */
    readString(): string;
    /** Skips a specified number of bytes in the stream */
    skip(bytes: number): void;
    /** Sets the current position in the stream */
    setPos(pos: number): void;
    /** Gets the current position in the stream */
    getPos(): number;
    /** Checks if the end of the stream has been reached */
    eof(): boolean;
}

export class InputStream implements IInputStream {
    private dataView: DataView;
    private offset: number;

    /**
     * Creates a new InputStream instance
     * @param arrayBuffer - The ArrayBuffer to read from
     */
    constructor(arrayBuffer: ArrayBuffer) {
        this.dataView = new DataView(arrayBuffer);
        this.offset = 0;
    }

    /**
     * Check if there are enough bytes left in the buffer to read the requested number of bytes
     * @param bytesToRead - Number of bytes to read
     * @throws {EOFError} if there are not enough bytes left in the buffer
     * @private
     */
    private checkBounds(bytesToRead: number): void {
        if (this.offset + bytesToRead > this.dataView.byteLength) {
            throw new EOFError();
        }
    }

    /**
     * Reads a 32-bit signed integer from the stream in little-endian format
     * @returns A 32-bit signed integer
     * @throws {EOFError} if there are not enough bytes left in the buffer
     */
    readInt32(): number {
        this.checkBounds(4);
        const value = this.dataView.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }

    /**
     * Reads a 16-bit signed integer from the stream in little-endian format
     * @returns A 16-bit signed integer
     * @throws {EOFError} if there are not enough bytes left in the buffer
     */
    readInt16(): number {
        this.checkBounds(2);
        const value = this.dataView.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }

    /**
     * Reads a 32-bit unsigned integer from the stream in little-endian format
     * @returns A 32-bit unsigned integer
     * @throws {EOFError} if there are not enough bytes left in the buffer
     */
    readUint32(): number {
        this.checkBounds(4);
        const value = this.dataView.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }

    /**
     * Reads a 16-bit unsigned integer from the stream in little-endian format
     * @returns A 16-bit unsigned integer
     * @throws {EOFError} if there are not enough bytes left in the buffer
     */
    readUint16(): number {
        this.checkBounds(2);
        const value = this.dataView.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }

    /**
     * Reads an 8-bit unsigned integer from the stream
     * @returns An 8-bit unsigned integer
     * @throws {EOFError} if there are not enough bytes left in the buffer
     */
    readUint8(): number {
        this.checkBounds(1);
        const value = this.dataView.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    /**
     * Reads a length-prefixed ASCII string from the stream.
     * The first byte specifies the length of the string.
     * @returns The decoded ASCII string
     * @throws {EOFError} if there are not enough bytes left in the buffer
     */
    readString(): string {
        const length = this.readUint8();
        this.checkBounds(length);
        const bytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + this.offset, length);
        this.offset += length;
        return new TextDecoder('ascii').decode(bytes);
    }

    /**
     * Skips a specified number of bytes in the stream
     * @param bytes - The number of bytes to skip
     * @throws {EOFError} if there are not enough bytes left in the buffer
     */
    skip(bytes: number): void {
        this.checkBounds(bytes);
        this.offset += bytes;
    }

    /**
     * Sets the current position in the stream
     * @param pos - The position to set the stream to
     */
    setPos(pos: number): void {
        this.offset = pos;
    }

    /**
     * Gets the current position in the stream
     * @returns The current byte offset in the stream
     */
    getPos(): number {
        return this.offset;
    }

    /**
     * Checks if the end of the stream has been reached
     * @returns true if the current position is at or beyond the end of the stream
     */
    eof(): boolean {
        return this.offset >= this.dataView.byteLength;
    }
}

/**
 * Custom error class for handling end-of-file conditions
 */
export class EOFError extends Error {
    /**
     * Creates a new EOFError instance
     * @param message - Optional error message, defaults to "End of file reached"
     */
    constructor(message: string = "End of file reached") {
        super(message);
        this.name = "EOFError";
    }
}

