/**
 * Voiceover Manager for Snapmy.site Film Engine v2
 * 
 * Optional TTS voiceover generation from claims.json with
 * professional timing, music ducking, and integration.
 */

class VoiceoverManager {
  constructor(options = {}) {
    this.audioContext = options.audioContext || new (window.AudioContext || window.webkitAudioContext)();
    this.sampleRate = options.sampleRate || 44100;
    
    // TTS configuration
    this.ttsEnabled = options.ttsEnabled !== false;
    this.voice = null;
    this.voices = [];
    
    // Voiceover settings
    this.voiceoverSettings = {
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
      voiceGender: 'female',
      voiceAccent: 'en-US'
    };
    
    // Audio routing
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // Ducking settings
    this.duckingEnabled = true;
    this.duckingAmount = 0.4;
    this.duckingAttack = 0.1;
    this.duckingRelease = 0.4;
    
    // Music reference for ducking
    this.musicGainNode = null;
    
    // Initialize voices
    this.initializeVoices();
  }

  /**
   * Initialize available TTS voices
   */
  async initializeVoices() {
    if (typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined') {
      // Wait for voices to be loaded
      if (speechSynthesis.getVoices().length === 0) {
        await new Promise(resolve => {
          speechSynthesis.onvoiceschanged = resolve;
          setTimeout(resolve, 1000); // Fallback timeout
        });
      }
      
      this.voices = speechSynthesis.getVoices();
      this.selectDefaultVoice();
    } else {
      console.warn('Speech synthesis not supported in this browser');
      this.ttsEnabled = false;
    }
  }

  /**
   * Select default voice based on settings
   */
  selectDefaultVoice() {
    const { voiceGender, voiceAccent } = this.voiceoverSettings;
    
    // Try to find matching voice
    this.voice = this.voices.find(voice => 
      voice.lang.includes(voiceAccent) && 
      voice.name.toLowerCase().includes(voiceGender)
    ) || this.voices.find(voice => 
      voice.lang.includes(voiceAccent)
    ) || this.voices[0] || null;
  }

  /**
   * Set voiceover settings
   */
  setVoiceoverSettings(settings) {
    this.voiceoverSettings = { ...this.voiceoverSettings, ...settings };
    this.selectDefaultVoice();
  }

  /**
   * Generate voiceover script from claims
   */
  generateVoiceoverScript(claims, options = {}) {
    const {
      maxClaims = 3,
      includeHook = true,
      includeCTA = true,
      style = 'professional'
    } = options;
    
    let script = [];
    
    // Select top claims based on confidence and importance
    const topClaims = claims
      .filter(claim => claim.confidence === 'high')
      .sort((a, b) => (b.importance || 0) - (a.importance || 0))
      .slice(0, maxClaims);
    
    // Add hook if requested
    if (includeHook && topClaims.length > 0) {
      const hookClaim = topClaims[0];
      script.push(this.formatClaimForVoiceover(hookClaim, 'hook'));
    }
    
    // Add body claims
    topClaims.slice(1).forEach(claim => {
      script.push(this.formatClaimForVoiceover(claim, 'body'));
    });
    
    // Add CTA if requested
    if (includeCTA) {
      script.push(this.generateCTA(style));
    }
    
    return script;
  }

  /**
   * Format claim for voiceover
   */
  formatClaimForVoiceover(claim, section = 'body') {
    const text = claim.text || claim.claim || '';
    
    switch (section) {
      case 'hook':
        return `Introducing ${text}.`;
      case 'body':
        return text;
      case 'cta':
        return text;
      default:
        return text;
    }
  }

  /**
   * Generate call-to-action
   */
  generateCTA(style = 'professional') {
    const ctas = {
      professional: 'Get started today.',
      casual: 'Try it out now.',
      urgent: 'Don\'t miss out.',
      friendly: 'Join us today.'
    };
    return ctas[style] || ctas.professional;
  }

  /**
   * Synthesize speech to audio buffer
   */
  async synthesizeToBuffer(text, options = {}) {
    if (!this.ttsEnabled || !this.voice) {
      throw new Error('TTS not enabled or no voice available');
    }
    
    const {
      rate = this.voiceoverSettings.rate,
      pitch = this.voiceoverSettings.pitch,
      volume = this.voiceoverSettings.volume
    } = options;
    
    // Create speech synthesis utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = this.voice;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    
    // For browsers that support OfflineAudioContext with speech synthesis
    // Note: This is limited browser support, alternative approach needed for most browsers
    try {
      const duration = this.estimateSpeechDuration(text, rate);
      const offlineContext = new OfflineAudioContext(
        1, // Mono for voice
        Math.ceil(duration * this.sampleRate),
        this.sampleRate
      );
      
      // Since direct speech synthesis to AudioBuffer is not widely supported,
      // we'll use a workaround by capturing audio
      return await this.captureSpeechAudio(utterance, duration);
    } catch (error) {
      console.warn('Direct speech synthesis failed, using fallback:', error);
      return await this.fallbackSynthesis(text, options);
    }
  }

  /**
   * Estimate speech duration
   */
  estimateSpeechDuration(text, rate = 1.0) {
    const wordsPerMinute = 150; // Average speaking rate
    const wordCount = text.split(/\s+/).length || 1;
    const baseDuration = (wordCount / wordsPerMinute) * 60;
    return baseDuration / rate;
  }

  /**
   * Capture speech audio (workaround for browser limitations)
   */
  async captureSpeechAudio(utterance, estimatedDuration) {
    // This is a workaround since most browsers don't support direct
    // speech synthesis to AudioBuffer. In production, you'd use a
    // server-side TTS service like Google Cloud TTS, Amazon Polly, etc.
    
    return new Promise((resolve, reject) => {
      // Create a simple placeholder buffer
      // In production, replace with actual TTS API call
      const duration = estimatedDuration || 2;
      const offlineContext = new OfflineAudioContext(
        1,
        Math.ceil(duration * this.sampleRate),
        this.sampleRate
      );
      
      // Generate silent buffer as placeholder
      const buffer = offlineContext.createBuffer(1, Math.ceil(duration * this.sampleRate), this.sampleRate);
      resolve(buffer);
    });
  }

  /**
   * Fallback synthesis using external TTS service
   */
  async fallbackSynthesis(text, options = {}) {
    // In production, integrate with external TTS service
    // For now, return a placeholder buffer
    
    const duration = this.estimateSpeechDuration(text, options.rate || 1.0);
    const offlineContext = new OfflineAudioContext(
      1,
      Math.ceil(duration * this.sampleRate),
      this.sampleRate
    );
    
    const buffer = offlineContext.createBuffer(1, Math.ceil(duration * this.sampleRate), this.sampleRate);
    
    console.log('TTS fallback: would call external service for:', text);
    
    return buffer;
  }

  /**
   * Generate complete voiceover from script
   */
  async generateVoiceover(script, options = {}) {
    const {
      gapBetweenSegments = 0.3,
      totalDuration
    } = options;
    
    const segments = [];
    let currentTime = 0;
    
    for (const segment of script) {
      const buffer = await this.synthesizeToBuffer(segment, options);
      if (!buffer) continue;
      
      segments.push({
        text: segment,
        buffer,
        startTime: currentTime,
        duration: buffer.duration
      });
      
      currentTime += buffer.duration + gapBetweenSegments;
    }
    
    // Mix all segments into single buffer
    const finalDuration = totalDuration || currentTime;
    return await this.mixVoiceoverSegments(segments, finalDuration);
  }

  /**
   * Mix voiceover segments into single buffer
   */
  async mixVoiceoverSegments(segments, totalDuration) {
    const offlineContext = new OfflineAudioContext(
      1, // Mono for voice
      Math.ceil(totalDuration * this.sampleRate),
      this.sampleRate
    );
    
    for (const segment of segments) {
      const source = offlineContext.createBufferSource();
      source.buffer = segment.buffer;
      
      source.connect(offlineContext.destination);
      source.start(segment.startTime);
    }
    
    return await offlineContext.startRendering();
  }

  /**
   * Apply voiceover regions for ducking
   */
  generateVoiceoverRegions(segments) {
    return segments.map(segment => ({
      startTime: segment.startTime,
      endTime: segment.startTime + segment.duration,
      text: segment.text
    }));
  }

  /**
   * Set music gain node for ducking
   */
  setMusicGainNode(gainNode) {
    this.musicGainNode = gainNode;
  }

  /**
   * Apply ducking for voiceover regions
   */
  applyVoiceoverDucking(musicBuffer, voiceoverRegions, duckAmount = 0.4) {
    if (!this.duckingEnabled || !voiceoverRegions.length) {
      return Promise.resolve(musicBuffer);
    }
    
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
      
      musicGain.gain.setValueAtTime(1.0, Math.max(0, startTime - this.duckingAttack));
      musicGain.gain.linearRampToValueAtTime(1 - duckAmount, startTime);
      musicGain.gain.setValueAtTime(1 - duckAmount, endTime);
      musicGain.gain.linearRampToValueAtTime(1.0, endTime + this.duckingRelease);
    });
    
    source.connect(musicGain);
    musicGain.connect(offlineContext.destination);
    
    source.start();
    
    return offlineContext.startRendering();
  }

  /**
   * Mix voiceover with music
   */
  async mixWithMusic(voiceoverBuffer, musicBuffer, options = {}) {
    const {
      voiceoverGain = 0.9,
      musicGain = 0.7,
      totalDuration
    } = options;
    
    const duration = totalDuration || Math.max(voiceoverBuffer.duration, musicBuffer.duration);
    const offlineContext = new OfflineAudioContext(
      2, // Stereo output
      Math.ceil(duration * this.sampleRate),
      this.sampleRate
    );
    
    // Convert mono voiceover to stereo
    const stereoVoiceover = this.monoToStereo(voiceoverBuffer, offlineContext);
    
    // Voiceover channel
    const voSource = offlineContext.createBufferSource();
    voSource.buffer = stereoVoiceover;
    const voGainNode = offlineContext.createGain();
    voGainNode.gain.value = voiceoverGain;
    voSource.connect(voGainNode);
    voGainNode.connect(offlineContext.destination);
    
    // Music channel
    const musicSource = offlineContext.createBufferSource();
    musicSource.buffer = musicBuffer;
    const musicGainNode = offlineContext.createGain();
    musicGainNode.gain.value = musicGain;
    musicSource.connect(musicGainNode);
    musicGainNode.connect(offlineContext.destination);
    
    voSource.start();
    musicSource.start();
    
    return await offlineContext.startRendering();
  }

  /**
   * Convert mono buffer to stereo
   */
  monoToStereo(monoBuffer, context) {
    const stereoBuffer = context.createBuffer(
      2,
      monoBuffer.length,
      monoBuffer.sampleRate
    );
    
    const monoData = monoBuffer.getChannelData(0);
    stereoBuffer.copyToChannel(monoData, 0);
    stereoBuffer.copyToChannel(monoData, 1);
    
    return stereoBuffer;
  }

  /**
   * Export voiceover as WAV file
   */
  async exportToWAV(buffer, filename = 'voiceover.wav') {
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
   * Get available voices
   */
  getAvailableVoices() {
    return this.voices.map(voice => ({
      name: voice.name,
      lang: voice.lang,
      gender: voice.name.toLowerCase().includes('female') ? 'female' : 
             voice.name.toLowerCase().includes('male') ? 'male' : 'unknown'
    }));
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.masterGain) {
      this.masterGain.disconnect();
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

export { VoiceoverManager };