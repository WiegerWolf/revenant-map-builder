meta:
  id: revenant_map_sector
  file-extension: dat
  endian: le

doc: |
   REVENANT MAP SECTOR FILE FORMAT
   This document is intended for those who wish to make large 
   scale map editors for Revenant custom modules. Currently Revenant 
   does not have a large scale map editor, which makes it difficult to 
   realize the grand scope and vision of many potential game designer worlds.
   With the ability to directly generate Revenant sector files, the aspiring 
   designer can build his own tools, or use third party tools to generate
   the large areas in his main map.
   
   Revenant Maps and Sectors
   After unzipping a revenant RVM module file, you will find a subdirectory 
   in the module called MAP. This directory will typically contain a large 
   number of Revenant map sector files. These files describe the objects 
   and tiles appearing at a specific location at a specific level in a map 
   for that module. In revenant, game maps are divided up into levels, and 
   sectors. A level is complete and separate continuous map. A revenant 
   module may contain up to 255 levels. A sector is a 1024 by 1024 map unit 
   grid within a level map that describes every object contained within in. 
   Each sector is stored in a separate file, with the name of the file 
   indicating the level number and the x,y sector location in that level.
   
   Sector filenames are formatted as follows: lv_sx_sy.DAT
   Where 'lv' is a level number from 0 to 255, 'sx' and 'sy' are the x,y 
   position of the sector in map units divided by 1024. Since maps have a 
   maximum size of 32,768 x 32,768 units, the x,y sector numbers go
   from 0 to 31.
   
   For example, a file with the filename: 2_5_15.DAT Would contain all the 
   tiles, characters, gold, etc. for the section of map level 2 
   from x = 5120 (5 * 1024) to 6143, y =  15360 (15 * 1024) to 16383.
   
   Map Sector File Format
   The basic format of a map sector file is simply a small file header, 
   followed by a streamed list of unordered 'objects' that are within that 
   sector. Objects are considered to be in the sector in which their 
   registration point (the position shown in the game editor when moving 
   the object) is between the minimum and maximum x,y map units for that 
   sector. This means that the edges of objects can overlap into other 
   sectors (and usually do), since the registration point of an object 
   is typically near the center of the object.
   
   NOTE: object x,y positions stored in object records do not necessarily 
   have to be within the sector boundries.  The upper bits of the object 
   position are set when the object is loaded so the object will always be 
   within the sector it was loaded from regardless of what it's x,y position 
   is in its object record. This means that sector files can be renamed to 
   'move' a sector to a new map location. The original revenant large scale 
   maps were created using this renaming scheme.

seq:
  - id: magic
    contents: [0x4d, 0x41, 0x50, 0x20]
    doc: |
      Four character code signature "MAP " (space at end)
  - id: header
    type: sector_header
    doc: |
      After the header, the objects are stored in no particular order..

  - id: objects
    type: object_record
    repeat: expr
    repeat-expr: header.obj_count
    doc: |
      All object records begin with the same common object header.
      This header contains the basic object type, the size of the 
      object data block, and also the size of the object inventory block.
      These block size can be used to skip objects in a file, or to check to 
      see if an overflow or underflow has occured when reading object data.

types:
  str_with_len:
    seq:
      - id: len
        type: u1
          
      - id: value
        type: str
        size: len
        encoding: KOI8-R

  sector_header:
    seq:
      - id: version
        type: u4
        valid:
          any-of: [12, 13, 15]
        doc: |
          The version number of the file (currently 15)
      - id: obj_count
        type: u4
        doc: |
          Number of map objects in the file

  object_record:
    seq:
      - id: obj_version
        type: s2
        if: '_root.header.version >= 8'
        doc: |
          Object version number. This is used internally for versioning of 
          object data (i.e. when we add new data to an object, we increment 
          this value so that the stream functions can read older data 
          files correctly). If this value is -1, this means that there is 
          an empty space in the sector at this index. No more data is read 
          after a -1 place holder (the next object record begins immediately 
          after the -1).

      - id: obj_data
        if: obj_version != -1
        type: common_obj_header
  
  common_obj_header:
    seq:
      - id: obj_class
        type: u2
        enum: obj_class
        doc: |
          The class of the object. This is the same as the classes 
          in the CLASS.DEF file
      - id: unique_id
        type: u4
        doc: |
          The object unique id value for this object from the 
          CLASS.DEF file. (The 0xFFFFFFF values).
          The unique id is the tag used to lookup what kind
          of object this is in the game objects list. Each
          object of any given type (i.e. Greater Healing
          Potion) has a separate unique id.
      - id: obj_data_size
        type: u2
        doc: |
          Size of the object's data block following the common object header.
          The includes ONLY the data for the object itself, not it's 
          inventory list.
      - id: block_size
        type: u2
        doc: |
          Complete size of the object following the common object header 
          including both the object data and it's following inventory data.
          If no inventory data is stored, this will be identical 
          to obj_data_size
          
      - id: object_data
        size: obj_data_size
        if: obj_data_size > 0
        type:
          switch-on: obj_class
          cases:
            'obj_class::character': object_data_block_for_character
            'obj_class::container': object_data_block_for_container
            _: object_data_block_for_rest
  
  object_data_block_for_rest:
    seq:
    - id: base_obj_data
      type: common_base_object_data
      
    - id: base_obj_data_after_pos
      type: common_base_object_data_after_pos(base_obj_data.flags)
      
  object_data_block_for_container:
    seq:
    - id: base_obj_data
      type: common_base_object_data
      
    - id: velocity_data
      type: velocity_object_data_block
      
    - id: base_obj_data_after_pos
      type: common_base_object_data_after_pos(base_obj_data.flags)
      
    - id: num_items
      type: u4
      doc: |
        INVENTORY DATA BLOCK
        The inventory data block is simply the number of items in the object's 
        inventory, followed by each item in the inventory. If there are NO 
        items in the inventory, the inventory block will not be stored, and 
        the ObjDataSize will be identical to the BlockSize in the object header.
        DWORD	NumItems		Number of items in the inventory for this object
        This is then followed by each of the objects that are contained in 
        this object's inventory.  NOTE: inventory's can be nested arbitrarily 
        deep, but except for players (which are NOT stored in sector files), 
        the inventory of most objects in the game will only be 1 level deep.
        Typically only monsters and container objects have inventories.
      
  common_base_object_data:
    seq:
    - id: name
      type: str_with_len
      doc: |
        The name of the object. If this is blank, the name of the object 
        type will be used for this object.
      
    - id: flags
      type: object_flags
      doc: |
        The flags for this object. See the flag table below for 
        descriptions of these flags.
        
    - id: pos_x
      type: s4
      valid:
        min: 0
        max: 32768
      doc: |
        The map unit location of the object. This is an absolute position 
        relative to the origin of the map (top corner of map in the editor 
        with x going down and right, and y going down and left). The x and 
        y positions of the object should be within the current sector boundry
        (though they don't have to be). X,Y values can be from 0 to 32768, 
        and the Z value can be from 0 to 511. Values of Z below 0, or 
        above 511 will NOT work.
    - id: pos_y
      type: s4
      valid:
        min: 0
        max: 32768
    - id: pos_z
      type: s4
      valid:
        # min: 0
        max: 511
        
  common_base_object_data_after_pos:
    params:
      - id: flags
        type: object_flags
        
    seq:
    - id: state
      type: u2
      doc: |
        The current display or animation state for this object. This is the 
        same as the index set by the STATE command in the editor.
      
    - id: invent_num
      type: s2
      doc: |
        The index in the parent objects inventory this object is at. 
        This is the 'slot number' the object is in in the inventory panel 
        if the object is in an inventory.
        
    - id: invent_index
      type: s2
      doc: |
        This is the number of the object in the parent objects inventory list.
        
    - id: shadow_map_id
      type: s4
      doc: |
        NOT USED
    
    - id: rot_x
      type: u1
      valid:
        min: 0
        max: 255
      doc: |
        0-255 rotatation angles for 3D objects. The RotZ value is the facing 
        angle of the object used by	the FACE command.
    - id: rot_y
      type: u1
      valid:
        min: 0
        max: 255
    - id: rot_z
      type: u1
      valid:
        min: 0
        max: 255  
        
    - id: map_index
      type: s4
      doc: |
        This is the object's unqiue id map index. Each object, when added 
        to a map, is given a uinique id generated by a random number generator 
        that uniquely identifies it in the game. This is used as the primary 
        object id in network game messages as well.
      
  velocity_object_data_block:
    seq:
    - id: vel_x
      type: s4
      doc: |
        The velocity of the object in map units. THIS IS ONLY STORED IF 
        THE OF_MOBILE FLAG FOR THE OBJECT IS SET. SKIP THIS IF AN OBJECT 
        IS NOT MOBILE. This value is a fixed point 16.16 value.
        
        NOTE: I don't think the above note about "OF_MOBILE" flag is true.
        I tried implementing it and it made things misalign further down
        the struct (basically for all characters 12 bytes were "missing"
        between pos and state, and that's exactly 3 ints from vec_xyz).
        So regardless of of_immobile flag, we still observe 3 vec_*
        parameters here. Also, there's no such thing as "OF_MOBILE" flag.
    - id: vel_y
      type: s4
    - id: vel_z
      type: s4
      
  object_data_block_for_character:
    seq:
    - id: complex_obj_ver
      type: u1
      valid:
        eq: 1
      doc: |
        The version of the complex object system for this	character.
        Complex objects are used to implement characters and players in 
        the game. This is always 1.
        
    - id: char_obj_ver
      type: u1
      doc: |
        The character object version. This version number is supposed to be
        always 4, but it isn't, not sure why.

    - id: base_obj_data
      type: common_base_object_data
      
    - id: velocity_data
      type: velocity_object_data_block
      
    - id: base_obj_data_after_pos
      type: common_base_object_data_after_pos(base_obj_data.flags)
        
    - id: frame
      type: s2
      doc: |
        Current animation frame this object is playing.
    - id: frame_rate
      type: s2
      doc: |
        NOT USED (always set to 1).
        
    - id: group
      type: u1
      doc: |
        The group number of this object used in the editor with the GROUP 
        command and the grouping system.
        
    - id: object_data_stats
      type: object_data_block_stats
      
    - id: action_code
      type: u1
      doc: |
        Internal action id number. Use 1 when storing your own characters.
    
    - id: action_name
      type: str_with_len
      doc: |
        Name of action character is currently performing. This is the same 
        as the state (or animation) name used in the editor. The default 
        string is "walk" for NPC's and "combat" for monsters. These action
        names will put the character/monster in its neutral state.

    - id: last_health_ts
      type: u4
      doc: |
        Timestamp of last health increase. This is used to update the 
        health for monsters which may have been unloaded for a certain 
        amount of game time.
    - id: last_fatigue_ts
      type: u4
      doc: |
        Timestamp of last fatigue increase.
    - id: last_mana_ts
      type: u4
      doc: |
        Timestamp of last mana increase.
    - id: last_poison_ts
      type: u4
      doc: |
        Timestamp of last poison damage
        
    - id: tel_x
      type: s4
      doc: |
        Teleport X, Y, Z (don't use)
    - id: tel_y
      type: s4
      doc: |
        Teleport X, Y, Z (don't use)
    - id: tel_z
      type: s4
      doc: |
        Teleport X, Y, Z (don't use)
    - id: tel_level
      type: s4
      doc: |
        Teleport level (don't use)
      
  object_data_block_stats:
    seq:  
    - id: num_stats
      type: u1
      doc: |
        Object statistics are listed at this point in the BASE OBJECT DATA 
        portion of the object data. The object stats available for an object 
        are listed in the CLASS.DEF file in the OBJSTAT sections. The game 
        uses a four character code for each stat to match the stats in the 
        sector files to the stats in the game.

    - id: stats
      type: object_stat
      if: num_stats > 0
      repeat: expr
      repeat-expr: num_stats
      
  object_stat:
    seq:
      - id: stat_value
        type: s4
        doc: |
          Stat value for this stat.  This may be the health, max health, etc
        
      - id: encrypted_id
        type: u4
        doc: |
          This is the weakly encrypted StatID. Simply `and` this value with 
          0x7F7F7F7F and you will get the four character stat codes 
          listed in the CLASS.DEF file.
    
  object_flags:
    seq:
    - id: of_immobile
      type: b1
      doc: Not affected by gravity etc (the velocity will be stored if set)
    
    - id: of_editorlock
      type: b1
      doc: Object is locked down (can't move in editor)
    
    - id: of_light
      type: b1
      doc: Object generates light (light data record will be stored for obj)
    
    - id: of_moving
      type: b1
      doc: Object is a moving object (characters, exits, missiles, etc.)
    
    - id: of_animating
      type: b1
      doc: Has animating imagery (animator pointer is set)
    
    - id: of_ai
      type: b1
      doc: Object has A.I.
    
    - id: of_disabled
      type: b1
      doc: Object A.I. is disabled
    
    - id: of_invisible
      type: b1
      doc: Not visible in map pane during normal play
    
    - id: of_editor
      type: b1
      doc: Is editor only object
    
    - id: of_foreground
      type: b1
      doc: Makes a normally background object a foreground object
    
    - id: of_seldraw
      type: b1
      doc: Editor is currently manipulating object
    
    - id: of_reveal
      type: b1
      doc: Player needs to see behind object (Diablo style shutter draw)
    
    - id: of_kill
      type: b1
      doc: Suicidal (tells system to kill object next frame)
    
    - id: of_generated
      type: b1
      doc: Created by map generator. Replaced when MAPGEN used.
    
    - id: of_animate
      type: b1
      doc: Call the objects Animate() func AND create object animators
    
    - id: of_pulse
      type: b1
      doc: Call the object Pulse() function
    
    - id: of_weightless
      type: b1
      doc: Object can move, but is not affected by gravity
    
    - id: of_complex
      type: b1
      doc: Object is a complex object
    
    - id: of_notify
      type: b1
      doc: Notify object of a system change (see notify codes below)
    
    - id: of_nonmap
      type: b1
      doc: Not created, deleted, saved, or loaded by map (see below)
    
    - id: of_onexit
      type: b1
      doc: Object is currently on an exit (used to prevent exit loops)
    
    - id: of_pause
      type: b1
      doc: Script is paused
    
    - id: of_nowalk
      type: b1
      doc: Don't use walk map for this tile
    
    - id: of_paralize
      type: b1
      doc: Freeze the object in mid-animation
    
    - id: of_nocollision
      type: b1
      doc: Let the object go through boundaries
    
    - id: of_iced
      type: b1
      doc: Used to know when to end the iced effect
    
    - id: of_virgin
      type: b1
      doc: Never known the touch of a man (this object hasn't been modified in an actual game)
    
    - id: of_loading
      type: b1
      doc: Tells object constructors and ClearObject() function that this object is being streamed
    
    - id: of_shadow
      type: b1
      doc: The light for this object should cast shadows
    
    - id: of_background
      type: b1
      doc: Makes a normally foreground object a background object
    
    - id: of_inventory
      type: b1
      doc: This is an inventory object
    
    - id: of_calledpredel
      type: b1
      doc: We already called the PreDelete() function for this object

enums:
  obj_class:
    0: item
    1: weapon
    2: armor
    3: talisman
    4: food
    5: container
    6: lightsource
    7: tool
    8: money
    9: tile
    10: exit
    11: player
    12: character
    13: trap
    14: shadow
    15: helper
    16: key
    17: invcontainer
    18: poison
    19: unused1
    20: unused2
    21: ammo
    22: scroll
    23: rangedweapon
    24: unused3
    25: effect
    26: mapscroll
