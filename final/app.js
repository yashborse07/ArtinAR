/*
 * Copyright 2017 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Query for WebXR support. If there's no support for the `immersive-ar` mode,
 * show an error.
 */
(async function() {
  const isArSessionSupported = navigator.xr && navigator.xr.isSessionSupported && await navigator.xr.isSessionSupported("immersive-ar");
  if (isArSessionSupported) {
    document.getElementById("enter-ar").addEventListener("click", window.app.activateXR)
  } else {
    onNoXRDevice();
  }
})();

let selectedModel = '../assets/scene.gltf';  // Default model

document.getElementById('model1-button').addEventListener('click', () => {
  selectedModel = '../assets/scene.gltf';
  console.log('Selected Model 1');
});

document.getElementById('model2-button').addEventListener('click', () => {
  selectedModel = '../assets/sceneD.gltf';
  console.log('Selected Model 2');
});

class App {
  constructor() {
    this.modelPlaced = false;  // Flag to track if the model has been placed
  }

  activateXR = async () => {
    try {
      console.log("Attempting to initialize WebXR session...");
      // Initialize a WebXR session using "immersive-ar".
      this.xrSession = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ['hit-test', 'dom-overlay'],
        domOverlay: { root: document.body }
      });
      console.log("WebXR session initialized successfully.");

      // Create the canvas that will contain our camera's background and our virtual scene.
      this.createXRCanvas();

      // With everything set up, start the app.
      await this.onSessionStarted();
    } catch(e) {
      console.log(e);
      onNoXRDevice();
    }
  }

  createXRCanvas() {
    console.log("Creating XR canvas...");
    this.canvas = document.createElement("canvas");
    document.body.appendChild(this.canvas);
    this.gl = this.canvas.getContext("webgl", {xrCompatible: true});
    console.log("XR canvas created successfully.");

    this.xrSession.updateRenderState({
      baseLayer: new XRWebGLLayer(this.xrSession, this.gl)
    });
  }

  onSessionStarted = async () => {
    console.log("Starting XR session...");
    document.body.classList.add('ar');
    this.setupThreeJs();
    this.localReferenceSpace = await this.xrSession.requestReferenceSpace('local');
    this.viewerSpace = await this.xrSession.requestReferenceSpace('viewer');
    this.hitTestSource = await this.xrSession.requestHitTestSource({ space: this.viewerSpace });
    this.xrSession.requestAnimationFrame(this.onXRFrame);
    this.xrSession.addEventListener("select", this.onSelect);
    console.log("XR session started successfully.");
  }

  onSelect = () => {
    console.log('Tapped!');
    if (this.modelPlaced) {
      console.log('Model already placed, ignoring tap.');
      return;
    }

    const loader = new THREE.GLTFLoader();
    loader.load(selectedModel, (gltf) => {
      console.log('Model loaded successfully:', gltf);
      window.customModel = gltf.scene;
      console.log('Custom model set:', window.customModel);

      if (!this.modelPlaced && window.customModel) {
        console.log('Placing the model for the first time...');
        const clone = window.customModel.clone();
        clone.position.copy(this.reticle.position);
        this.scene.add(clone);
        console.log('Model placed at:', clone.position);
        const shadowMesh = this.scene.children.find(c => c.name === 'shadowMesh');
        if (shadowMesh) {
          shadowMesh.position.y = clone.position.y;
          console.log('Shadow mesh updated.');
        }
        this.modelPlaced = true;
      }
    }, undefined, (error) => {
      console.error('An error occurred loading the model:', error);
    });
  }

  onXRFrame = (time, frame) => {
    console.log("XR Frame");
    this.xrSession.requestAnimationFrame(this.onXRFrame);
    const framebuffer = this.xrSession.renderState.baseLayer.framebuffer
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, framebuffer)
    this.renderer.setFramebuffer(framebuffer);
    const pose = frame.getViewerPose(this.localReferenceSpace);
    if (pose) {
      const view = pose.views[0];
      const viewport = this.xrSession.renderState.baseLayer.getViewport(view);
      this.renderer.setSize(viewport.width, viewport.height)
      this.camera.matrix.fromArray(view.transform.matrix)
      this.camera.projectionMatrix.fromArray(view.projectionMatrix);
      this.camera.updateMatrixWorld(true);
      const hitTestResults = frame.getHitTestResults(this.hitTestSource);
      if (!this.stabilized && hitTestResults.length > 0) {
        this.stabilized = true;
        document.body.classList.add('stabilized');
      }
      if (hitTestResults.length > 0) {
        const hitPose = hitTestResults[0].getPose(this.localReferenceSpace);
        this.reticle.visible = true;
        this.reticle.position.set(hitPose.transform.position.x, hitPose.transform.position.y, hitPose.transform.position.z)
        this.reticle.updateMatrixWorld(true);
      }
      this.renderer.render(this.scene, this.camera)
    }
  }

  setupThreeJs() {
    console.log("Setting up Three.js...");
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      preserveDrawingBuffer: true,
      canvas: this.canvas,
      context: this.gl
    });
    this.renderer.autoClear = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = DemoUtils.createLitScene();
    this.reticle = new Reticle();
    this.scene.add(this.reticle);
    this.camera = new THREE.PerspectiveCamera();
    this.camera.matrixAutoUpdate = false;
    console.log("Three.js setup completed.");
  }
};

window.app = new App();

