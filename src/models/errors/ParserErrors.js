export class ParserError extends Error {
    constructor(message, cause = null) {
        super(message);
        this.name = 'ParserError';
        this.cause = cause;
    }
}

export class InvalidFormatError extends ParserError {
    constructor(message) {
        super(message);
        this.name = 'InvalidFormatError';
    }
}

export class VersionError extends ParserError {
    constructor(message) {
        super(message);
        this.name = 'VersionError';
    }
}

export class DecompressionError extends ParserError {
    constructor(message) {
        super(message);
        this.name = 'DecompressionError';
    }
}

export class ValidationError extends ParserError {
    constructor(message) {
        super(message);
        this.name = 'ValidationError';
    }
}