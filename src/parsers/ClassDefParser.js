const { InputStream } = require('../utils/InputStream');

class ClassDefParser {
    constructor(buffer) {
        this.stream = new InputStream(buffer);
    }

    parse() {
        const numClasses = this.stream.readUint16();
        const classes = [];

        for (let i = 0; i < numClasses; i++) {
            const classData = this.parseClassDef();
            classes.push(classData);
        }

        return classes;
    }

    parseClassDef() {
        const name = this.stream.readString();
        const parentName = this.stream.readString();
        const numProperties = this.stream.readUint16();
        
        const properties = [];
        for (let i = 0; i < numProperties; i++) {
            properties.push(this.parseProperty());
        }

        return {
            name,
            parentName,
            properties
        };
    }

    parseProperty() {
        const name = this.stream.readString();
        const type = this.stream.readUint8();
        const offset = this.stream.readUint16();

        return {
            name,
            type,
            offset
        };
    }
}

module.exports = ClassDefParser;