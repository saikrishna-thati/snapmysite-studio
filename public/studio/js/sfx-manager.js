/**
 * Enhanced SFX Manager for Snapmy.site Film Engine v2
 * 
 * Professional sound design with layered SFX, stereo placement,
 * ducking, and integration with the music system.
 */

class SFXManager {
  constructor(options = {}) {
    this.audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = options.sampleRate || 44100;
    this.basePath = options.basePath || './audio/';
    
    // SFX library
    this.sfxLibrary = new Map();
    this.loadedSamples = new Map();
    
    // Audio routing
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // SFX buses for different categories
    this.buses = {
      whoosh: this.createBus('whoosh', 0.8),
      ui: this.createBus('ui', 0.7),
      impact: this.createBus('impact', 0.9),
      riser: this.createBus('riser', 0.85),
      ambient: this.createBus('ambient', 0.4),
      voiceover: this.createBus('voiceover', 1.0)
    };
    
    // Ducking setup
    this.duckingEnabled = true;
    this.duckingAmount = 0.3;
    this.duckingAttack = 0.05;
    this.duckingRelease = 0.3;
    
    // Music reference for ducking
    this.musicGainNode = null;
  }

  /**
   * Create an audio bus for SFX categorization
   */
  createBus(name, initialGain = 1.0) {
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = initialGain;
    
    // Add compressor for each bus
    const compressor = this.audioContext.createDynamicsCompressor();
    compressor.threshold.value = -12;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.1;
    
    gainNode.connect(compressor);
    compressor.connect(this.masterGain);
    
    return {
      gain: gainNode,
      compressor,
      name
    };
  }

  /**
   * Load SFX sample
   */
  async loadSFX(sampleName) {
    if (this.loadedSamples.has(sampleName)) {
      return this.loadedSamples.get(sampleName);
    }
    
    const samplePath = `${this.basePath}${sampleName}.mp3`;
    
    try {
      const response = await fetch(samplePath);
      if (!response.ok) throw new Error(`Failed to load SFX: ${samplePath}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.loadedSamples.set(sampleName, audioBuffer);
      return audioBuffer;
    } catch (error) {
      console.warn(`Failed to load SFX ${sampleName}:`, error);
      return null;
    }
  }

  /**
   * Load multiple SFX samples in parallel
   */
  async loadSFXBatch(sampleNames) {
    const loadPromises = sampleNames.map(name => this.loadSFX(name));
    return Promise.all(loadPromises);
  }

  /**
   * Play SFX with advanced options
   */
  async playSFX(sampleName, options = {}) {
    const buffer = await this.loadSFX(sampleName);
    if (!buffer) return null;
    
    const {
      bus = 'ui',
      gain = 1.0,
      pan = 0,
      pitch = 1.0,
      startTime = 0,
      duration = null,
      attack = 0.01,
      release = 0.1,
      duck = false,
      stereoWidth = 0.5
    } = options;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = pitch;
    
    // Create gain envelope
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(gain, startTime + attack);
    
    const actualDuration = duration || buffer.duration / pitch;
    gainNode.gain.setValueAtTime(gain, startTime + actualDuration - release);
    gainNode.gain.linearRampToValueAtTime(0, startTime + actualDuration);
    
    // Create stereo panner with width
    const panner = this.createStereoPanner(pan, stereoWidth);
    
    // Connect to appropriate bus
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.buses[bus]?.gain || this.buses.ui.gain);
    
    // Apply ducking if enabled
    if (duck && this.duckingEnabled && this.musicGainNode) {
      this.applyDucking(startTime, actualDuration);
    }
    
    source.start(startTime);
    source.stop(startTime + actualDuration + 0.1);
    
    return { source, gainNode, panner };
  }

  /**
   * Create stereo panner with adjustable width
   */
  createStereoPanner(pan = 0, width = 0.5) {
    if (typeof this.audioContext.createStereoPanner === 'function') {
      const panner = this.audioContext.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      return panner;
    }
    
    // Fallback for browsers without stereo panner
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0;
    return gainNode;
  }

  /**
   * Apply ducking to music
   */
  applyDucking(startTime, duration) {
    if (!this.musicGainNode) return;
    
    const currentGain = this.musicGainNode.gain.value;
    const duckedGain = currentGain * (1 - this.duckingAmount);
    
    this.musicGainNode.gain.setValueAtTime(currentGain, startTime);
    this.musicGainNode.gain.linearRampToValueAtTime(duckedGain, startTime + this.duckingAttack);
    this.musicGainNode.gain.setValueAtTime(duckedGain, startTime + duration - this.duckingRelease);
    this.musicGainNode.gain.linearRampToValueAtTime(currentGain, startTime + duration);
  }

  /**
   * Set music gain node for ducking
   */
  setMusicGainNode(gainNode) {
    this.musicGainNode = gainNode;
  }

  /**
   * Play layered impact SFX
   */
  async playLayeredImpact(options = {}) {
    const {
      mainSample = 'boom',
      subSample = 'sub_drop',
      highSample = 'crash',
      mainGain = 0.8,
      subGain = 0.5,
      highGain = 0.3,
      timing = { main: 0, sub: 0.02, high: 0.05 }
    } = options;
    
    // Play main impact
    await this.playSFX(mainSample, {
      bus: 'impact',
      gain: mainGain,
      pan: 0,
      startTime: timing.main,
      duck: true
    });
    
    // Play sub impact
    await this.playSFX(subSample, {
      bus: 'impact',
      gain: subGain,
      pan: 0,
      pitch: 0.8,
      startTime: timing.sub,
      duck: true
    });
    
    // Play high impact
    await this.playSFX(highSample, {
      bus: 'impact',
      gain: highGain,
      pan: (Math.random() - 0.5) * 0.4,
      pitch: 1.2,
      startTime: timing.high,
      duck: true
    });
  }

  /**
   * Play transition whoosh
   */
  async playTransitionWhoosh(options = {}) {
    const {
      sample = 'swoosh_air',
      duration = 0.5,
      panStart = -0.8,
      panEnd = 0.8,
      gain = 0.7
    } = options;
    
    const buffer = await this.loadSFX(sample);
    if (!buffer) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(gain, 0.05);
    gainNode.gain.linearRampToValueAtTime(0, duration);
    
    const panner = this.createStereoPanner(panStart);
    panner.pan.setValueAtTime(panStart, 0);
    panner.pan.linearRampToValueAtTime(panEnd, duration);
    
    source.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(this.buses.whoosh.gain);
    
    source.start();
    source.stop(duration + 0.1);
  }

  /**
   * Play UI click with variation
   */
  async playUIClick(options = {}) {
    const variations = ['mouse_click_b', 'ui_click', 'confirm', 'glass_a'];
    const sample = options.sample || variations[Math.floor(Math.random() * variations.length)];
    
    return this.playSFX(sample, {
      bus: 'ui',
      gain: options.gain || 0.8,
      pan: options.pan || (Math.random() - 0.5) * 0.3,
      pitch: 0.9 + (Math.random() * 0.2),
      attack: 0.001,
      release: 0.05
    });
  }

  /**
   * Play riser with pitch automation
   */
  async playRiser(options = {}) {
    const {
      sample = 'riser',
      duration = 2.0,
      startPitch = 0.5,
      endPitch = 2.0,
      gain = 0.8
    } = options;
    
    const buffer = await this.loadSFX(sample);
    if (!buffer) return;
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    
    // Pitch automation
    source.playbackRate.setValueAtTime(startPitch, 0);
    source.playbackRate.linearRampToValueAtTime(endPitch, duration);
    
    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(gain, duration * 0.8);
    gainNode.gain.linearRampToValueAtTime(0, duration);
    
    source.connect(gainNode);
    gainNode.connect(this.buses.riser.gain);
    
    source.start();
    source.stop(duration + 0.1);
  }

  /**
   * Generate SFX sequence from storyboard cues
   */
  async generateSFXFromStoryboard(storyboard, musicManager = null) {
    const cues = storyboard.cursor_actions || [];
    const shots = storyboard.shots || [];
    
    // Set music gain node for ducking
    if (musicManager && musicManager.masterGain) {
      this.setMusicGainNode(musicManager.masterGain);
    }
    
    // Load required SFX samples
    const requiredSamples = new Set();
    cues.forEach(cue => {
      if (cue.sfx) requiredSamples.add(cue.sfx);
    });
    
    // Add default SFX for different cue types
    const defaultSFX = {
      click: 'mouse_click_b',
      hover: 'mouse_up',
      transition: 'swoosh_air',
      impact: 'boom',
      cta: 'confirm'
    };
    
    Object.values(defaultSFX).forEach(sample => requiredSamples.add(sample));
    
    await this.loadSFXBatch(Array.from(requiredSamples));
    
    // Generate SFX timeline
    const sfxTimeline = [];
    
    cues.forEach((cue, index) => {
      const cueClass = this.classifyCue(cue);
      const sample = cue.sfx || defaultSFX[cueClass] || 'ui_click';
      const timing = cue.timing || (index * 0.5);
      
      sfxTimeline.push({
        sample,
        timing,
        class: cueClass,
        options: {
          gain: this.getCueGain(cueClass),
          pan: this.getCuePan(cue, cueClass),
          duck: this.shouldDuck(cueClass)
        }
      });
    });
    
    // Add shot transitions
    shots.forEach((shot, index) => {
      if (index > 0 && shot.camera_move) {
        sfxTimeline.push({
          sample: 'swoosh_air',
          timing: shot.start_time,
          class: 'transition',
          options: {
            gain: 0.6,
            pan: (Math.random() - 0.5) * 0.4,
            duck: true
          }
        });
      }
    });
    
    // Sort by timing
    sfxTimeline.sort((a, b) => a.timing - b.timing);
    
    return sfxTimeline;
  }

  /**
   * Classify cue type for SFX selection
   */
  classifyCue(cue) {
    const text = `${cue.action || ''} ${cue.target || ''} ${cue.sfx || ''}`.toLowerCase();
    
    if (/click|tap|press/.test(text)) return 'click';
    if (/hover|focus/.test(text)) return 'hover';
    if (/transition|camera|whip|wipe/.test(text)) return 'transition';
    if (/impact|boom|crash|drop/.test(text)) return 'impact';
    if (/cta|button|submit/.test(text)) return 'cta';
    if (/riser|build/.test(text)) return 'riser';
    
    return 'ui';
  }

  /**
   * Get appropriate gain for cue type
   */
  getCueGain(cueClass) {
    const gains = {
      click: 0.8,
      hover: 0.4,
      transition: 0.6,
      impact: 0.9,
      cta: 0.85,
      riser: 0.7,
      ui: 0.6
    };
    return gains[cueClass] || 0.6;
  }

  /**
   * Get appropriate pan for cue
   */
  getCuePan(cue, cueClass) {
    if (typeof cue.pan === 'number') return Math.max(-1, Math.min(1, cue.pan));
    
    const pans = {
      click: (Math.random() - 0.5) * 0.3,
      hover: (Math.random() - 0.5) * 0.2,
      transition: (Math.random() - 0.5) * 0.6,
      impact: 0,
      cta: 0.1,
      riser: 0,
      ui: (Math.random() - 0.5) * 0.2
    };
    return pans[cueClass] || 0;
  }

  /**
   * Determine if cue should duck music
   */
  shouldDuck(cueClass) {
    const duckingClasses = ['impact', 'cta', 'transition', 'riser'];
    return duckingClasses.includes(cueClass);
  }

  /**
   * Render all SFX to a single audio buffer
   */
  async renderSFXToBuffer(sfxTimeline, totalDuration) {
    const offlineContext = new OfflineAudioContext(
      2,
      Math.ceil((totalDuration + 1) * this.sampleRate),
      this.sampleRate
    );
    
    // Create bus routing in offline context
    const buses = {};
    Object.keys(this.buses).forEach(busName => {
      buses[busName] = {
        gain: offlineContext.createGain(),
        compressor: offlineContext.createDynamicsCompressor()
      };
      buses[busName].gain.gain.value = this.buses[busName].gain.gain.value;
      buses[busName].compressor.threshold.value = this.buses[busName].compressor.threshold.value;
      buses[busName].compressor.ratio.value = this.buses[busName].compressor.ratio.value;
      buses[busName].gain.connect(buses[busName].compressor);
      buses[busName].compressor.connect(offlineContext.destination);
    });
    
    // Schedule all SFX
    for (const sfx of sfxTimeline) {
      const buffer = this.loadedSamples.get(sfx.sample);
      if (!buffer) continue;
      
      const source = offlineContext.createBufferSource();
      source.buffer = buffer;
      
      const gainNode = offlineContext.createGain();
      const { gain, pan, duck } = sfx.options;
      
      gainNode.gain.setValueAtTime(0, sfx.timing);
      gainNode.gain.linearRampToValueAtTime(gain, sfx.timing + 0.01);
      gainNode.gain.setValueAtTime(gain, sfx.timing + buffer.duration - 0.05);
      gainNode.gain.linearRampToValueAtTime(0, sfx.timing + buffer.duration);
      
      const panner = this.createStereoPannerInContext(offlineContext, pan);
      
      source.connect(gainNode);
      gainNode.connect(panner);
      panner.connect(buses[sfx.class]?.gain || buses.ui.gain);
      
      source.start(sfx.timing);
    }
    
    return await offlineContext.startRendering();
  }

  /**
   * Create stereo panner in specific context
   */
  createStereoPannerInContext(context, pan = 0) {
    if (typeof context.createStereoPanner === 'function') {
      const panner = context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      return panner;
    }
    
    const gainNode = context.createGain();
    gainNode.gain.value = 1.0;
    return gainNode;
  }

  /**
   * Mix SFX with music
   */
  async mixWithMusic(sfxBuffer, musicBuffer, options = {}) {
    const {
      sfxGain = 0.8,
      musicGain = 0.7,
      totalDuration
    } = options;
    
    const duration = totalDuration || Math.max(sfxBuffer.duration, musicBuffer.duration);
    const offlineContext = new OfflineAudioContext(
      2,
      Math.ceil(duration * this.sampleRate),
      this.sampleRate
    );
    
    // SFX channel
    const sfxSource = offlineContext.createBufferSource();
    sfxSource.buffer = sfxBuffer;
    const sfxGainNode = offlineContext.createGain();
    sfxGainNode.gain.value = sfxGain;
    sfxSource.connect(sfxGainNode);
    sfxGainNode.connect(offlineContext.destination);
    
    // Music channel
    const musicSource = offlineContext.createBufferSource();
    musicSource.buffer = musicBuffer;
    const musicGainNode = offlineContext.createGain();
    musicGainNode.gain.value = musicGain;
    musicSource.connect(musicGainNode);
    musicGainNode.connect(offlineContext.destination);
    
    sfxSource.start();
    musicSource.start();
    
    return await offlineContext.startRendering();
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.loadedSamples.clear();
    this.sfxLibrary.clear();
    
    Object.values(this.buses).forEach(bus => {
      bus.gain.disconnect();
      bus.compressor.disconnect();
    });
    
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

export { SFXManager };