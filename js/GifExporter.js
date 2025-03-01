/**
 * GifExporter - A utility for converting sprite sheets to GIF animations
 * Works with the animation player and sprite sheets created by the FBX Viewer
 */
class GifExporter {
    /**
     * Create a new GifExporter
     * @param {Object} options - Configuration options
     */
    constructor(options = {}) {
        this.quality = options.quality || 10;
        this.workers = options.workers || 4;
        this.onProgress = options.onProgress || (() => {});
        this.onComplete = options.onComplete || (() => {});
        this.onError = options.onError || (() => {});
        
        // Check if gif.js is available
        if (typeof GIF !== 'function') {
            throw new Error('GIF.js library is required. Please include gif.js script in your HTML.');
        }
    }
    
    /**
     * Export a sprite sheet to a GIF animation
     * @param {Object} options - Export options
     * @param {HTMLImageElement} options.spriteSheet - The sprite sheet image
     * @param {Object} options.metadata - The sprite sheet metadata
     * @param {number} options.fps - Frames per second (default: from metadata or 24)
     * @param {number} options.scale - Scale factor (default: 1)
     * @param {boolean} options.loop - Whether the animation should loop (default: true)
     * @returns {Promise<Blob>} - A promise that resolves with the GIF blob
     */
    exportGif(options) {
        return new Promise((resolve, reject) => {
            const spriteSheet = options.spriteSheet;
            const metadata = options.metadata;
            
            if (!spriteSheet || !metadata) {
                return reject(new Error('Sprite sheet and metadata are required'));
            }
            
            const fps = options.fps || metadata.fps || 24;
            const scale = options.scale || 1;
            const loop = options.loop !== undefined ? options.loop : true;
            
            // Calculate frame delay in milliseconds
            const frameDelay = 1000 / fps;
            
            // Create GIF encoder with appropriate settings
            const gif = new GIF({
                workers: this.workers,
                quality: this.quality,
                width: metadata.frameWidth * scale,
                height: metadata.frameHeight * scale,
                workerScript: options.workerScript || 'https://cdn.jsdelivr.net/gh/jnordberg/gif.js@0.2.0/dist/gif.worker.js',
                transparent: 'rgba(0,0,0,0)',
                repeat: loop ? 0 : -1 // 0 = loop forever, -1 = no repeat
            });
            
            // Set up a temporary canvas for frames
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = metadata.frameWidth;
            canvas.height = metadata.frameHeight;
            
            // Set up a canvas for scaled frames if needed
            let scaledCanvas, scaledCtx;
            if (scale !== 1) {
                scaledCanvas = document.createElement('canvas');
                scaledCtx = scaledCanvas.getContext('2d');
                scaledCanvas.width = metadata.frameWidth * scale;
                scaledCanvas.height = metadata.frameHeight * scale;
            }
            
            // Add each frame to the GIF
            let framesProcessed = 0;
            const totalFrames = metadata.frames;
            
            for (let i = 0; i < totalFrames; i++) {
                // Calculate frame position in the sprite sheet
                const row = Math.floor(i / metadata.columns);
                const col = i % metadata.columns;
                const x = col * metadata.frameWidth;
                const y = row * metadata.frameHeight;
                
                // Draw the frame to the canvas
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(
                    spriteSheet, 
                    x, y, metadata.frameWidth, metadata.frameHeight,
                    0, 0, canvas.width, canvas.height
                );
                
                // Use scaled canvas if needed
                if (scale !== 1) {
                    scaledCtx.clearRect(0, 0, scaledCanvas.width, scaledCanvas.height);
                    scaledCtx.drawImage(
                        canvas, 
                        0, 0, canvas.width, canvas.height,
                        0, 0, scaledCanvas.width, scaledCanvas.height
                    );
                    gif.addFrame(scaledCanvas, {delay: frameDelay, copy: true});
                } else {
                    gif.addFrame(canvas, {delay: frameDelay, copy: true});
                }
                
                framesProcessed++;
                this.onProgress(framesProcessed / totalFrames * 0.5); // First 50% is adding frames
            }
            
            // Handle rendering progress and completion
            gif.on('progress', progress => {
                // Second 50% is rendering the GIF
                this.onProgress(0.5 + progress * 0.5); 
            });
            
            gif.on('finished', blob => {
                this.onComplete(blob);
                resolve(blob);
            });
            
            // Render the GIF
            try {
                gif.render();
            } catch (error) {
                this.onError(error);
                reject(error);
            }
        });
    }
    
    /**
     * Create a download link for a GIF blob
     * @param {Blob} blob - The GIF blob
     * @param {string} filename - The filename for the download
     * @returns {HTMLAnchorElement} - The download link element
     */
    createDownloadLink(blob, filename = 'animation.gif') {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.textContent = 'Download GIF';
        link.className = 'download-btn';
        link.style = 'background-color: #27ae60; color: white; padding: 8px 16px; border-radius: 4px; text-decoration: none; display: inline-block;';
        
        // Clean up object URL after download
        link.addEventListener('click', () => {
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 100);
        });
        
        return link;
    }
}

// Export for use in module systems or global scope
if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    module.exports = GifExporter;
} else if (typeof define === 'function' && define.amd) {
    define([], function() { return GifExporter; });
} else {
    window.GifExporter = GifExporter;
}
