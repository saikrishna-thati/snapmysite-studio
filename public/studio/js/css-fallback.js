/**
 * CSS Fallback Rig for Snapmy.site Film Engine v2
 * 
 * Lightweight CSS-based animation system as fallback when Three.js is unavailable
 * or for reduced-performance scenarios. Maintains compatibility with existing
 * HyperFrames/GSAP composition system.
 */

class CSSFallbackRig {
  constructor(options = {}) {
    this.container = options.container || document.body;
    this.width = options.width || 1920;
    this.height = options.height || 1080;
    this.fps = options.fps || 60;
    
    // Animation state
    this.currentTime = 0;
    this.totalDuration = 30;
    this.isPlaying = false;
    this.currentFrame = 0;
    this.totalFrames = this.totalDuration * this.fps;
    
    // Elements
    this.elements = new Map();
    this.animations = new Map();
    
    // Events
    this.onFrameUpdate = null;
    this.onAnimationComplete = null;
    
    // GSAP integration
    this.gsapTimeline = null;
    
    // Initialize container
    this.setupContainer();
  }

  setupContainer() {
    // Create main stage container
    this.stage = document.createElement('div');
    this.stage.className = 'css-fallback-stage';
    this.stage.style.cssText = `
      position: relative;
      width: ${this.width}px;
      height: ${this.height}px;
      overflow: hidden;
      background: #1a1a2e;
      transform-origin: top left;
    `;
    
    this.container.appendChild(this.stage);
  }

  addDevice(deviceId, options = {}) {
    const deviceType = options.type || 'laptop';
    const position = options.position || { x: 0, y: 0 };
    const scale = options.scale || 1;
    
    const device = document.createElement('div');
    device.className = `css-device css-device-${deviceType}`;
    device.id = deviceId;
    device.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
      transform: scale(${scale});
      pointer-events: none;
    `;
    
    // Add device-specific structure
    this.createDeviceCSS(device, deviceType);
    
    this.stage.appendChild(device);
    this.elements.set(deviceId, device);
    
    return device;
  }

  createDeviceCSS(device, type) {
    switch (type) {
      case 'laptop':
        device.innerHTML = `
          <div class="css-laptop-screen">
            <div class="css-laptop-display"></div>
          </div>
          <div class="css-laptop-base"></div>
          <div class="css-laptop-hinge"></div>
        `;
        break;
      case 'phone':
        device.innerHTML = `
          <div class="css-phone-body">
            <div class="css-phone-screen"></div>
          </div>
        `;
        break;
      case 'browser':
        device.innerHTML = `
          <div class="css-browser-frame">
            <div class="css-browser-urlbar"></div>
            <div class="css-browser-content"></div>
          </div>
        `;
        break;
    }
  }

  setDeviceTexture(deviceId, textureUrl, options = {}) {
    const device = this.elements.get(deviceId);
    if (!device) return;
    
    const display = device.querySelector('.css-laptop-display, .css-phone-screen, .css-browser-content');
    if (!display) return;
    
    const isVideo = textureUrl.match(/\.(mp4|webm|mov)$/i) || options.isVideo;
    
    if (isVideo) {
      display.innerHTML = `<video src="${textureUrl}" loop muted autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>`;
    } else {
      display.style.backgroundImage = `url(${textureUrl})`;
      display.style.backgroundSize = 'cover';
      display.style.backgroundPosition = 'center';
    }
  }

  addUIPlane(planeId, options = {}) {
    const position = options.position || { x: 0, y: 0 };
    const size = options.size || { width: 400, height: 300 };
    const textureUrl = options.textureUrl || null;
    
    const plane = document.createElement('div');
    plane.className = 'css-ui-plane';
    plane.id = planeId;
    plane.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
      width: ${size.width}px;
      height: ${size.height}px;
      background: #ffffff;
      opacity: 0.95;
      pointer-events: none;
      transform-style: preserve-3d;
    `;
    
    if (textureUrl) {
      this.setPlaneTexture(planeId, textureUrl);
    }
    
    this.stage.appendChild(plane);
    this.elements.set(planeId, plane);
    
    return plane;
  }

  setPlaneTexture(planeId, textureUrl, options = {}) {
    const plane = this.elements.get(planeId);
    if (!plane) return;
    
    const isVideo = textureUrl.match(/\.(mp4|webm|mov)$/i) || options.isVideo;
    
    if (isVideo) {
      plane.innerHTML = `<video src="${textureUrl}" loop muted autoplay playsinline style="width: 100%; height: 100%; object-fit: cover;"></video>`;
    } else {
      plane.style.backgroundImage = `url(${textureUrl})`;
      plane.style.backgroundSize = 'cover';
      plane.style.backgroundPosition = 'center';
    }
  }

  setupCursor(options = {}) {
    const cursor = document.createElement('div');
    cursor.className = 'css-cursor';
    cursor.style.cssText = `
      position: absolute;
      width: 20px;
      height: 20px;
      background: white;
      border-radius: 50%;
      pointer-events: none;
      z-index: 1000;
      box-shadow: 0 0 10px rgba(74, 144, 226, 0.5);
      transform: translate(-50%, -50%);
    `;
    
    this.stage.appendChild(cursor);
    this.elements.set('cursor', cursor);
    
    return cursor;
  }

  setCursorPath(path, options = {}) {
    if (!this.elements.has('cursor')) {
      this.setupCursor();
    }
    
    const cursor = this.elements.get('cursor');
    
    // Create GSAP timeline for cursor animation
    if (typeof gsap !== 'undefined') {
      this.gsapTimeline = gsap.timeline({
        onUpdate: () => {
          if (this.onFrameUpdate) {
            this.currentFrame = Math.floor(gsap.timeline().time() * this.fps);
            this.onFrameUpdate(this.currentFrame, gsap.timeline().time());
          }
        }
      });
      
      path.points.forEach((point, index) => {
        const duration = point.duration || 1;
        
        this.gsapTimeline.to(cursor, {
          left: point.position.x * this.width / 4 + this.width / 2,
          top: -point.position.y * this.height / 2 + this.height / 2,
          scale: point.scale || 1,
          duration: duration,
          ease: this.getGSAPEasing(point.easing || 'power2.inOut')
        });
        
        if (point.action === 'click') {
          this.gsapTimeline.to(cursor, {
            scale: 0.8,
            duration: 0.1,
            yoyo: true,
            repeat: 1
          }, `-=${duration * 0.8}`);
        }
      });
    }
  }

  getGSAPEasing(easingType) {
    const easingMap = {
      'ease-in': 'power2.in',
      'ease-out': 'power2.out',
      'ease-in-out': 'power2.inOut',
      'linear': 'none',
      'bounce': 'bounce.out'
    };
    return easingMap[easingType] || 'power2.inOut';
  }

  addTypography(elementId, options = {}) {
    const text = options.text || '';
    const position = options.position || { x: 0, y: 0 };
    const font = options.font || 'Arial';
    const size = options.size || 24;
    const color = options.color || '#ffffff';
    
    const typography = document.createElement('div');
    typography.className = 'css-typography';
    typography.id = elementId;
    typography.style.cssText = `
      position: absolute;
      left: ${position.x}px;
      top: ${position.y}px;
      font-family: ${font};
      font-size: ${size}px;
      color: ${color};
      font-weight: bold;
      pointer-events: none;
      white-space: nowrap;
      text-shadow: 0 2px 4px rgba(0,0,0,0.5);
    `;
    
    typography.textContent = text;
    this.stage.appendChild(typography);
    this.elements.set(elementId, typography);
    
    return typography;
  }

  animateCamera(path, options = {}) {
    // Animate the entire stage for camera movement effect
    if (typeof gsap !== 'undefined' && path.points) {
      const cameraTimeline = gsap.timeline();
      
      path.points.forEach((point, index) => {
        const duration = point.duration || 2;
        
        cameraTimeline.to(this.stage, {
          scale: 1 + (point.intensity || 0.5) * 0.2,
          x: -point.position.x * 20,
          y: -point.position.y * 20,
          rotation: point.rotation || 0,
          duration: duration,
          ease: this.getGSAPEasing(point.easing || 'power2.inOut')
        });
      });
      
      return cameraTimeline;
    }
  }

  play(duration = this.totalDuration) {
    this.totalDuration = duration;
    this.totalFrames = duration * this.fps;
    this.currentTime = 0;
    this.currentFrame = 0;
    this.isPlaying = true;
    
    if (this.gsapTimeline) {
      this.gsapTimeline.play();
    }
    
    this.startTime = performance.now();
    this.animate();
  }

  pause() {
    this.isPlaying = false;
    if (this.gsapTimeline) {
      this.gsapTimeline.pause();
    }
  }

  seekToFrame(frame) {
    this.currentFrame = Math.max(0, Math.min(frame, this.totalFrames));
    this.currentTime = this.currentFrame / this.fps;
    
    if (this.gsapTimeline) {
      this.gsapTimeline.time(this.currentTime);
    }
    
    if (this.onFrameUpdate) {
      this.onFrameUpdate(this.currentFrame, this.currentTime);
    }
  }

  seekToTime(time) {
    const frame = Math.floor(time * this.fps);
    this.seekToFrame(frame);
  }

  animate() {
    if (!this.isPlaying) return;
    
    const currentTime = performance.now();
    const deltaTime = (currentTime - this.startTime) / 1000;
    this.currentTime = deltaTime;
    this.currentFrame = Math.floor(this.currentTime * this.fps);
    
    if (this.onFrameUpdate) {
      this.onFrameUpdate(this.currentFrame, this.currentTime);
    }
    
    if (this.currentTime >= this.totalDuration) {
      this.pause();
      if (this.onAnimationComplete) {
        this.onAnimationComplete();
      }
      return;
    }
    
    requestAnimationFrame(() => this.animate());
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    
    this.stage.style.width = `${width}px`;
    this.stage.style.height = `${height}px`;
  }

  dispose() {
    this.pause();
    
    if (this.gsapTimeline) {
      this.gsapTimeline.kill();
    }
    
    if (this.stage && this.stage.parentNode) {
      this.stage.parentNode.removeChild(this.stage);
    }
    
    this.elements.clear();
    this.animations.clear();
  }

  // Check if CSS fallback should be used
  static shouldUseFallback() {
    // Use fallback if Three.js is not available or on low-end devices
    return typeof THREE === 'undefined' || 
           !navigator.gpu ||
           navigator.hardwareConcurrency < 4;
  }
}

// Add CSS styles for fallback elements
const fallbackStyles = `
  .css-fallback-stage {
    transform-style: preserve-3d;
    perspective: 1000px;
  }
  
  .css-device-laptop {
    width: 300px;
    height: 200px;
  }
  
  .css-laptop-screen {
    width: 280px;
    height: 180px;
    background: #1a1a1a;
    border-radius: 8px;
    position: absolute;
    top: 0;
    left: 10px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  }
  
  .css-laptop-display {
    width: 260px;
    height: 160px;
    background: #000;
    margin: 10px;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .css-laptop-base {
    width: 300px;
    height: 15px;
    background: #2a2a2a;
    position: absolute;
    bottom: 0;
    left: 0;
    border-radius: 0 0 8px 8px;
  }
  
  .css-laptop-hinge {
    width: 300px;
    height: 8px;
    background: #3a3a3a;
    position: absolute;
    bottom: 15px;
    left: 0;
  }
  
  .css-device-phone {
    width: 60px;
    height: 120px;
  }
  
  .css-phone-body {
    width: 60px;
    height: 120px;
    background: #1a1a1a;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
  }
  
  .css-phone-screen {
    width: 55px;
    height: 110px;
    background: #000;
    margin: 5px;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .css-device-browser {
    width: 400px;
    height: 300px;
  }
  
  .css-browser-frame {
    width: 400px;
    height: 300px;
    background: #2a2a2a;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    overflow: hidden;
  }
  
  .css-browser-urlbar {
    width: 380px;
    height: 20px;
    background: #3a3a3a;
    margin: 10px;
    border-radius: 4px;
  }
  
  .css-browser-content {
    width: 380px;
    height: 260px;
    background: #fff;
    margin: 0 10px 10px;
    border-radius: 4px;
    overflow: hidden;
  }
  
  .css-ui-plane {
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    border-radius: 4px;
  }
  
  .css-typography {
    text-shadow: 0 2px 4px rgba(0,0,0,0.8);
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = fallbackStyles;
  document.head.appendChild(styleSheet);
}

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CSSFallbackRig };
} else {
  window.CSSFallbackRig = CSSFallbackRig;
}

export { CSSFallbackRig };