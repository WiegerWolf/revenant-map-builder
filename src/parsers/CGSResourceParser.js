const { InputStream } = require('../utils/InputStream');
const { BufferUtils } = require('../utils/BufferUtils');

class CGSResourceParser {
    constructor(buffer) {
        this.stream = new InputStream(buffer);
    }

    parse() {
        const header = this.parseHeader();
        const resources = [];

        // Read resource entries
        for (let i = 0; i < header.numResources; i++) {
            const resource = this.parseResource();
            resources.push(resource);
        }

        return {
            header,
            resources
        };
    }

    parseHeader() {
        const signature = this.stream.readString();
        if (signature !== 'CGS') {
            throw new Error('Invalid CGS resource file');
        }

        return {
            signature,
            version: this.stream.readUint32(),
            numResources: this.stream.readUint32(),
            flags: this.stream.readUint32()
        };
    }

    parseResource() {
        const type = this.stream.readUint32();
        const id = this.stream.readUint32();
        const offset = this.stream.readUint32();
        const size = this.stream.readUint32();
        const flags = this.stream.readUint32();

        // Save current position
        const currentPos = this.stream.getPos();

        // Seek to resource data
        this.stream.setPos(offset);

        // Read resource data
        const data = BufferUtils.createBufferSlice(
            this.stream.dataView.buffer,
            this.stream.getPos(),
            size
        ).buffer;

        // Restore position
        this.stream.setPos(currentPos);

        return {
            type,
            id,
            offset,
            size,
            flags,
            data
        };
    }

    static ResourceTypes = {
        RT_BITMAP: 1,
        RT_SOUND: 2,
        RT_MUSIC: 3,
        RT_ANIMATION: 4,
        RT_SCRIPT: 5,
        RT_TEXT: 6
    };
}

module.exports = CGSResourceParser;