import { InputStream } from './InputStream';

class BufferUtils {
    /**
     * Creates a new ArrayBuffer and Stream from a slice of an existing buffer
     * @param {ArrayBuffer} sourceBuffer - The source ArrayBuffer to slice from
     * @param {number} offset - The starting offset in the source buffer
     * @param {number} length - The length of data to copy
     * @returns {{buffer: ArrayBuffer, stream: InputStream}} Object containing the new buffer and stream
     */
    static createBufferSlice(sourceBuffer, offset, length) {
        // Create a new buffer of the specified length
        const newBuffer = new ArrayBuffer(length);
        const newArray = new Uint8Array(newBuffer);

        // Copy the data from the source buffer
        const sourceArray = new Uint8Array(sourceBuffer, offset, length);
        newArray.set(sourceArray);

        // Create and return a new stream for the buffer
        const stream = new InputStream(newBuffer);

        return {
            buffer: newBuffer,
            stream: stream
        };
    }
}

export default BufferUtils;