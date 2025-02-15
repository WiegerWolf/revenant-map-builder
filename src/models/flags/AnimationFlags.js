class AnimationFlags {
    constructor(value) {
        // Convert number to 16-bit binary string (animation flags are 16-bit)
        const bits = (value >>> 0).toString(2).padStart(16, '0');

        // Parse all animation flags
        this.looping = !!parseInt(bits[15 - 0]);         // Circles back to original position
        this.faceMotion = !!parseInt(bits[15 - 1]);      // This animation has facing motion data
        this.interFrame = !!parseInt(bits[15 - 2]);      // Uses interframe compression
        this.noReg = !!parseInt(bits[15 - 3]);           // Use 0,0 of FLC as registration pt of animation
        this.synchronize = !!parseInt(bits[15 - 4]);     // Causes animation frame to match 'targets' animation frame
        this.move = !!parseInt(bits[15 - 5]);            // Use the deltas in the ani to move the x,y position
        this.noInterpolation = !!parseInt(bits[15 - 6]); // Prevents system from interpolating between animations
        this.pingPong = !!parseInt(bits[15 - 7]);        // Pingpong the animation
        this.reverse = !!parseInt(bits[15 - 8]);         // Play the animation backwards
        this.noRestore = !!parseInt(bits[15 - 9]);       // Draw to screen but don't bother to restore
        this.root = !!parseInt(bits[15 - 10]);           // This animation is a root state
        this.fly = !!parseInt(bits[15 - 11]);            // This animation is a flying animation (jump, etc.)
        this.sync = !!parseInt(bits[15 - 12]);           // Synchronize all animations on screen
        this.noMotion = !!parseInt(bits[15 - 13]);       // Ignore motion deltas
        this.accurateKeys = !!parseInt(bits[15 - 14]);   // Has only high accuracy 'code' style 3D ani keys
        this.root2Root = !!parseInt(bits[15 - 15]);      // This animation starts at root and returns to root
    }

    // Helper method to check if animation is a root animation
    isRootAnimation() {
        return this.root || this.root2Root;
    }

    // Helper method to check if animation involves motion
    hasMotion() {
        return this.move && !this.noMotion;
    }

    // Helper method to check if animation needs synchronization
    needsSync() {
        return this.synchronize || this.sync;
    }

    // Helper method to check if animation loops in some way
    isLooping() {
        return this.looping || this.pingPong;
    }

    // Helper method to get playback direction
    getPlaybackDirection() {
        if (this.pingPong) return 'pingpong';
        if (this.reverse) return 'reverse';
        return 'forward';
    }
}

export default AnimationFlags;