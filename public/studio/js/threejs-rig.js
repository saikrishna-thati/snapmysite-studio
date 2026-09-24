// Subagent 5: 3D Isometric UI Depth & Layering Engine
import * as THREE from 'https://esm.sh/three@0.169.0';

export class IsometricRig3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, canvas.clientWidth / canvas.clientHeight, 1, 3000);
    this.camera.position.set(0, -60, 850);

    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    this.renderer.setSize(canvas.clientWidth, canvas.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    this.setupMultiPlaneMesh();
  }

  setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(200, 400, 600);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    this.scene.add(dirLight);

    const accentLight = new THREE.PointLight(0x3b82f6, 2.5, 1200);
    accentLight.position.set(-300, 200, 300);
    this.scene.add(accentLight);
  }

  setupMultiPlaneMesh() {
    this.planes = new THREE.Group();

    // Base background layer (Z = 0)
    const baseGeo = new THREE.PlaneGeometry(1280, 720);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.1 });
    this.baseMesh = new THREE.Mesh(baseGeo, baseMat);
    this.baseMesh.position.z = 0;
    this.baseMesh.receiveShadow = true;
    this.planes.add(this.baseMesh);

    // Floating UI Cards (Z = 35) with elevated shadows
    const cardGeo = new THREE.PlaneGeometry(360, 240);
    const cardMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.1, metalness: 0.2 });
    for (let i = 0; i < 3; i++) {
      const card = new THREE.Mesh(cardGeo, cardMat);
      card.position.set(-400 + i * 400, -80, 35);
      card.castShadow = true;
      card.receiveShadow = true;
      this.planes.add(card);
    }

    this.scene.add(this.planes);
  }

  // Smooth continuous camera flight along keyframe targets
  setCameraTarget(x, y, z, pitch = 0, yaw = 0, duration = 1200) {
    const startPos = this.camera.position.clone();
    const targetPos = new THREE.Vector3(x, y, z);
    const startTime = performance.now();

    const animateFlight = (now) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);

      this.camera.position.lerpVectors(startPos, targetPos, ease);
      this.camera.rotation.x = pitch * (Math.PI / 180) * ease;
      this.camera.rotation.y = yaw * (Math.PI / 180) * ease;

      this.renderer.render(this.scene, this.camera);

      if (progress < 1) {
        requestAnimationFrame(animateFlight);
      }
    };
    requestAnimationFrame(animateFlight);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
