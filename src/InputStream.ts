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

    /**
     * Prints a hexadecimal dump of the buffer contents for debugging purposes
     * @param start - Starting offset (optional, defaults to 0)
     * @param length - Number of bytes to dump (optional, defaults to 256)
     * @param bytesPerLine - Number of bytes to show per line (optional, defaults to 16)
     */
    dump(start: number = 0, length: number = 256, bytesPerLine: number = 16): void {
        const startPos = start;
        const endPos = Math.min(startPos + length, this.dataView.byteLength);
        const bytes = new Uint8Array(this.dataView.buffer, this.dataView.byteOffset + startPos, endPos - startPos);

        // Show current position indicator if printing from start of buffer
        const showPositionIndicator = start === 0 && this.offset < endPos;

        // Print header with adjusted spacing
        console.log('\x1b[36m' + '          00 01 02 03 04 05 06 07  08 09 0A 0B 0C 0D 0E 0F    ASCII             UINT32LE' + '\x1b[0m');
        console.log('\x1b[36m' + '          -----------------------------------------------    ----------------  ----------------------------------------------' + '\x1b[0m');

        for (let i = 0; i < bytes.length; i += bytesPerLine) {
            // Print offset with cyan color
            const offset = (startPos + i).toString(16).padStart(8, '0');
            let hexLine = `\x1b[36m${offset}\x1b[0m: `;
            let asciiLine = '  ';
            let uint32Line = '  ';

            // Print hex values
            for (let j = 0; j < bytesPerLine; j++) {
                if (i + j < bytes.length) {
                    const byte = bytes[i + j];
                    const isCurrentPos = showPositionIndicator && (startPos + i + j === this.offset);
                    const hexValue = byte.toString(16).padStart(2, '0');
                    
                    let colorCode = '';
                    // Color coding based on byte ranges
                    if (byte === 0) {
                        colorCode = '\x1b[90m'; // Gray for null bytes
                    } else if (byte < 32) {
                        colorCode = '\x1b[31m'; // Red for control characters
                    } else if (byte >= 32 && byte <= 126) {
                        colorCode = '\x1b[32m'; // Green for printable ASCII
                    } else if (byte === 127) {
                        colorCode = '\x1b[31m'; // Red for DEL
                    } else {
                        colorCode = '\x1b[33m'; // Yellow for extended ASCII
                    }

                    if (isCurrentPos) {
                        // Current position: inverse colors + bold
                        hexLine += `\x1b[1m\x1b[7m${colorCode}${hexValue}\x1b[0m `;
                        asciiLine += `\x1b[1m\x1b[7m${byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.'}\x1b[0m`;
                    } else {
                        // Normal display with color
                        hexLine += `${colorCode}${hexValue}\x1b[0m `;
                        asciiLine += byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : '.';
                    }

                    // Add uint32 values every 4 bytes
                    if (j % 4 === 3) {
                        if (i + j >= 3 && i + j < bytes.length) {
                            const uint32Value = new DataView(bytes.buffer, bytes.byteOffset + i + j - 3, 4).getUint32(0, true);
                            // Only show decimal value in magenta
                            uint32Line += `\x1b[35m${uint32Value.toString().padStart(10)}\x1b[0m`;
                            if (j < bytesPerLine - 4) uint32Line += '  ';
                        }
                    }
                } else {
                    hexLine += '   ';
                    asciiLine += ' ';
                }
                
                // Add extra space after 8 bytes for readability
                if (j === 7) {
                    hexLine += ' ';
                }
            }

            console.log(hexLine + asciiLine + uint32Line);
        }
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

