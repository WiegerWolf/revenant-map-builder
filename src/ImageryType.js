
export class ImageryType {
    static ANIMATION = 0;
    static MESH3D = 1;
    static MESH3DHELPER = 2;
    static MULTI = 3;
    static MULTIANIMATION = 4;

    static getName(id) {
        switch (id) {
            case this.ANIMATION: return 'ANIMATION';
            case this.MESH3D: return 'MESH3D';
            case this.MESH3DHELPER: return 'MESH3DHELPER';
            case this.MULTI: return 'MULTI';
            case this.MULTIANIMATION: return 'MULTIANIMATION';
            default: return 'UNKNOWN';
        }
    }

    static isValid(id) {
        return id >= this.ANIMATION && id <= this.MULTIANIMATION;
    }
}
