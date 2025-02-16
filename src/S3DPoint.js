
export class S3DPoint {
    constructor(x = 0, y = 0, z = 0) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(other) {
        return new S3DPoint(
            this.x + other.x,
            this.y + other.y,
            this.z + other.z
        );
    }

    subtract(other) {
        return new S3DPoint(
            this.x - other.x,
            this.y - other.y,
            this.z - other.z
        );
    }

    multiply(scalar) {
        return new S3DPoint(
            this.x * scalar,
            this.y * scalar,
            this.z * scalar
        );
    }

    inRange(pos, dist) {
        const absX = Math.abs(this.x - pos.x);
        const absY = Math.abs(this.y - pos.y);
        return absY <= dist &&
            absX <= dist &&
            (Math.pow(absY, 2) + Math.pow(absX, 2) <= Math.pow(dist, 2) * 2);
    }

    inRange3D(pos, dist) {
        const absX = Math.abs(this.x - pos.x);
        const absY = Math.abs(this.y - pos.y);
        const absZ = Math.abs(this.z - pos.z);
        return absY <= dist &&
            absX <= dist &&
            absZ <= dist &&
            (Math.pow(absY, 2) + Math.pow(absX, 2) + Math.pow(absZ, 2) <= Math.pow(dist, 2) * 3);
    }
}
