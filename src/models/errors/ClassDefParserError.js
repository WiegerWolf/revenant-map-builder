class ClassDefParserError extends Error {
    constructor(message, line, section) {
        super(message);
        this.name = 'ClassDefParserError';
        this.line = line;
        this.section = section;
    }
}

export default ClassDefParserError;