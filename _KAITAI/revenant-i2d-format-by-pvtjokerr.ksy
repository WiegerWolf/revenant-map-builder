meta:
  id: images
  endian: le
  file-extension: i2d
  
seq:
  - id: magic
    contents: [0x43, 0x47, 0x53, 0x52]
    
  - id: file_header
    type: file_header_block
  - id: imagery_header
    type: imagery_header_block
  - id: imagery_header_meta
    type: imagery_header_meta
    repeat: expr
    repeat-expr: imagery_header.numstates
  - id: unknown_data
    size: imagery_header.headerize - 12 - 72 * imagery_header.numstates
  - id: offsets
    type: offset
    repeat: expr
    repeat-expr: file_header.top_bitmap_index
  - id: padding
    size: offsets[0].offset

  - id: bitmapdata
    type: bitmapdata
    
#    repeat: expr
 ##   repeat-expr: file_header.top_bitmap_index
  ##- id: numbers
    #size: 6829

types:

  rgba_color:
    seq: 
    - id: red
      type: u1
    - id: green
      type: u1
    - id: blue
      type: u1
    - id: alpha
      type: u1

  rgb_8_bit_color:
    seq:
      - id: color_data
        type: u2
    instances:
      red:
        value: (color_data & 0xF800) >> 11  # Extracts the top 5 bits
      green:
        value: (color_data & 0x07E0) >> 5   # Extracts the middle 6 bits
      blue:
        value: (color_data & 0x001F)        # Extracts the last 5 bits
      red_8_bit:
        value: (red * 255) / 31
      blue_8_bit:
        value: (blue * 255) / 31
      green_8_bit:
        value: (green * 255) / 63

  file_header_block:
    seq:
    - id: top_bitmap_index
      type: u2
      
    - id: compression_type
      type: u1
    - id: version
      type: u1
      
    - id: data_size
      type: u4
    - id: object_size
      type: u4
  imagery_header_block:
    seq:
    - id: headerize
      type: u4
    - id: imageryid
      type: u4
    - id: numstates
      type: u4
  imagery_header_meta:
    seq:
    - id: ascii
      type: u1
      repeat: expr # Repeat for a fixed number of times
      repeat-expr: 32
    - id: walkmap
      type: u4
    - id: imageryflags
      type: u4
    - id: aniflags
      type: u2
    - id: frames
      type: u2
    - id: widthmax
      type: s2  # Graphics maximum width (for IsOnScreen and refresh rects)
    
    - id: heightmax
      type: u2  # Graphics maximum height (for IsOnScreen and refresh rects)
    
    - id: regx
      type: s2  # Registration point x for graphics
    
    - id: regy
      type: u2  # Registration point y for graphics
    
    - id: regz
      type: u2  # Registration point z for graphics
    
    - id: animregx
      type: u2  # Registration point x of animation
    
    - id: animregy
      type: u2  # Registration point y of animation
    
    - id: animregz
      type: u2  # Registration point z of animation
    
    - id: wregx
      type: u2  # World registration x of walk and bounding box info
    
    - id: wregy
      type: u2  # World registration y of walk and bounding box info
    
    - id: wregz
      type: u2  # World registration z of walk and bounding box info
    
    - id: wwidth
      type: u2  # Object's world width for walk map and bound box
    
    - id: wlength
      type: u2  # Object's world length for walk map and bound box
    
    - id: wheight
      type: u2  # Object's world height for walk map and bound box
    
    - id: invaniflags
      type: u2  # Animation flags for inventory animation
    
    - id: invframes
      type: u2  # Numbera of frames of inventory animation
  offset:
    seq:
    - id: offset
      type: u4

  bitmapdata:
    seq:
    - id: width
      type: u4
      
    - id: height
      type: u4
      
    - id: regopointx
      type: u4
    - id: regopointy
      type: u4     
    - id: flags
      type: u4
    - id: drawingmode
      type: u4
    - id: keycolor
      type: u4
    - id: aliassize
      type: u4
    - id: aliasoffset
      type: u4
    - id: alphasize
      type: u4 
      
    - id: alpha
      type: u4    
      
    - id: zbuffersize
      type: u4   
    - id: zbuffer
      type: u4
    - id: normalsize
      type: u4      
    - id: normal
      type: u4
    - id: paletsize 
      type: u4

    - id: pallete
      type: u4

    - id: datasize
      type: u4  
    - id: chunk_decomp_flag
      type: u4
    - id: chunks_width
      type: u4
    - id: chunk_height
      type: u4
    - id: chunkoffsets
      type: u4
      repeat: expr # Repeat for a fixed number of times
      repeat-expr: chunks_width*chunk_height  # Repeat until end of stream
    - id: bitmap_data
      size: datasize

    - id: colors
      type: rgb_8_bit_color
      repeat: expr # Repeat for a fixed number of times
      repeat-expr: 256
    - id: colors2
      type: rgba_color
      repeat: expr # Repeat for a fixed number of times
      repeat-expr: 256

    