# Revenant Game Data Parser

A comprehensive Node.js parser for Revenant game data files, including IMAGERY.DAT, map files, and class definitions.

## Overview

This project provides tools to parse and extract data from various file formats used in the game Revenant. It includes parsers for:

- IMAGERY.DAT (game imagery and animation data)
- Map DAT files (level and object data)
- Class definitions (object types and properties)
- Resource files (textures and sprites)

## Features

- [x] Parse IMAGERY.DAT file structure
- [x] Extract and convert bitmap data to BMP format  (partially)
- [x] Parse map files with object hierarchies
- [x] Support for various object types (characters, items, weapons, etc.)
- [x] Handle compressed and chunked bitmap data  (partially)
- [] Convert between different color formats (8-bit, 15-bit, 16-bit, 24-bit, 32-bit)
- [x] File caching system for improved performance and for dealing with case-insensitive file systems

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

## Usage

Your best bet right now is to dive into `main.js` and see how it's used.
## File Structure Support

### IMAGERY.DAT
- [x] Header information
- [x] Imagery entries
- [x] State data
- [x] Animation data

### Map DAT Files
- [x] Object definitions
- [x] Position data
- [x] State information
- [] Inventory systems (partially)
- [x] Character data
- [x] Container data
- [] Exit data

### Class Definitions (class.def files)
- [x] Object types
- [x] Stats
- [x] Properties
- [x] Type hierarchies

## Data Types

The parser supports various data types used in the game:

- [x] Bitmaps (various color depths)
- [] 3D points
- [] Colors
- [] Light definitions
- [x] Object flags
- [x] Animation flags
- [x] Draw mode flags

## Output

The parser can:
- Extract bitmap data to BMP files, including chunked and compressed data
- Create JSON representations of game MAP data
- Generate detailed object hierarchies
- Convert between various data formats

## Requirements

- Node.js 18.0 or higher
- Original game files in `_INSTALLED_GAME/Revenant` directory
- Sufficient disk space for extracted data in `_OUTPUT` directory

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Original Revenant game developers
- Game modding community in [Accursed Farms forums](https://www.accursedfarms.com/forums/topic/3301-revenant-maps/)
- Contributors to the reverse engineering effort

## Notes

- This parser is for educational purposes
- Requires original game files to function
- Some features are still under development and may not be fully functional