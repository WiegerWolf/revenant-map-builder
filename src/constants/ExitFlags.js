// Exit states
const ExitStates = {
    EXIT_CLOSED: 0,
    EXIT_OPEN: 1,
    EXIT_CLOSING: 2,
    EXIT_OPENING: 3
};

// Exit flags
const ExitFlags = {
    EX_ON: 1 << 0,        // player is on exit strip
    EX_ACTIVATED: 1 << 1,  // exit has been activated
    EX_FROMEXIT: 1 << 2   // player just came from another exit.. don't do anything
};

module.exports = { ExitStates, ExitFlags };