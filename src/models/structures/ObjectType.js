/**
 * Represents a type definition in the class definition file
 */
class ObjectType {
    constructor(name, id) {
        this.name = name;
        this.id = id;
    }

    static fromParts(parts) {
        if (parts.length < 2) return null;
        return new ObjectType(
            parts[0], 
            parseInt(parts[1], 16)
        );
    }
}

export default ObjectType;