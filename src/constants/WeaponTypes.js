// Weapon type constants
const WeaponType = {
    WT_HAND: 0,        // Hand, claw, tail, etc.   
    WT_KNIFE: 1,       // Daggers, knives
    WT_SWORD: 2,       // Swords
    WT_BLUDGEON: 3,    // Clubs, maces, hammers
    WT_AXE: 4,         // Axes
    WT_STAFF: 5,       // Staffs, polearms, spears, etc.
    WT_BOW: 6,         // Bow
    WT_CROSSBOW: 7,    // Crossbow
    WT_LAST: 7         // Last weapon type
};

// Weapon mask constants
const WeaponMask = {
    WM_HAND: 0x0001,
    WM_KNIFE: 0x0002,
    WM_SWORD: 0x0004,
    WM_BLUDGEON: 0x0008,
    WM_AXE: 0x0010,
    WM_STAFF: 0x0020,
    WM_BOW: 0x0040,
    WM_CROSSBOW: 0x0080
};

module.exports = { WeaponType, WeaponMask };