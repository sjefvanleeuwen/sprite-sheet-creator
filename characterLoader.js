window.addEventListener('sceneReady', () => {
    document.getElementById('characterUpload').addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const statusMessage = document.getElementById('statusMessage');
        statusMessage.textContent = 'Loading character...';

        try {
            const scene = window.scene;
            if (!scene) throw new Error('Scene not initialized');

            const arrayBuffer = await file.arrayBuffer();
            const blob = new Blob([arrayBuffer], { type: 'model/gltf-binary' });
            const blobUrl = URL.createObjectURL(blob);

            BABYLON.SceneLoader.LoadAssetContainer("", blobUrl, scene, function (container) {
                // Clear previous character completely
                if (window.currentCharacter) {
                    // Stop and dispose all animations
                    scene.animationGroups.slice().forEach(group => {
                        group.stop();
                        group.dispose();
                    });
                    
                    // Remove all meshes related to current character
                    scene.meshes.slice().forEach(mesh => {
                        if (mesh !== scene.ground) { // Keep the ground
                            mesh.dispose();
                        }
                    });

                    // Clear any skeletons
                    scene.skeletons.slice().forEach(skeleton => {
                        skeleton.dispose();
                    });

                    window.currentCharacter = null;
                    window.currentAnimationGroup = null;
                }

                // Add new meshes and animations
                container.addAllToScene();
                window.currentCharacter = container.meshes[0];
                window.animationGroups = container.animationGroups;
                
                // Position the new character
                window.currentCharacter.position = new BABYLON.Vector3(0, 0, 0);
                window.currentCharacter.rotation = new BABYLON.Vector3(0, Math.PI/2, 0);
                window.currentCharacter.scaling = new BABYLON.Vector3(1, 1, 1);

                // Update animation list
                const animationList = document.getElementById('animationList');
                animationList.innerHTML = '';
                container.animationGroups.forEach((group, index) => {
                    const option = document.createElement('option');
                    option.value = index;
                    option.text = group.name;
                    animationList.appendChild(option);
                });

                // Play first animation if available
                if (container.animationGroups.length > 0) {
                    window.currentAnimationGroup = container.animationGroups[0];
                    window.currentAnimationGroup.start(true);
                }

                statusMessage.textContent = 'Character loaded successfully!';
                URL.revokeObjectURL(blobUrl);
            }, null, function (error) {
                statusMessage.textContent = 'Error loading character: ' + error.message;
                URL.revokeObjectURL(blobUrl);
            }, ".glb");

        } catch (error) {
            statusMessage.textContent = 'Error: ' + error.message;
        }
    });
});
