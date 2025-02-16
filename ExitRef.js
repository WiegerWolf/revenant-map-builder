class ExitRef {
    constructor() {
        this.name = ''; // name of exit
        this.target = null; // position on level (S3DPoint)
        this.level = 0; // level to change to
        this.mapindex = 0; // object character is transfered to (usually another exit)
        this.ambient = 0; // level of ambient light
        this.ambcolor = null; // color of ambient light (SColor)
        this.next = null; // next in list
    }
}
