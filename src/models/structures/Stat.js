/**
 * Represents a stat definition in the class definition file
 */
class Stat {
    constructor(name, id, defaultValue, min, max) {
        this.name = name;
        this.id = id;
        this.default = defaultValue;
        this.min = min;
        this.max = max;
    }

    static fromParts(parts) {
        if (parts.length < 5) return null;
        return new Stat(
            parts[0],
            parts[1],
            parseInt(parts[2]),
            parseInt(parts[3]),
            parseInt(parts[4])
        );
    }
}

export default Stat;