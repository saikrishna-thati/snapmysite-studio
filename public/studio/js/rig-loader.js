/**
 * Rig Loader for Snapmy.site Film Engine v2
 * 
 * Automatically selects between Three.js and CSS fallback based on
 * device capabilities and user preferences.
 */

import { ThreeJSRig } from './threejs-rig.js';
import { CSSFallbackRig } from './css-fallback.js';

class RigLoader {
  constructor(options = {}) {
    this.options = options;
    this.rig = null;
    this.rigType = null;
  }

  async load() {
    // Determine which rig to use
    if (this.shouldUseThreeJS()) {
      try {
        this.rigType = 'threejs';
        this.rig = new ThreeJSRig(this.options);
        console.log('Using Three.js rig for 3D motion');
      } catch (error) {
        console.warn('Three.js rig failed to initialize, falling back to CSS:', error);
        this.rigType = 'css';
        this.rig = new CSSFallbackRig(this.options);
      }
    } else {
      this.rigType = 'css';
      this.rig = new CSSFallbackRig(this.options);
      console.log('Using CSS fallback rig');
    }

    return this.rig;
  }

  shouldUseThreeJS() {
    // Check if Three.js is available
    if (typeof THREE === 'undefined') {
      return false;
    }

    // Check for hardware acceleration
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!gl) {
      return false;
    }

    // Check device capabilities
    const hardwareConcurrency = navigator.hardwareConcurrency || 2;
    const deviceMemory = navigator.deviceMemory || 4;

    // Use Three.js on capable devices
    const isCapable = hardwareConcurrency >= 4 && deviceMemory >= 4;

    // Respect user preference for reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Check for explicit CSS fallback preference
    const forceCSSFallback = this.options.forceCSSFallback || false;

    return isCapable && !prefersReducedMotion && !forceCSSFallback;
  }

  getRigType() {
    return this.rigType;
  }

  getRig() {
    return this.rig;
  }

  static async create(options = {}) {
    const loader = new RigLoader(options);
    const rig = await loader.load();
    return { rig, rigType: loader.getRigType() };
  }
}

export { RigLoader };