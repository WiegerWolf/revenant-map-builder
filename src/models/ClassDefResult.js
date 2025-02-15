class ClassDefResult {
    constructor() {
        this.uniqueTypeId = null;
        this.classes = new Map();
    }

    getClass(className) {
        return this.classes.get(className.toUpperCase());
    }

    findTypeById(id) {
        for (const [className, classDef] of this.classes) {
            const type = classDef.types.find(t => t.id === id);
            if (type) {
                return {
                    className,
                    ...type
                };
            }
        }
        return null;
    }
}

export default ClassDefResult;