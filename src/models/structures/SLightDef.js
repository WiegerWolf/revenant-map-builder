import LightFlags from '../flags/LightFlags';
import S3DPoint from './S3DPoint';
import SColor from './SColor';

class SLightDef {
    constructor() {
        this.flags = new LightFlags(0);    // LIGHT_x
        this.multiplier = 0;               // Multiplier
        this.pos = new S3DPoint();         // Position of light
        this.color = new SColor();         // RGB Color of light 
        this.intensity = 0;                // Intensity of light
        this.lightindex = 0;               // Light index for 3d system
        this.lightid = 0;                  // Light id for dls system
    }
}

export default SLightDef;