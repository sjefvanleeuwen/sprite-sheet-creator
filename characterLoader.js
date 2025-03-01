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
                window.replaceCharacter(container);
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
