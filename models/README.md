# Model Loading Instructions

## Primary Format Changed to GLB
This viewer now primarily supports:
- GLB (.glb) - Primary format (more reliable with BabylonJS)
- FBX (.fbx) - Secondary format (fallback)

## Model Placement
Place your animated character model file inside this directory with one of these names:
1. `character.glb` (preferred)
2. `character.fbx` (fallback)

## Elevated Side-View Configuration
The viewer is now configured to show the character from the side with an elevated camera angle. The model should be:
- Y+ axis should be up
- Character should be centered at origin or with feet at origin (Y=0)
- The model will be rotated automatically to face the camera

## Sprite Sheet Generation
This viewer now includes functionality to create sprite sheets from animations:

1. Select and play the animation you want to capture
2. Set the number of frames (how many snapshots to take)
3. Set the number of columns for the sprite sheet layout
4. Click "Record Sprite Sheet" to start recording
5. The sprite sheet will be generated and downloaded automatically as a PNG file

The sprite sheet can be used in 2D game engines or web applications that support sprite animation.

## Model Orientation
Since we're using a side view with camera positioned at 90 degrees (right side of character), the model should be:
- Default facing direction along Z-axis (forward)
- The character will be automatically rotated to face the side camera

## Converting to GLB Format (Recommended)
GLB is the recommended format for BabylonJS. To convert your model:

1. Open your model in Blender
2. Go to File > Export > glTF 2.0 (.glb/.gltf)
3. Choose "GLB" format
4. Enable these options:
   - ✓ Include: Selected Objects
   - ✓ Transform: +Y Up
   - ✓ Geometry: Apply Modifiers
   - ✓ Animation: Include Animations
5. Export and save as `character.glb` in the models folder

## Using Generated Sprite Sheets

The generated sprite sheets can be used in various ways:

1. **In game engines like Unity, Godot, or Phaser:**
   - Import the PNG as a sprite sheet
   - Define the frame size and animation sequence

2. **In HTML5 Canvas applications:**
   - Use the included `SpriteSheetHelper.js` utility to easily work with the sprite sheet
   - See the example code for how to animate the sprite

3. **In CSS animations:**
   - Use background position to create frame-by-frame animations

Example using SpriteSheetHelper:
```javascript
// Create sprite sheet helper
const spriteHelper = new SpriteSheetHelper({
    frameWidth: 200,    // Width of each frame in pixels
    frameHeight: 300,   // Height of each frame in pixels
    columns: 4,         // Number of columns in your sprite sheet
    rows: 4,            // Number of rows in your sprite sheet
    fps: 24             // Animation speed
});

// Load the sprite sheet
spriteHelper.loadSpriteSheet('character_walk_spritesheet.png')
    .then(() => {
        // Create a preview and add it to the page
        const preview = spriteHelper.createPreview(200, 300);
        document.body.appendChild(preview);
    });
