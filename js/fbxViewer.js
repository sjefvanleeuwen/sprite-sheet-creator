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
    
    // Display status messages to the user
    function showStatus(message, isError = false) {
        statusElement.textContent = message;
        statusElement.className = isError ? 'error' : 'info';
        console.log(isError ? 'ERROR: ' : 'INFO: ', message);
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
            Math.PI/2,    // Alpha - horizontal rotation (PI/2 for side view)
            Math.PI/3,    // Beta - vertical rotation (PI/3 for elevated angle)
            15,          // Radius - distance from target
            new BABYLON.Vector3(0, 1, 0),  // Target point
            scene
        );
        
        // Use orthographic camera for true 2D side view
        camera.mode = BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
        
        // Set orthographic scale based on screen size
        const aspectRatio = engine.getAspectRatio(camera);
        const orthoSize = 5;
        camera.orthoTop = orthoSize;
        camera.orthoBottom = -orthoSize;
        camera.orthoLeft = -orthoSize * aspectRatio;
        camera.orthoRight = orthoSize * aspectRatio;
        
        // Limit camera controls
        camera.lowerRadiusLimit = camera.upperRadiusLimit = camera.radius;
        camera.lowerAlphaLimit = camera.upperAlphaLimit = camera.alpha;
        camera.lowerBetaLimit = camera.upperBetaLimit = camera.beta;
        
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
    
    function createSpriteSheet() {
        showStatus("Creating sprite sheet...");
        
        // Get parameters
        const numFrames = recordedFrames.length;
        let numColumns = parseInt(columnsInput.value) || 4;
        if (numColumns < 1) numColumns = 4;
        
        // Calculate rows needed
        const numRows = Math.ceil(numFrames / numColumns);
        
        // Determine frame size - assuming all frames are the same size
        const frameWidth = recordedFrames[0].width;
        const frameHeight = recordedFrames[0].height;
        
        // Set the capture canvas size
        captureCanvas.width = frameWidth * numColumns;
        captureCanvas.height = frameHeight * numRows;
        
        // Clear the canvas
        captureContext.clearRect(0, 0, captureCanvas.width, captureCanvas.height);
        
        // Draw each frame to the sprite sheet
        for (let i = 0; i < numFrames; i++) {
            const row = Math.floor(i / numColumns);
            const col = i % numColumns;
            const x = col * frameWidth;
            const y = row * frameHeight;
            
            captureContext.drawImage(recordedFrames[i], x, y, frameWidth, frameHeight);
        }
        
        // Create a downloadable link
        const dataURL = captureCanvas.toDataURL('image/png');
        const downloadLink = document.createElement('a');
        downloadLink.href = dataURL;
        downloadLink.download = `${currentAnimationGroup.name}_spritesheet.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        
        // Re-enable record button
        recordBtn.disabled = false;
        recordBtn.textContent = "Record Sprite Sheet";
        
        showStatus(`Sprite sheet created with ${numFrames} frames (${numColumns} columns x ${numRows} rows)`);
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
            
            // Update orthographic camera settings on resize
            if (camera) {
                const aspectRatio = engine.getAspectRatio(camera);
                const orthoSize = 5;
                camera.orthoTop = orthoSize;
                camera.orthoBottom = -orthoSize;
                camera.orthoLeft = -orthoSize * aspectRatio;
                camera.orthoRight = orthoSize * aspectRatio;
            }
        });
    });
});
