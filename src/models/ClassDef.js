import Stat from './structures/Stat.js';
import ObjectType from './structures/ObjectType.js';

class ClassDef {
    constructor() {
        this.className = '';
        this.stats = [];
        this.objStats = [];
        this.types = [];
    }

    addStat(parts) {
        const stat = Stat.fromParts(parts);
        if (stat) {
            this.stats.push(stat);
            return true;
        }
        return false;
    }

    addObjStat(parts) {
        const stat = Stat.fromParts(parts);
        if (stat) {
            this.objStats.push(stat);
            return true;
        }
        return false;
    }

    addType(parts) {
        const type = ObjectType.fromParts(parts);
        if (type) {
            this.types.push(type);
            return true;
        }
        return false;
    }

    findTypeById(id) {
        return this.types.find(type => type.id === id);
    }

    getStatByName(name) {
        return this.stats.find(stat => stat.name === name);
    }

    getObjStatByName(name) {
        return this.objStats.find(stat => stat.name === name);
    }
}

export default ClassDef;