document.addEventListener('DOMContentLoaded', async function() {
    // Get references to HTML elements
    const canvas = document.getElementById('renderCanvas');
    const animationList = document.getElementById('animationList');
    const playBtn = document.getElementById('playBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const statusElement = document.getElementById('statusMessage');
    const recordBtn = document.getElementById('recordBtn');
    const framesInput = document.getElementById('framesInput');
    const columnsInput = document.getElementById('columnsInput');
    const cellWidthInput = document.getElementById('cellWidthInput');
    const cellHeightInput = document.getElementById('cellHeightInput');
    
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
    
    // Add camera adjustment variables
    let cameraOffsetX = 0;
    let cameraOffsetY = 0;
    const cameraAdjustStep = 0.25; // How much to move the camera per adjustment
    
    /**
     * Updates orthographic camera settings based on zoom factor
     * This keeps the orthographic view consistent with zoom level
     */
    function updateOrthoCamera() {
        if (!camera) return;
        
        // Force a 1:1 square aspect ratio regardless of canvas dimensions
        camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        
        // Use the same value for both horizontal and vertical dimensions
        // This ensures a perfect square view
        camera.orthoTop = zoomFactor;
        camera.orthoBottom = -zoomFactor;
        camera.orthoLeft = -zoomFactor; // Same as vertical for 1:1 ratio
        camera.orthoRight = zoomFactor;  // Same as vertical for 1:1 ratio
        
        // Apply camera position offsets by moving the target
        if (camera.target) {
            // Create a new target vector with the offsets applied
            const newTarget = new BABYLON.Vector3(
                cameraOffsetX,
                1 + cameraOffsetY, // Add 1 to keep at approximate character height
                0
            );
            camera.setTarget(newTarget);
        }
    }
    
    // Add these functions for camera adjustment
    function adjustCameraPosition(directionX, directionY) {
        cameraOffsetX += directionX * cameraAdjustStep;
        cameraOffsetY += directionY * cameraAdjustStep;
        updateOrthoCamera();
        
        // Update status to show camera position
        showStatus(`Camera offset: X=${cameraOffsetX.toFixed(2)}, Y=${cameraOffsetY.toFixed(2)}`);
    }
    
    function resetCameraPosition() {
        cameraOffsetX = 0;
        cameraOffsetY = 0;
        updateOrthoCamera();
        showStatus("Camera position reset");
    }
    
    // Create the scene
    const createScene = async function() {
        const scene = new BABYLON.Scene(engine);
        window.scene = scene; // Make scene globally accessible
        
        // Set transparent background by setting alpha to 0
        scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
        
        // Enable alpha blending (required for transparent backgrounds)
        engine.setHardwareScalingLevel(1);
        engine.alpha = true;
        engine.alphaMode = BABYLON.Engine.ALPHA_COMBINE;
        
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
        groundMaterial.alpha = 0; // Make the ground transparent
        ground.material = groundMaterial;
        ground.position.y = 0;
        
        // Try to load the character model
        await loadCharacterModel();
        
        // Create camera adjustment UI
        createCameraControls();
        
        // Dispatch event when scene is ready
        window.dispatchEvent(new CustomEvent('sceneReady'));
        
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
                showStatus("Using fallback character. Please place a valid model in the models folder.", true);
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
        
        // Reset camera position when loading a new model
        cameraOffsetX = 0;
        cameraOffsetY = 0;
        
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
        
        // Restart the animation for a clean recording and ensure we're at the beginning
        currentAnimationGroup.stop();
        currentAnimationGroup.reset(); // Reset to start position
        currentAnimationGroup.start(true); // Loop animation
        
        showStatus(`Recording sprite sheet: frame 0/${totalFramesToCapture}`);
        
        // Disable record button during recording
        recordBtn.disabled = true;
        recordBtn.textContent = "Recording...";
        
        // Start the recording loop with a slight delay to ensure animation is ready
        setTimeout(() => {
            recordingLoop();
        }, 100);
    }
    
    // Update the recordingLoop function to ensure proper frame timing
    async function recordingLoop() {
        if (!isRecording || !currentAnimationGroup) return;
        
        // Capture the current frame
        captureFrame();
        
        // Wait for animation to advance
        if (frameCount < totalFramesToCapture) {
            // Calculate delay based on animation speed and length
            const animSpeed = currentAnimationGroup.speedRatio || 1.0;
            const animTotalFrames = currentAnimationGroup.to - currentAnimationGroup.from;
            
            // Calculate how many animation frames to advance per sprite frame
            const framesPerCapture = animTotalFrames / totalFramesToCapture;
            
            // Calculate delay needed based on animation speed
            // Use a more precise timing method to ensure consistent frames
            const delay = (1000 / 30) * framesPerCapture / animSpeed;
            
            // Use setTimeout for next frame
            setTimeout(recordingLoop, delay);
        }
    }
    
    // Update captureFrame to include better error handling and ensure proper image loading
    function captureFrame() {
        if (!isRecording || !currentAnimationGroup) return;
        
        try {
            // Update status every few frames
            if (frameCount % 5 === 0) {
                showStatus(`Recording sprite sheet: frame ${frameCount}/${totalFramesToCapture}`);
            }
            
            // Get desired cell dimensions from inputs
            const cellWidth = parseInt(cellWidthInput.value) || 256;
            const cellHeight = parseInt(cellHeightInput.value) || 256;
            
            // Force transparent background during capture
            scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
            
            // Take the screenshot
            BABYLON.Tools.CreateScreenshot(engine, camera, {
                width: cellWidth,
                height: cellHeight,
                precision: 1
            }, function(data) {
                if (!data || data.length < 100) {
                    // Something went wrong with the capture
                    console.error("Invalid screenshot data received");
                    captureRetry();
                    return;
                }
                
                // Store the image data with proper loading handling
                const img = new Image();
                img.onload = function() {
                    recordedFrames.push(img);
                    
                    // Check if we've captured all frames
                    frameCount++;
                    showStatus(`Recording sprite sheet: frame ${frameCount}/${totalFramesToCapture}`);
                    
                    if (frameCount >= totalFramesToCapture) {
                        finishRecording();
                    }
                };
                
                img.onerror = function(err) {
                    console.error("Error loading captured frame:", err);
                    captureRetry();
                };
                
                // Set the source after attaching event handlers
                img.src = data;
            });
        } catch (err) {
            console.error("Error in captureFrame:", err);
            captureRetry();
        }
    }
    
    // Add a retry mechanism for failed captures
    function captureRetry() {
        // If too many retries, abort
        if (frameCount > totalFramesToCapture * 1.5) {
            showStatus("Too many retries, aborting recording", true);
            finishRecording(true);
            return;
        }
        
        // Try again after a short delay
        setTimeout(() => {
            if (isRecording) {
                captureFrame();
            }
        }, 200);
    }
    
    // Add a proper finish function to ensure complete recording
    function finishRecording(hasError = false) {
        isRecording = false;
        
        if (hasError) {
            // Handle error case
            recordBtn.disabled = false;
            recordBtn.textContent = "Record Sprite Sheet";
            return;
        }
        
        // Validate we have all frames
        if (recordedFrames.length !== totalFramesToCapture) {
            showStatus(`Warning: Captured ${recordedFrames.length} frames instead of ${totalFramesToCapture}`, true);
        }
        
        // Create the sprite sheet
        if (recordedFrames.length > 0) {
            showStatus(`Creating sprite sheet with ${recordedFrames.length} frames...`);
            createSpriteSheet();
        } else {
            showStatus("Failed to capture any frames", true);
            recordBtn.disabled = false;
            recordBtn.textContent = "Record Sprite Sheet";
        }
    }
    
    // Add this helper function at the bottom of the file to improve animation timing
    function getAnimationFrameRate(animGroup) {
        // Try to determine the animation frame rate
        if (animGroup && animGroup.animatables.length > 0) {
            const anim = animGroup.animatables[0].animations[0];
            if (anim) return anim.framePerSecond || 30;
        }
        return 30; // Default to 30fps if not determinable
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
        
        // Add asymmetric margins - less on bottom, more on sides and top
        const marginX = Math.ceil(frame.width * 0.025); // 2.5% of width for horizontal margin
        const marginTopY = Math.ceil(frame.height * 0.025); // 2.5% of height for top margin
        const marginBottomY = Math.ceil(frame.height * 0.01); // 1% of height for bottom margin
        
        left = Math.max(0, left - marginX);
        top = Math.max(0, top - marginTopY);
        right = Math.min(frame.width - 1, right + marginX);
        bottom = Math.min(frame.height - 1, bottom + marginBottomY);
        
        return {
            left: left,
            top: top,
            right: right,
            bottom: bottom,
            width: right - left + 1,
            height: bottom - top + 1
        };
    }
    
    // Modify createSpriteSheet function to respect exact cell dimensions from user input

    function createSpriteSheet() {
        showStatus("Creating transparent sprite sheet...");
        
        // Get parameters
        const numFrames = recordedFrames.length;
        const numColumns = parseInt(columnsInput.value) || 4;
        const numRows = Math.ceil(numFrames / numColumns);
        
        // Get exact cell dimensions from user input
        const cellWidth = parseInt(cellWidthInput.value) || 256;
        const cellHeight = parseInt(cellHeightInput.value) || 256;
        
        // Check if optimization is enabled
        const shouldOptimize = document.getElementById('optimizeInput').checked;
        
        // Set the capture canvas size for the entire sprite sheet
        // Use exact dimensions based on user input
        captureCanvas.width = cellWidth * numColumns;
        captureCanvas.height = cellHeight * numRows;
        
        // Clear the canvas with transparent background
        captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
        
        if (shouldOptimize) {
            // With optimization: analyze frames but maintain exact cell size
            const frameBounds = recordedFrames.map(frame => analyzeFrameContent(frame));
            
            for (let i = 0; i < numFrames; i++) {
                const row = Math.floor(i / numColumns);
                const col = i % numColumns;
                
                // Calculate target position on sprite sheet using exact cell dimensions
                const targetX = col * cellWidth;
                const targetY = row * cellHeight;
                
                const frame = recordedFrames[i];
                const bounds = frameBounds[i];
                
                // Calculate centering offsets within the fixed cell
                const offsetX = Math.floor((cellWidth - bounds.width) / 2);
                const offsetY = Math.floor((cellHeight - bounds.height) / 2);
                
                // Draw the content portion of the frame centered in its fixed-size cell
                captureContext.drawImage(
                    frame,
                    bounds.left, bounds.top, bounds.width, bounds.height,
                    targetX + offsetX, targetY + offsetY, bounds.width, bounds.height
                );
                
                // Draw cell borders for visualization (optional)
                // captureContext.strokeStyle = 'rgba(255, 0, 0, 0.3)';
                // captureContext.strokeRect(targetX, targetY, cellWidth, cellHeight);
            }
        } else {
            // Without optimization: just place each frame directly in a cell of exact size
            for (let i = 0; i < numFrames; i++) {
                const row = Math.floor(i / numColumns);
                const col = i % numColumns;
                
                // Calculate target position based on exact cell dimensions
                const targetX = col * cellWidth;
                const targetY = row * cellHeight;
                
                // Draw the full frame scaled to fit the exact cell dimensions
                captureContext.drawImage(
                    recordedFrames[i],
                    0, 0, recordedFrames[i].width, recordedFrames[i].height,
                    targetX, targetY, cellWidth, cellHeight
                );
            }
        }
        
        // Update the metadata to reflect exact cell dimensions
        const metadata = {
            frameWidth: cellWidth,
            frameHeight: cellHeight,
            frames: numFrames,
            columns: numColumns,
            rows: numRows,
            animationName: currentAnimationGroup.name.replace(/[^\w\s-]/g, '_'),  // Sanitize for filename
            optimized: shouldOptimize,
            date: new Date().toISOString(),
            transparent: true,
            cameraPosition: {
                offsetX: cameraOffsetX,
                offsetY: cameraOffsetY
            }
        };
        
        // If optimized, add optimization data
        if (shouldOptimize) {
            metadata.optimizationInfo = {
                note: "Frames are centered within fixed-size cells",
                maintainsExactDimensions: true
            };
        }
        
        // Create downloadable sprite sheet image
        const dataURL = captureCanvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = dataURL;
        downloadLink.download = `${currentAnimationGroup.name.replace(/[^\w\s-]/g, '_')}_spritesheet.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Create downloadable metadata JSON
        const metadataBlob = new Blob([JSON.stringify(metadata, null, 2)], {type: 'application/json'});
        const metadataURL = URL.createObjectURL(metadataBlob);
        const metadataLink = document.createElement('a');
        metadataLink.href = metadataURL;
        metadataLink.download = `${currentAnimationGroup.name.replace(/[^\w\s-]/g, '_')}_metadata.json`;
        document.body.appendChild(metadataLink);
        metadataLink.click();
        document.body.removeChild(metadataLink);
        URL.revokeObjectURL(metadataURL);
        
        // Re-enable record button
        recordBtn.disabled = false;
        recordBtn.textContent = "Record Sprite Sheet";
        
        // Update status message with exact dimensions used
        showStatus(`Sprite sheet created with ${numFrames} frames - Exact cell size: ${cellWidth}x${cellHeight}px`);
    }
    
    // Create camera adjustment UI in the createScene function
    function createCameraControls() {
        // Create a container for camera controls
        const cameraControlPanel = document.createElement('div');
        cameraControlPanel.id = 'cameraControlPanel';
        cameraControlPanel.className = 'control-panel';
        cameraControlPanel.style.position = 'absolute';
        cameraControlPanel.style.left = '10px';
        cameraControlPanel.style.top = '10px';
        cameraControlPanel.style.backgroundColor = 'rgba(0,0,0,0.7)';
        cameraControlPanel.style.borderRadius = '5px';
        cameraControlPanel.style.padding = '10px';
        cameraControlPanel.style.color = 'white';
        cameraControlPanel.style.zIndex = '100';
        cameraControlPanel.style.display = 'flex';
        cameraControlPanel.style.flexDirection = 'column';
        cameraControlPanel.style.alignItems = 'center';
        
        // Add a title
        const title = document.createElement('div');
        title.textContent = 'Camera Position';
        title.style.marginBottom = '10px';
        title.style.fontWeight = 'bold';
        cameraControlPanel.appendChild(title);
        
        // Create a grid for direction buttons
        const controlGrid = document.createElement('div');
        controlGrid.style.display = 'grid';
        controlGrid.style.gridTemplateColumns = '1fr 1fr 1fr';
        controlGrid.style.gridTemplateRows = '1fr 1fr 1fr';
        controlGrid.style.gap = '3px';
        
        // Create buttons for different directions
        const buttonStyle = 'width:32px; height:32px; background:#444; border:none; color:white; cursor:pointer; border-radius:4px; font-weight:bold;';
        
        // Top row
        const btnEmpty1 = document.createElement('button');
        btnEmpty1.style = buttonStyle;
        btnEmpty1.style.visibility = 'hidden';
        
        const btnUp = document.createElement('button');
        btnUp.innerHTML = '▲';
        btnUp.style = buttonStyle;
        btnUp.onclick = () => adjustCameraPosition(0, 1);
        
        const btnEmpty2 = document.createElement('button');
        btnEmpty2.style = buttonStyle;
        btnEmpty2.style.visibility = 'hidden';
        
        // Middle row
        const btnLeft = document.createElement('button');
        btnLeft.innerHTML = '◀';
        btnLeft.style = buttonStyle;
        btnLeft.onclick = () => adjustCameraPosition(-1, 0);
        
        const btnReset = document.createElement('button');
        btnReset.innerHTML = '⌂';
        btnReset.style = buttonStyle;
        btnReset.onclick = resetCameraPosition;
        
        const btnRight = document.createElement('button');
        btnRight.innerHTML = '▶';
        btnRight.style = buttonStyle;
        btnRight.onclick = () => adjustCameraPosition(1, 0);
        
        // Bottom row
        const btnEmpty3 = document.createElement('button');
        btnEmpty3.style = buttonStyle;
        btnEmpty3.style.visibility = 'hidden';
        
        const btnDown = document.createElement('button');
        btnDown.innerHTML = '▼';
        btnDown.style = buttonStyle;
        btnDown.onclick = () => adjustCameraPosition(0, -1);
        
        const btnEmpty4 = document.createElement('button');
        btnEmpty4.style = buttonStyle;
        btnEmpty4.style.visibility = 'hidden';
        
        // Add all buttons to the grid
        controlGrid.appendChild(btnEmpty1);
        controlGrid.appendChild(btnUp);
        controlGrid.appendChild(btnEmpty2);
        
        controlGrid.appendChild(btnLeft);
        controlGrid.appendChild(btnReset);
        controlGrid.appendChild(btnRight);
        
        controlGrid.appendChild(btnEmpty3);
        controlGrid.appendChild(btnDown);
        controlGrid.appendChild(btnEmpty4);
        
        cameraControlPanel.appendChild(controlGrid);
        
        // Add step size control
        const stepControl = document.createElement('div');
        stepControl.style.marginTop = '10px';
        stepControl.style.width = '100%';
        stepControl.style.textAlign = 'center';
        
        const stepLabel = document.createElement('label');
        stepLabel.textContent = 'Step Size:';
        stepLabel.style.display = 'block';
        stepLabel.style.marginBottom = '5px';
        stepLabel.style.fontSize = '12px';
        stepControl.appendChild(stepLabel);
        
        const stepSelect = document.createElement('select');
        stepSelect.style.width = '100%';
        stepSelect.style.backgroundColor = '#333';
        stepSelect.style.color = 'white';
        stepSelect.style.border = 'none';
        stepSelect.style.padding = '3px';
        
        [0.1, 0.25, 0.5, 1.0].forEach(step => {
            const option = document.createElement('option');
            option.value = step;
            option.textContent = step;
            if (step === cameraAdjustStep) {
                option.selected = true;
            }
            stepSelect.appendChild(option);
        });
        
        stepSelect.onchange = (e) => {
            window.cameraAdjustStep = parseFloat(e.target.value);
            showStatus(`Camera step size set to ${window.cameraAdjustStep}`);
        };
        
        stepControl.appendChild(stepSelect);
        cameraControlPanel.appendChild(stepControl);
        
        // Add keyboard instructions
        const keyboardHelp = document.createElement('div');
        keyboardHelp.style.marginTop = '10px';
        keyboardHelp.style.fontSize = '11px';
        keyboardHelp.style.color = '#aaa';
        keyboardHelp.textContent = 'Use arrow keys to adjust camera position';
        cameraControlPanel.appendChild(keyboardHelp);
        
        // Add to document
        document.body.appendChild(cameraControlPanel);
        
        // Add keyboard controls
        document.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowUp':
                    adjustCameraPosition(0, 1);
                    break;
                case 'ArrowDown':
                    adjustCameraPosition(0, -1);
                    break;
                case 'ArrowLeft':
                    adjustCameraPosition(-1, 0);
                    break;
                case 'ArrowRight':
                    adjustCameraPosition(1, 0);
                    break;
                case 'Home':
                    resetCameraPosition();
                    break;
            }
        });
        
        return cameraControlPanel;
    }
    
    // Create and set up the scene
    try {
        scene = await createScene();
        
        // Only start render loop after scene is created
        engine.runRenderLoop(() => {
            if (scene) {
                scene.render();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            engine.resize();
        });
    } catch (error) {
        console.error("Error creating scene:", error);
    }

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
        // Resize the engine
        engine.resize();
        
        // Ensure camera maintains square ratio
        updateOrthoCamera();
        
        // Update canvas size to remain square
        const size = Math.min(window.innerHeight, window.innerWidth);
        canvas.style.width = `${size}px`;
        canvas.style.height = `${size}px`;
    });
});
