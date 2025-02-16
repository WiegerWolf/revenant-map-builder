import { promises as fs } from 'fs';

export class ClassDefParser {
    static async loadFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return ClassDefParser.parse(content);
        } catch (error) {
            console.error('Error loading class definition file:', error);
            debugger;
            return null;
        }
    }

    static parse(content) {
        const result = {
            uniqueTypeId: null,
            classes: new Map()
        };

        let currentClass = null;
        let currentSection = null;
        let inStats = false;
        let inObjStats = false;

        const lines = content.split('\n');

        for (let line of lines) {
            line = line.trim();

            if (line === '' || line.startsWith('//')) continue;

            if (line.startsWith('Unique Type ID')) {
                result.uniqueTypeId = parseInt(line.split('=')[1].trim(), 16);
                continue;
            }

            if (line.startsWith('CLASS')) {
                currentClass = {
                    className: line.split('"')[1],
                    stats: [], // Changed to array to maintain order
                    objStats: [], // Changed to array to maintain order
                    types: []
                };
                result.classes.set(currentClass.className, currentClass);
                currentSection = null;
                inStats = false;
                inObjStats = false;
                continue;
            }

            if (!currentClass) continue;

            if (line === 'STATS') {
                currentSection = 'stats';
                inStats = false;
                continue;
            } else if (line === 'OBJSTATS') {
                currentSection = 'objStats';
                inObjStats = false;
                continue;
            } else if (line === 'TYPES') {
                currentSection = 'types';
                continue;
            }

            if (line === 'BEGIN') {
                if (currentSection === 'stats') inStats = true;
                if (currentSection === 'objStats') inObjStats = true;
                continue;
            }
            if (line === 'END') {
                inStats = false;
                inObjStats = false;
                continue;
            }

            if (inStats && currentSection === 'stats') {
                const parts = line.split(' ').filter(part => part !== '');
                if (parts.length >= 5) {
                    currentClass.stats.push({
                        name: parts[0],
                        id: parts[1],
                        default: parseInt(parts[2]),
                        min: parseInt(parts[3]),
                        max: parseInt(parts[4])
                    });
                }
            } else if (inObjStats && currentSection === 'objStats') {
                const parts = line.split(' ').filter(part => part !== '');
                if (parts.length >= 5) {
                    currentClass.objStats.push({
                        name: parts[0],
                        id: parts[1],
                        default: parseInt(parts[2]),
                        min: parseInt(parts[3]),
                        max: parseInt(parts[4])
                    });
                }
            } else if (currentSection === 'types') {
                // Modified regex to make the stats values optional
                const match = line.match(/"([^"]+)"\s+"([^"]+)"\s+(0x[0-9a-fA-F]+)(?:\s+{([^}]*)})?(?:\s+{([^}]*)})?/);
                if (match) {
                    const values = match[4] ? match[4].split(',').map(v => parseInt(v.trim())) : [];
                    const extra = match[5] ? match[5].split(',').map(v => v.trim()) : [];

                    // Create mapped stats object only if stats exist
                    const mappedStats = {};
                    if (currentClass.stats.length > 0) {
                        currentClass.stats.forEach((stat, index) => {
                            if (index < values.length) {
                                mappedStats[stat.name] = {
                                    value: values[index],
                                    ...stat
                                };
                            }
                        });
                    }

                    // Create mapped objStats object only if objStats exist
                    const mappedObjStats = {};
                    if (currentClass.objStats.length > 0 && extra.length > 0) {
                        currentClass.objStats.forEach((stat, index) => {
                            if (index < extra.length) {
                                mappedObjStats[stat.name] = {
                                    value: parseInt(extra[index]) || extra[index],
                                    ...stat
                                };
                            }
                        });
                    }

                    currentClass.types.push({
                        name: match[1],
                        model: match[2],
                        id: parseInt(match[3], 16),
                        ...(Object.keys(mappedStats).length > 0 && { stats: mappedStats }),
                        ...(Object.keys(mappedObjStats).length > 0 && { objStats: mappedObjStats })
                    });
                }
            }
        }

        return result;
    }
}
