/**
 * Helper class for working with generated sprite sheets
 */
class SpriteSheetHelper {
    /**
     * Creates a new SpriteSheetHelper
     * @param {Object} options - Configuration options
     * @param {number} options.frameWidth - Width of each frame in pixels
     * @param {number} options.frameHeight - Height of each frame in pixels
     * @param {number} options.columns - Number of columns in the sprite sheet
     * @param {number} options.rows - Number of rows in the sprite sheet
     * @param {number} options.fps - Frames per second for animation playback
     */
    constructor(options) {
        this.frameWidth = options.frameWidth || 64;
        this.frameHeight = options.frameHeight || 64;
        this.columns = options.columns || 4;
        this.rows = options.rows || 4;
        this.fps = options.fps || 30;
        
        // Total frames in the sprite sheet
        this.totalFrames = this.columns * this.rows;
        
        // Animation state
        this.currentFrame = 0;
        this.isPlaying = false;
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / this.fps;
    }
    
    /**
     * Loads a sprite sheet image
     * @param {string} url - URL of the sprite sheet image
     * @returns {Promise} - Promise that resolves when the image is loaded
     */
    loadSpriteSheet(url) {
        return new Promise((resolve, reject) => {
            this.image = new Image();
            this.image.onload = () => resolve(this.image);
            this.image.onerror = reject;
            this.image.src = url;
        });
    }
    
    /**
     * Draws the current frame on a canvas
     * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
     * @param {number} x - X position to draw
     * @param {number} y - Y position to draw
     * @param {number} width - Width to draw (optional, defaults to frameWidth)
     * @param {number} height - Height to draw (optional, defaults to frameHeight)
     */
    drawFrame(ctx, x, y, width, height) {
        if (!this.image) return;
        
        width = width || this.frameWidth;
        height = height || this.frameHeight;
        
        const col = this.currentFrame % this.columns;
        const row = Math.floor(this.currentFrame / this.columns);
        
        const sourceX = col * this.frameWidth;
        const sourceY = row * this.frameHeight;
        
        ctx.drawImage(
            this.image,
            sourceX, sourceY, this.frameWidth, this.frameHeight,
            x, y, width, height
        );
    }
    
    /**
     * Update the animation
     * @param {number} timestamp - Current timestamp
     */
    update(timestamp) {
        if (!this.isPlaying) return;
        
        if (!this.lastFrameTime) this.lastFrameTime = timestamp;
        
        const elapsed = timestamp - this.lastFrameTime;
        
        if (elapsed >= this.frameInterval) {
            // Advance to next frame
            this.currentFrame = (this.currentFrame + 1) % this.totalFrames;
            this.lastFrameTime = timestamp;
        }
    }
    
    /**
     * Start animation playback
     */
    play() {
        this.isPlaying = true;
        this.lastFrameTime = 0;
    }
    
    /**
     * Pause animation playback
     */
    pause() {
        this.isPlaying = false;
    }
    
    /**
     * Set a specific frame
     * @param {number} frameIndex - Index of the frame to show
     */
    setFrame(frameIndex) {
        if (frameIndex >= 0 && frameIndex < this.totalFrames) {
            this.currentFrame = frameIndex;
        }
    }
    
    /**
     * Get sprite sheet metadata
     * @returns {Object} - Metadata object
     */
    getMetadata() {
        return {
            frameWidth: this.frameWidth,
            frameHeight: this.frameHeight,
            columns: this.columns,
            rows: this.rows,
            totalFrames: this.totalFrames,
            fps: this.fps
        };
    }
    
    /**
     * Creates an animation preview element
     * @param {number} width - Width of the preview
     * @param {number} height - Height of the preview
     * @returns {HTMLCanvasElement} - Canvas element with the animation
     */
    createPreview(width, height) {
        const canvas = document.createElement('canvas');
        canvas.width = width || this.frameWidth;
        canvas.height = height || this.frameHeight;
        
        const ctx = canvas.getContext('2d');
        let animFrame;
        
        const animate = (timestamp) => {
            if (!this.image) return;
            
            this.update(timestamp);
            
            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            // Draw current frame
            this.drawFrame(ctx, 0, 0, canvas.width, canvas.height);
            
            // Request next frame
            animFrame = requestAnimationFrame(animate);
        };
        
        // Start animation
        this.play();
        animFrame = requestAnimationFrame(animate);
        
        // Stop animation when canvas is removed
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.removedNodes.forEach((node) => {
                    if (node === canvas) {
                        cancelAnimationFrame(animFrame);
                        observer.disconnect();
                    }
                });
            });
        });
        
        observer.observe(document.body, { childList: true, subtree: true });
        
        return canvas;
    }
    
    /**
     * Static method to check if the browser supports the needed features
     * @returns {boolean} - Whether the browser supports WebGL and Canvas
     */
    static checkCompatibility() {
        // Check for WebGL support
        let canvas = document.createElement('canvas');
        let gl = null;
        
        try {
            gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        } catch (e) {
            return false;
        }
        
        if (!gl) {
            return false;
        }
        
        // Check for canvas and toDataURL support
        try {
            let dataURL = canvas.toDataURL('image/png');
            return dataURL.indexOf('data:image/png') === 0;
        } catch (e) {
            return false;
        }
    }
}
