import { InputStream } from '../utils/InputStream';
import ObjectFlags from '../models/flags/ObjectFlags';

class DatParser {
    constructor(buffer) {
        this.stream = new InputStream(buffer);
    }

    parseHeader() {
        const signature = this.stream.readUint32();
        const version = this.stream.readUint32();
        const flags = this.stream.readUint32();
        const dataOffset = this.stream.readUint32();

        return {
            signature,
            version,
            flags,
            dataOffset
        };
    }

    parseObject() {
        const flags = new ObjectFlags(this.stream.readUint32());
        const classId = this.stream.readUint16();
        const instanceId = this.stream.readUint16();
        
        // Read object properties based on class definition
        const properties = {};
        
        // Position is common to all objects
        properties.x = this.stream.readInt32();
        properties.y = this.stream.readInt32();
        properties.z = this.stream.readInt32();

        return {
            flags,
            classId,
            instanceId,
            properties
        };
    }

    parseObjects(count) {
        const objects = [];
        for (let i = 0; i < count; i++) {
            objects.push(this.parseObject());
        }
        return objects;
    }

    parseSection() {
        const type = this.stream.readUint32();
        const size = this.stream.readUint32();
        const count = this.stream.readUint32();

        const data = this.parseObjects(count);

        return {
            type,
            size,
            count,
            data
        };
    }

    parse() {
        const header = this.parseHeader();
        const sections = [];

        // Parse sections until end of file
        while (!this.stream.eof()) {
            try {
                sections.push(this.parseSection());
            } catch (e) {
                if (e.name === 'EOFError') {
                    break;
                }
                throw e;
            }
        }

        return {
            header,
            sections
        };
    }
}

export default DatParser;