/**
 * Professional Music Manager for Snapmy.site Film Engine v2
 * 
 * Manages licensed/royalty-free music stems with storyboard-aware cutting,
 * professional mixing, and LUFS normalization.
 */

class MusicManager {
  constructor(options = {}) {
    this.audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = options.sampleRate || 44100;
    this.basePath = options.basePath || './audio/music/';
    
    // Music library configuration
    this.musicLibrary = new Map();
    this.currentTrack = null;
    this.stems = new Map();
    
    // Mixing settings
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // LUFS normalization settings
    this.targetLUFS = -14;
    this.maxTruePeak = -1;
    
    // Storyboard integration
    this.storyboard = null;
    this.musicCues = [];
  }

  /**
   * Load music stems from the library
   */
  async loadMusicStem(stemId, stemType = 'full') {
    const stemPath = `${this.basePath}${stemId}_${stemType}.mp3`;
    
    try {
      const response = await fetch(stemPath);
      if (!response.ok) throw new Error(`Failed to load stem: ${stemPath}`);
      
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      this.stems.set(`${stemId}_${stemType}`, {
        id: stemId,
        type: stemType,
        buffer: audioBuffer,
        duration: audioBuffer.duration,
        bpm: this.detectBPM(audioBuffer),
        key: this.detectKey(audioBuffer)
      });
      
      return this.stems.get(`${stemId}_${stemType}`);
    } catch (error) {
      console.warn(`Failed to load music stem ${stemId}_${stemType}:`, error);
      return null;
    }
  }

  /**
   * Load a complete music track with multiple stems
   */
  async loadMusicTrack(trackId, stemTypes = ['full', 'drums', 'bass', 'melody', 'harmony']) {
    const track = {
      id: trackId,
      stems: new Map(),
      metadata: {}
    };
    
    // Load all stems for the track
    const loadPromises = stemTypes.map(async (stemType) => {
      const stem = await this.loadMusicStem(trackId, stemType);
      if (stem) {
        track.stems.set(stemType, stem);
      }
    });
    
    await Promise.all(loadPromises);
    
    // Set metadata from the full stem if available
    if (track.stems.has('full')) {
      const fullStem = track.stems.get('full');
      track.metadata = {
        duration: fullStem.duration,
        bpm: fullStem.bpm,
        key: fullStem.key
      };
    }
    
    this.musicLibrary.set(trackId, track);
    return track;
  }

  /**
   * Generate music cut based on storyboard structure
   */
  generateMusicCut(storyboard, options = {}) {
    this.storyboard = storyboard;
    const shots = storyboard.shots || [];
    const totalDuration = storyboard.timing?.total_duration || 30;
    
    // Identify key moments
    const heroRevealIndex = this.findHeroReveal(shots);
    const ctaIndex = this.findCTA(shots);
    
    // Build music structure
    const musicStructure = {
      intro: {
        startTime: 0,
        endTime: shots[heroRevealIndex]?.start_time || totalDuration * 0.3,
        section: 'build',
        energy: 0.3,
        stemMix: { full: 1.0, drums: 0.5, bass: 0.7, melody: 0.6, harmony: 0.5 }
      },
      drop: {
        startTime: shots[heroRevealIndex]?.start_time || totalDuration * 0.3,
        endTime: ctaIndex > 0 ? shots[ctaIndex]?.start_time || totalDuration * 0.8 : totalDuration * 0.8,
        section: 'drop',
        energy: 1.0,
        stemMix: { full: 1.0, drums: 1.0, bass: 1.0, melody: 1.0, harmony: 1.0 }
      },
      preCTA: {
        startTime: ctaIndex > 0 ? shots[ctaIndex]?.start_time || totalDuration * 0.8 : totalDuration * 0.8,
        endTime: ctaIndex > 0 ? shots[ctaIndex]?.start_time + 0.4 : totalDuration * 0.9,
        section: 'pre-cta',
        energy: 0.7,
        stemMix: { full: 0.8, drums: 0.6, bass: 0.7, melody: 0.5, harmony: 0.4 }
      },
      silence: {
        startTime: ctaIndex > 0 ? shots[ctaIndex]?.start_time + 0.4 : totalDuration * 0.9,
        endTime: totalDuration,
        section: 'silence',
        energy: 0,
        stemMix: { full: 0, drums: 0, bass: 0, melody: 0, harmony: 0 }
      }
    };
    
    return musicStructure;
  }

  /**
   * Find the hero reveal shot in the storyboard
   */
  findHeroReveal(shots) {
    return shots.findIndex(shot => 
      shot.is_hero || 
      shot.camera_move === 'reveal' || 
      shot.importance === 'high' ||
      shot.description?.toLowerCase().includes('hero') ||
      shot.description?.toLowerCase().includes('reveal')
    );
  }

  /**
   * Find the CTA shot in the storyboard
   */
  findCTA(shots) {
    return shots.findIndex(shot => 
      shot.is_cta || 
      shot.description?.toLowerCase().includes('cta') ||
      shot.description?.toLowerCase().includes('call to action') ||
      shot.on_screen_copy?.some(copy => 
        copy.text?.toLowerCase().includes('get started') ||
        copy.text?.toLowerCase().includes('sign up') ||
        copy.text?.toLowerCase().includes('try free')
      )
    );
  }

  /**
   * Render music with structure and stem mixing
   */
  async renderMusicToBuffer(trackId, musicStructure, totalDuration) {
    const track = this.musicLibrary.get(trackId);
    if (!track || !track.stems.has('full')) {
      throw new Error(`Track ${trackId} not loaded or missing full stem`);
    }
    
    const fullStem = track.stems.get('full');
    const offlineContext = new OfflineAudioContext(
      2, 
      Math.ceil((totalDuration + 2) * this.sampleRate), 
      this.sampleRate
    );
    
    // Create stem mixers
    const stemMixers = {};
    const stemGains = {};
    
    track.stems.forEach((stem, stemType) => {
      const mixer = offlineContext.createGain();
      const gainNode = offlineContext.createGain();
      gainNode.gain.value = 0;
      
      mixer.connect(gainNode);
      gainNode.connect(this.masterGain);
      
      stemMixers[stemType] = mixer;
      stemGains[stemType] = gainNode;
    });
    
    // Schedule music sections
    Object.entries(musicStructure).forEach(([sectionName, section]) => {
      const startTime = section.startTime;
      const endTime = section.endTime;
      const duration = endTime - startTime;
      
      if (duration <= 0) return;
      
      // Schedule each stem with appropriate mix
      track.stems.forEach((stem, stemType) => {
        const mixLevel = section.stemMix[stemType] || 0;
        if (mixLevel <= 0) return;
        
        const source = offlineContext.createBufferSource();
        source.buffer = stem.buffer;
        source.loop = true;
        
        // Calculate loop position based on BPM sync
        const loopStart = this.calculateLoopPosition(startTime, stem.bpm, totalDuration);
        source.connect(stemMixers[stemType] || stemMixers.full);
        
        // Apply stem mix automation
        stemGains[stemType].gain.setValueAtTime(0, startTime);
        stemGains[stemType].gain.linearRampToValueAtTime(mixLevel, startTime + 0.1);
        stemGains[stemType].gain.setValueAtTime(mixLevel, endTime - 0.1);
        stemGains[stemType].gain.linearRampToValueAtTime(0, endTime);
        
        source.start(startTime, loopStart);
        source.stop(endTime + 0.1);
      });
    });
    
    // Render the audio
    const renderedBuffer = await offlineContext.startRendering();
    
    // Apply LUFS normalization
    const normalizedBuffer = await this.normalizeLUFS(renderedBuffer);
    
    return normalizedBuffer;
  }

  /**
   * Calculate loop position for BPM synchronization
   */
  calculateLoopPosition(time, bpm, totalDuration) {
    if (!bpm) return 0;
    
    const beatDuration = 60 / bpm;
    const barDuration = beatDuration * 4;
    const loopPosition = (time % barDuration) / beatDuration;
    
    return loopPosition * beatDuration;
  }

  /**
   * Detect BPM from audio buffer (simplified)
   */
  detectBPM(buffer) {
    // This is a simplified BPM detection
    // In production, you'd use a proper BPM detection library
    return 120; // Default assumption
  }

  /**
   * Detect musical key from audio buffer (simplified)
   */
  detectKey(buffer) {
    // This is a simplified key detection
    // In production, you'd use a proper key detection library
    return 'C'; // Default assumption
  }

  /**
   * Normalize audio to target LUFS integrated loudness
   */
  async normalizeLUFS(buffer, targetLUFS = -14, maxTruePeak = -1) {
    // Calculate current loudness (simplified LUFS calculation)
    const currentLUFS = this.calculateLUFS(buffer);
    const gainAdjustment = targetLUFS - currentLUFS;
    
    // Apply gain adjustment
    const offlineContext = new OfflineAudioContext(
      buffer.numberOfChannels,
      buffer.length,
      buffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = buffer;
    
    const gainNode = offlineContext.createGain();
    gainNode.gain.value = Math.pow(10, gainAdjustment / 20);
    
    // Limiter to prevent clipping
    const limiter = offlineContext.createDynamicsCompressor();
    limiter.threshold.value = maxTruePeak;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    
    source.connect(gainNode);
    gainNode.connect(limiter);
    limiter.connect(offlineContext.destination);
    
    source.start();
    
    const normalizedBuffer = await offlineContext.startRendering();
    
    return normalizedBuffer;
  }

  /**
   * Calculate LUFS integrated loudness (simplified)
   */
  calculateLUFS(buffer) {
    // This is a simplified LUFS calculation
    // For accurate LUFS, you'd use a proper loudness meter library
    
    let sumSquared = 0;
    const channelData = buffer.getChannelData(0);
    
    for (let i = 0; i < channelData.length; i++) {
      sumSquared += channelData[i] * channelData[i];
    }
    
    const rms = Math.sqrt(sumSquared / channelData.length);
    const lufs = 20 * Math.log10(rms) + 10; // Approximate LUFS from RMS
    
    return lufs;
  }

  /**
   * Add ducking for voiceover sections
   */
  applyDucking(musicBuffer, voiceoverRegions, duckAmount = 0.3) {
    const offlineContext = new OfflineAudioContext(
      musicBuffer.numberOfChannels,
      musicBuffer.length,
      musicBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    source.buffer = musicBuffer;
    
    const musicGain = offlineContext.createGain();
    musicGain.gain.value = 1.0;
    
    // Apply ducking for each voiceover region
    voiceoverRegions.forEach(region => {
      const { startTime, endTime } = region;
      const duckDuration = endTime - startTime;
      
      musicGain.gain.setValueAtTime(1.0, startTime - 0.1);
      musicGain.gain.linearRampToValueAtTime(duckAmount, startTime);
      musicGain.gain.setValueAtTime(duckAmount, endTime);
      musicGain.gain.linearRampToValueAtTime(1.0, endTime + 0.1);
    });
    
    source.connect(musicGain);
    musicGain.connect(offlineContext.destination);
    
    source.start();
    
    return offlineContext.startRendering();
  }

  /**
   * Export rendered music as WAV file
   */
  async exportToWAV(buffer, filename = 'music.wav') {
    const wavBuffer = this.audioBufferToWav(buffer);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    
    return {
      blob,
      url: URL.createObjectURL(blob),
      filename
    };
  }

  /**
   * Convert AudioBuffer to WAV format
   */
  audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;
    
    const dataLength = buffer.length * blockAlign;
    const bufferLength = 44 + dataLength;
    
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };
    
    writeString(0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);
    
    // Write audio data
    const channels = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }
    
    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, channels[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }
    
    return arrayBuffer;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.stems.clear();
    this.musicLibrary.clear();
    
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

export { MusicManager };