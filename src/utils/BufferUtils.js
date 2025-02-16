import { InputStream } from './InputStream.js';

export class BufferUtils {
    static createBufferSlice(sourceBuffer, offset, size) {
        const buffer = new ArrayBuffer(size);
        const data = new Uint8Array(buffer);
        const sourceData = new Uint8Array(sourceBuffer, offset, size);
        data.set(sourceData);

        return {
            buffer,
            stream: new InputStream(buffer)
        };
    }
}