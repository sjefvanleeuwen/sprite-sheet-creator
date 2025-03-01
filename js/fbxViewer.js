document.addEventListener('DOMContentLoaded', function() {
    // Get references to HTML elements
    const canvas = document.getElementById('renderCanvas');
    const animationList = document.getElementById('animationList');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const statusElement = document.getElementById('statusMessage');
    const recordBtn = document.getElementById('recordBtn');
    const framesInput = document.getElementById('framesInput');
    const columnsInput = document.getElementById('columnsInput');
    
    // Initialize BabylonJS
    const engine = new BABYLON.Engine(canvas, true);
    let scene, camera, character, animationGroups = [];
    let currentAnimationGroup = null;
    
    // Sprite sheet recording variables
    let isRecording = false;
    let recordedFrames = [];
    let frameCount = 0;
    let totalFramesToCapture = 0;
    const captureCanvas = document.createElement('canvas');
    const captureContext = captureCanvas.getContext('2d');
    
    // Fix the scroll wheel to zoom functionality with a direct implementation
    let zoomFactor = 5; // Initial orthographic zoom level
    
    // Display status messages to the user
    function showStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.className = isError ? 'error' : 'info';
        console.log(isError ? 'ERROR: ' : 'INFO: ', message);
    }
    
    /**
     * Updates orthographic camera settings based on zoom factor
     * This keeps the orthographic view consistent with zoom level
     */
    function updateOrthoCamera() {
        if (!camera) return;
        
        const aspectRatio = engine.getAspectRatio(camera);
        camera.orthoTop = zoomFactor;
        camera.orthoBottom = -zoomFactor;
        camera.orthoLeft = -zoomFactor * aspectRatio;
        camera.orthoRight = zoomFactor * aspectRatio;
    }
    
    // Create the scene
    const createScene = async function() {
        // Create a basic scene
        scene = new BABYLON.Scene(engine);
        scene.clearColor = new BABYLON.Color3(0.2, 0.2, 0.3);
        
        // Add a light
        const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
        light.intensity = 0.7;
        
        // Add directional light for better lighting from the side
        const dirLight = new BABYLON.DirectionalLight('dirLight', new BABYLON.Vector3(-1, -0.5, 0), scene);
        dirLight.position = new BABYLON.Vector3(10, 10, 0);
        dirLight.intensity = 0.8;
        
        // Create a 2D side-view camera with elevated position
        // Use Math.PI/2 for the alpha value to position camera on the side
        camera = new BABYLON.ArcRotateCamera(
            'camera', 
            Math.PI/2,    // Alpha: side view
            Math.PI/3,    // Beta: elevated angle
            15,           // Initial radius
            new BABYLON.Vector3(0, 1, 0),  // Target point
            scene
        );
        camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        
        // Enable wheel (remove any existing wheel limitations)
        camera.useFramingBehavior = false;
        camera.panningSensibility = 100; // Lower = more sensitive panning
        
        // Set initial orthographic view size
        updateOrthoCamera();
        
        // Add this simple direct event listener for wheel scrolling
        canvas.addEventListener("wheel", function(event) {
            event.preventDefault();
            
            // Adjust zoom factor based on wheel direction
            if (event.deltaY < 0) {
                // Zoom in
                zoomFactor *= 0.9; 
            } else {
                // Zoom out
                zoomFactor *= 1.1;
            }
            
            // Clamp zoom limits
            zoomFactor = Math.max(1, Math.min(20, zoomFactor));
            
            // Apply the new zoom level
            updateOrthoCamera();
            
            // Display the zoom level for debugging
            showStatus(`Zoom level: ${zoomFactor.toFixed(1)}x`);
        });
        
        // Remove the rigid locking and instead allow zooming:
        camera.lowerRadiusLimit = 5;    // Minimum zoom-in distance
        camera.upperRadiusLimit = 50;   // Maximum zoom-out distance
        
        // Set orthographic scale based on screen size
        const aspectRatio = engine.getAspectRatio(camera);
        const orthoSize = 5;
        camera.orthoTop = orthoSize;
        camera.orthoBottom = -orthoSize;
        camera.orthoLeft = -orthoSize * aspectRatio;
        camera.orthoRight = orthoSize * aspectRatio;
        
        // Allow limited panning for better viewing
        camera.panningSensibility = 50;
        camera.panningAxis = new BABYLON.Vector3(1, 1, 0); // Only allow panning in X and Y
        
        // Create a simple ground
        const ground = BABYLON.MeshBuilder.CreateGround('ground', {width: 50, height: 50}, scene);
        const groundMaterial = new BABYLON.StandardMaterial('groundMat', scene);
        groundMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.2, 0.2);
        groundMaterial.specularColor = new BABYLON.Color3(0, 0, 0);
        ground.material = groundMaterial;
        ground.position.y = 0;
        
        // Try to load the character model
        await loadCharacterModel();
        
        return scene;
    };
    
    // Function to try loading the character model with fallbacks
    async function loadCharacterModel() {
        showStatus("Loading character model...");
        
        // Check if file exists first (using fetch to check)
        try {
            // Try GLB first (changed order - GLB first, then FBX)
            await tryLoadGLB();
        }
        catch (glbError) {
            console.error("Error loading GLB:", glbError);
            
            try {
                // Try FBX as fallback
                await tryLoadFBX();
            }
            catch (fbxError) {
                console.error("Error loading FBX:", fbxError);
                
                // Final fallback - create a simple character
                createFallbackCharacter();
                showStatus("Using fallback character. Please place a valid model file in the models folder.", true);
            }
        }
    }
    
    // Try loading GLB file
    async function tryLoadGLB() {
        // Check if file exists first
        const response = await fetch('models/character.glb', { method: 'HEAD' });
        if (!response.ok) {
            throw new Error("GLB file not found");
        }
        
        showStatus("Loading GLB model...");
        
        const result = await BABYLON.SceneLoader.ImportMeshAsync('', 'models/', 'character.glb', scene);
        
        // Process the loaded model
        processLoadedModel(result);
        showStatus("GLB model loaded successfully!");
    }
    
    // Try loading FBX file
    async function tryLoadFBX() {
        // Check if file exists first
        const response = await fetch('models/character.fbx', { method: 'HEAD' });
        if (!response.ok) {
            throw new Error("FBX file not found");
        }
        
        showStatus("Loading FBX model...");
        
        const result = await BABYLON.SceneLoader.ImportMeshAsync('', 'models/', 'character.fbx', scene);
        
        // Process the loaded model
        processLoadedModel(result);
        showStatus("FBX model loaded successfully!");
    }
    
    // Create a fallback character if model loading fails
    function createFallbackCharacter() {
        // Create a simple character made of shapes
        const body = BABYLON.MeshBuilder.CreateBox("body", {height: 2, width: 0.75, depth: 0.5}, scene);
        body.position.y = 1;
        
        const head = BABYLON.MeshBuilder.CreateSphere("head", {diameter: 0.7}, scene);
        head.position.y = 2.4;
        head.parent = body;
        
        const leftArm = BABYLON.MeshBuilder.CreateBox("leftArm", {height: 1.2, width: 0.25, depth: 0.25}, scene);
        leftArm.position.x = -0.5;
        leftArm.position.y = 1;
        leftArm.parent = body;
        
        const rightArm = BABYLON.MeshBuilder.CreateBox("rightArm", {height: 1.2, width: 0.25, depth: 0.25}, scene);
        rightArm.position.x = 0.5;
        rightArm.position.y = 1;
        rightArm.parent = body;
        
        const leftLeg = BABYLON.MeshBuilder.CreateBox("leftLeg", {height: 1.5, width: 0.3, depth: 0.3}, scene);
        leftLeg.position.x = -0.2;
        leftLeg.position.y = -0.75;
        leftLeg.parent = body;
        
        const rightLeg = BABYLON.MeshBuilder.CreateBox("rightLeg", {height: 1.5, width: 0.3, depth: 0.3}, scene);
        rightLeg.position.x = 0.2;
        rightLeg.position.y = -0.75;
        rightLeg.parent = body;
        
        // Create material for the character
        const characterMaterial = new BABYLON.StandardMaterial("charMaterial", scene);
        characterMaterial.diffuseColor = new BABYLON.Color3(0.5, 0.5, 1.0);
        
        // Apply material to all parts
        body.material = characterMaterial;
        head.material = characterMaterial;
        leftArm.material = characterMaterial;
        rightArm.material = characterMaterial;
        leftLeg.material = characterMaterial;
        rightLeg.material = characterMaterial;
        
        // Create a simple animation
        const walkAnim = new BABYLON.Animation(
            "walkAnimation", 
            "rotation.x", 
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        const walkKeys = [];
        walkKeys.push({ frame: 0, value: -Math.PI / 10 });
        walkKeys.push({ frame: 15, value: Math.PI / 10 });
        walkKeys.push({ frame: 30, value: -Math.PI / 10 });
        walkAnim.setKeys(walkKeys);
        
        const armAnim = new BABYLON.Animation(
            "armAnimation", 
            "rotation.x", 
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        const armKeys = [];
        armKeys.push({ frame: 0, value: Math.PI / 4 });
        armKeys.push({ frame: 15, value: -Math.PI / 4 });
        armKeys.push({ frame: 30, value: Math.PI / 4 });
        armAnim.setKeys(armKeys);
        
        // Create animation groups
        const walkAnimGroup = new BABYLON.AnimationGroup("Walk");
        walkAnimGroup.addTargetedAnimation(walkAnim, leftLeg);
        walkAnimGroup.addTargetedAnimation(new BABYLON.Animation(walkAnim), rightLeg);
        walkAnimGroup.addTargetedAnimation(armAnim, leftArm);
        walkAnimGroup.addTargetedAnimation(armAnim, rightArm);
        
        const idleAnimGroup = new BABYLON.AnimationGroup("Idle");
        const idleAnim = new BABYLON.Animation(
            "idleAnimation", 
            "position.y", 
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        const idleKeys = [];
        idleKeys.push({ frame: 0, value: body.position.y });
        idleKeys.push({ frame: 15, value: body.position.y + 0.05 });
        idleKeys.push({ frame: 30, value: body.position.y });
        idleAnim.setKeys(idleKeys);
        
        idleAnimGroup.addTargetedAnimation(idleAnim, body);
        
        // Store animations and character
        animationGroups = [idleAnimGroup, walkAnimGroup];
        character = body;
        
        // Populate animation list
        populateAnimationList();
        
        // For a side view, adjust the orientation of the fallback character
        body.rotation.y = Math.PI/2; // Rotate to face the side camera
    }
    
    // Process loaded character model
    function processLoadedModel(result) {
        // Get the loaded character (root mesh)
        character = result.meshes[0];
        
        // Center the character
        character.position = new BABYLON.Vector3(0, 0, 0);
        
        // Adjust character rotation to face correctly for side view
        // Rotate 90 degrees so character faces the camera from the side
        character.rotation = new BABYLON.Vector3(0, Math.PI/2, 0);
        
        // Store animation groups
        animationGroups = result.animationGroups;
        
        // Handle no animations case
        if (animationGroups.length === 0) {
            showStatus("The model has no animations. Creating a simple animation.", true);
            createDefaultAnimation();
        }
        
        // Set the camera to look at the character's upper body
        if (camera) {
            camera.setTarget(new BABYLON.Vector3(0, 1, 0));
        }
        
        // Populate animation dropdown
        populateAnimationList();
        
        console.log(`Loaded character with ${animationGroups.length} animations`);
    }
    
    // Create a default animation if none exists
    function createDefaultAnimation() {
        const anim = new BABYLON.Animation(
            "defaultAnim", 
            "position.y", 
            30,
            BABYLON.Animation.ANIMATIONTYPE_FLOAT,
            BABYLON.Animation.ANIMATIONLOOPMODE_CYCLE
        );
        
        const keys = [];
        keys.push({ frame: 0, value: character.position.y });
        keys.push({ frame: 30, value: character.position.y + 0.2 });
        keys.push({ frame: 60, value: character.position.y });
        
        anim.setKeys(keys);
        
        const animGroup = new BABYLON.AnimationGroup("Default");
        animGroup.addTargetedAnimation(anim, character);
        
        animationGroups = [animGroup];
    }
    
    // Populate animation dropdown
    function populateAnimationList() {
        // Clear existing options
        animationList.innerHTML = '';
        
        // Add each animation to the dropdown
        animationGroups.forEach((group, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.text = group.name;
            animationList.appendChild(option);
        });
        
        // Select the first animation
        if (animationGroups.length > 0) {
            playAnimation(0);
        }
    }
    
    // Play selected animation
    function playAnimation(index) {
        // Stop current animation if playing
        if (currentAnimationGroup) {
            currentAnimationGroup.stop();
        }
        
        // Play selected animation
        if (index >= 0 && index < animationGroups.length) {
            currentAnimationGroup = animationGroups[index];
            currentAnimationGroup.start(true); // true for looping
            showStatus(`Playing animation: ${currentAnimationGroup.name}`);
        }
    }
    
    // Recording sprite sheet functions
    function startRecording() {
        if (!currentAnimationGroup) {
            showStatus("Please play an animation first before recording", true);
            return;
        }
        
        // Get parameters from inputs
        totalFramesToCapture = parseInt(framesInput.value) || 16;
        if (totalFramesToCapture < 1) totalFramesToCapture = 16;
        
        // Reset recording state
        recordedFrames = [];
        frameCount = 0;
        isRecording = true;
        
        // Restart the animation for a clean recording
        currentAnimationGroup.stop();
        currentAnimationGroup.start(true);
        
        showStatus(`Recording sprite sheet: frame 0/${totalFramesToCapture}`);
        
        // Disable record button during recording
        recordBtn.disabled = true;
        recordBtn.textContent = "Recording...";
        
        // Start the recording loop
        recordingLoop();
    }
    
    function captureFrame() {
        // Only capture if we're recording and have an active animation
        if (!isRecording || !currentAnimationGroup) return;
        
        // Update status every few frames
        if (frameCount % 5 === 0) {
            showStatus(`Recording sprite sheet: frame ${frameCount}/${totalFramesToCapture}`);
        }
        
        // Use the correct method for capturing screenshots in BabylonJS
        BABYLON.Tools.CreateScreenshot(engine, camera, { width: 512, height: 512 }, function(data) {
            // Store the image data
            const img = new Image();
            img.src = data;
            img.onload = function() {
                recordedFrames.push(img);
                
                // Check if we've captured all frames
                frameCount++;
                if (frameCount >= totalFramesToCapture) {
                    isRecording = false;
                    createSpriteSheet();
                }
            };
        });
    }
    
    // Add a slight delay between frames to ensure animation cycles properly
    async function recordingLoop() {
        if (!isRecording) return;
        
        // Capture the current frame
        captureFrame();
        
        // Wait for animation to advance
        if (frameCount < totalFramesToCapture) {
            // Calculate delay based on animation speed
            let animationSpeed = currentAnimationGroup ? 
                (currentAnimationGroup.speedRatio || 1.0) : 1.0;
            let delay = 1000 / (30 * animationSpeed); // Assume 30fps animation
            
            // Use setTimeout for more reliable frame timing
            setTimeout(recordingLoop, delay);
        }
    }
    
    /**
     * Analyze a frame to find its content bounds (non-transparent areas)
     * @param {HTMLImageElement} frame - The frame image to analyze
     * @returns {Object} - The content bounds {left, top, right, bottom, width, height}
     */
    function analyzeFrameContent(frame) {
        // Create a temporary canvas for analysis
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = frame.width;
        tempCanvas.height = frame.height;
        
        // Draw the frame on the temp canvas
        tempCtx.drawImage(frame, 0, 0);
        
        // Get the pixel data
        const pixelData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        
        // Find content boundaries
        let left = frame.width;
        let top = frame.height;
        let right = 0;
        let bottom = 0;
        let foundContent = false;
        
        // Analyze the pixel data to find content bounds
        for (let y = 0; y < frame.height; y++) {
            for (let x = 0; x < frame.width; x++) {
                const pixelIndex = (y * frame.width + x) * 4;
                // Check pixel alpha (non-transparent)
                if (pixelData[pixelIndex + 3] > 10) { // Alpha threshold
                    left = Math.min(left, x);
                    top = Math.min(top, y);
                    right = Math.max(right, x);
                    bottom = Math.max(bottom, y);
                    foundContent = true;
                }
            }
        }
        
        // Fallback if no content found
        if (!foundContent) {
            return {
                left: 0,
                top: 0,
                right: frame.width - 1,
                bottom: frame.height - 1,
                width: frame.width,
                height: frame.height
            };
        }
        
        // Add a small margin for better appearance
        const margin = 5;
        left = Math.max(0, left - margin);
        top = Math.max(0, top - margin);
        right = Math.min(frame.width - 1, right + margin);
        bottom = Math.min(frame.height - 1, bottom + margin);
        
        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: right - left + 1,
            height: bottom - top + 1
        };
    }
    
    // Replace the createSpriteSheet function with this optimized version
    function createSpriteSheet() {
        showStatus("Creating sprite sheet with optimized spacing...");
        
        // Get parameters
        const numFrames = recordedFrames.length;
        let numColumns = parseInt(columnsInput.value) || 4;
        if (numColumns < 1) numColumns = 4;
        
        // Calculate rows needed
        const numRows = Math.ceil(numFrames / numColumns);
        
        // Analyze each frame to find content bounds
        const frameBounds = recordedFrames.map(frame => analyzeFrameContent(frame));
        
        // Find maximum content dimensions to use as frame size
        let maxContentWidth = 0;
        let maxContentHeight = 0;
        
        frameBounds.forEach(bounds => {
            maxContentWidth = Math.max(maxContentWidth, bounds.width);
            maxContentHeight = Math.max(maxContentHeight, bounds.height);
        });
        
        // Add a small padding between frames
        const framePadding = 2;
        const frameWidth = maxContentWidth + framePadding * 2;
        const frameHeight = maxContentHeight + framePadding * 2;
        
        // Set the capture canvas size
        captureCanvas.width = frameWidth * numColumns;
        captureCanvas.height = frameHeight * numRows;
        
        // Clear the canvas with transparent background
        captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
        
        // Draw each frame onto the sprite sheet with centered content
        for (let i = 0; i < numFrames; i++) {
            const row = Math.floor(i / numColumns);
            const col = i % numColumns;
            
            // Calculate target position on sprite sheet
            const targetX = col * frameWidth;
            const targetY = row * frameHeight;
            
            // Get the frame and its bounds
            const frame = recordedFrames[i];
            const bounds = frameBounds[i];
            
            // Calculate centering offsets
            const offsetX = Math.floor((frameWidth - bounds.width) / 2);
            const offsetY = Math.floor((frameHeight - bounds.height) / 2);
            
            // Draw the content portion of the frame centered in its cell
            captureContext.drawImage(
                frame,
                bounds.left, bounds.top, bounds.width, bounds.height,
                targetX + offsetX, targetY + offsetY, bounds.width, bounds.height
            );
            
            // Optional: Draw frame borders for debugging
            // captureContext.strokeStyle = 'rgba(0, 255, 0, 0.5)';
            // captureContext.strokeRect(targetX, targetY, frameWidth, frameHeight);
        }
        
        // Save sprite sheet metadata for later use
        const metadata = {
            frameWidth: frameWidth,
            frameHeight: frameHeight,
            frames: numFrames,
            columns: numColumns,
            rows: numRows,
            animationName: currentAnimationGroup.name,
            padding: framePadding,
            optimized: true,
            cropData: {
                left: frameBounds[0].left,
                top: frameBounds[0].top,
                width: maxContentWidth,
                height: maxContentHeight
            }
        };
        
        // Create downloadable sprite sheet image
        const dataURL = captureCanvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = dataURL;
        downloadLink.download = `${currentAnimationGroup.name}_spritesheet.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Create downloadable metadata JSON
        const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {type: 'application/json'});
        const metadataURL = URL.createObjectURL(metadataBlob);
        const metadataLink = document.createElement('a');
        metadataLink.href = metadataURL;
        metadataLink.download = `${currentAnimationGroup.name}_metadata.json`;
        document.body.appendChild(metadataLink);
        metadataLink.click();
        document.body.removeChild(metadataLink);
        URL.revokeObjectURL(metadataURL);
        
        // Re-enable record button
        recordBtn.disabled = false;
        recordBtn.textContent = "Record Sprite Sheet";
        
        showStatus(`Optimized sprite sheet created with ${numFrames} frames - Size: ${frameWidth}x${frameHeight} pixels per frame`);
    }
    
    // Create and set up the scene
    createScene().then(() => {
        // Register event listeners
        playBtn.addEventListener('click', () => {
            const selectedIndex = parseInt(animationList.value);
            playAnimation(selectedIndex);
        });
        
        pauseBtn.addEventListener('click', () => {
            if (currentAnimationGroup) {
                currentAnimationGroup.pause();
                showStatus(`Paused animation: ${currentAnimationGroup.name}`);
            }
        });
        
        animationList.addEventListener('change', () => {
            const selectedIndex = parseInt(animationList.value);
            playAnimation(selectedIndex);
        });
        
        // Add sprite sheet recording event listener
        recordBtn.addEventListener('click', startRecording);
        
        // Run the render loop with frame capture REMOVED from here
        engine.runRenderLoop(() => {
            scene.render();
            // We'll handle frame capture separately with the recordingLoop function
        });
        
        // Handle window resize
        window.addEventListener('resize', () => {
            engine.resize();
            updateOrthoCamera(); // Update orthographic settings on resize
        });
    });
});
