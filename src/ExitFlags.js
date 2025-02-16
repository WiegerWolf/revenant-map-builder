// Exit flags

export const ExitFlags = {
    EX_ON: 1 << 0, // player is on exit strip
    EX_ACTIVATED: 1 << 1, // exit has been activated
    EX_FROMEXIT: 1 << 2 // player just came from another exit.. don't do anything
};
