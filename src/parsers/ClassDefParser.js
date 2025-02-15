import { promises as fs } from 'fs';
import ClassDef from '../models/ClassDef.js';
import ClassDefResult from '../models/ClassDefResult.js';

/**
 * Parser for Revenant class definition (.def) files.
 * These files define the classes, stats, and types used in the game.
 */
class ClassDefParser {
    constructor() {
        this.result = new ClassDefResult();
        this.currentClass = null;
        this.currentSection = null;
        this.inStats = false;
        this.inObjStats = false;
    }

    /**
     * Load and parse a class definition file
     * @param {string} filePath - Path to the .def file
     * @returns {Promise<ClassDefResult|null>} Parsed class definitions or null if error
     */
    static async loadFile(filePath) {
        try {
            const content = await fs.readFile(filePath, 'utf8');
            return ClassDefParser.parse(content);
        } catch (error) {
            console.error('Error loading class definition file:', error);
            return null;
        }
    }

    /**
     * Parse class definition content
     * @param {string} content - Content of the .def file
     * @returns {ClassDefResult} Parsed class definitions
     */
    static parse(content) {
        const parser = new ClassDefParser();
        return parser.parseContent(content);
    }

    /**
     * Parse the content of a class definition file
     * @private
     */
    parseContent(content) {
        const lines = content.split('\n');
        lines.forEach(line => {
            line = line.trim();
            if (this.shouldProcessLine(line)) {
                this.parseLine(line);
            }
        });
        return this.result;
    }

    /**
     * Check if a line should be processed
     * @private
     */
    shouldProcessLine(line) {
        return line !== '' && !line.startsWith('//');
    }

    /**
     * Parse a single line from the file
     * @private
     */
    parseLine(line) {
        const parsers = [
            this.parseUniqueTypeId,
            this.parseClassDeclaration,
            this.parseSectionMarker,
            this.parseBeginEndMarker,
            this.parseContentLine
        ];

        for (const parser of parsers) {
            if (parser.call(this, line)) break;
        }
    }

    /**
     * Parse the unique type ID line
     * @private
     */
    parseUniqueTypeId(line) {
        if (line.startsWith('Unique Type ID')) {
            this.result.uniqueTypeId = parseInt(line.split('=')[1].trim(), 16);
            return true;
        }
        return false;
    }

    /**
     * Parse a class declaration line
     * @private
     */
    parseClassDeclaration(line) {
        if (line.startsWith('CLASS')) {
            this.currentClass = new ClassDef();
            this.currentClass.className = this.extractClassName(line);
            this.result.classes.set(this.currentClass.className, this.currentClass);
            this.resetParserState();
            return true;
        }
        return false;
    }

    /**
     * Extract class name from a class declaration line
     * @private
     */
    extractClassName(line) {
        const matches = line.match(/"([^"]+)"/);
        if (!matches) {
            throw new Error(`Invalid class declaration: ${line}`);
        }
        return matches[1];
    }

    /**
     * Reset parser state when starting a new class
     * @private
     */
    resetParserState() {
        this.currentSection = null;
        this.inStats = false;
        this.inObjStats = false;
    }

    /**
     * Parse a section marker line
     * @private
     */
    parseSectionMarker(line) {
        const sections = ['STATS', 'OBJSTATS', 'TYPES'];
        if (sections.includes(line)) {
            this.currentSection = line.toLowerCase();
            this.inStats = false;
            this.inObjStats = false;
            return true;
        }
        return false;
    }

    /**
     * Parse BEGIN/END markers
     * @private
     */
    parseBeginEndMarker(line) {
        if (line === 'BEGIN') {
            if (this.currentSection === 'stats') this.inStats = true;
            if (this.currentSection === 'objstats') this.inObjStats = true;
            return true;
        }
        if (line === 'END') {
            this.inStats = false;
            this.inObjStats = false;
            return true;
        }
        return false;
    }

    /**
     * Parse content lines within sections
     * @private
     */
    parseContentLine(line) {
        if (!this.currentClass) return false;

        const sectionParsers = {
            'stats': () => this.inStats && this.parseStatLine(line, false),
            'objstats': () => this.inObjStats && this.parseStatLine(line, true),
            'types': () => this.parseTypes(line)
        };

        const parser = sectionParsers[this.currentSection];
        if (parser) {
            return parser();
        }
        return false;
    }

    /**
     * Parse a stat line and add it to the specified collection
     * @private
     */
    parseStatLine(line, isObjStat = false) {
        const parts = line.split(' ').filter(part => part !== '');
        if (!this.currentClass) return false;

        if (isObjStat) {
            return this.currentClass.addObjStat(parts);
        }
        return this.currentClass.addStat(parts);
    }

    /**
     * Parse a type line
     * @private
     */
    parseTypes(line) {
        const parts = line.split(' ').filter(part => part !== '');
        if (this.currentClass) {
            return this.currentClass.addType(parts);
        }
        return false;
    }
}

export default ClassDefParser;

/* Original code from main.js
class ClassDefParser {
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
                    stats: [],        // Changed to array to maintain order
                    objStats: [],     // Changed to array to maintain order
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
*/