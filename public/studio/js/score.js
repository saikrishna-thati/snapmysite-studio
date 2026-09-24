/**
 * SnapMySite Synthesized Audio Engine & Foley Soundscape
 * 100 generated presets with Web Audio API, lazy gesture-driven AudioContext initialization,
 * and lightweight synthesis latency metrics.
 */

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.metrics = {
      initLatencyMs: 0,
      foleyPlayCount: 0,
      totalSynthesisMs: 0,
      lastSynthesisMs: 0,
    };
  }

  ensureContext() {
    const start = performance.now();
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.7, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.metrics.initLatencyMs = Math.round((performance.now() - start) * 100) / 100;
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume();
    }
    return this.ctx;
  }

  playFoley(presetName = "preset-1", duration = 0.4) {
    const start = performance.now();
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Derive unique frequency characteristics from preset string
      let seed = 440;
      for (let i = 0; i < presetName.length; i++) {
        seed = (seed * 31 + presetName.charCodeAt(i)) % 1200;
      }
      const freq = Math.max(120, seed);

      osc.type = freq > 600 ? "triangle" : "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(60, freq * 0.4),
        ctx.currentTime + duration,
      );

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start();
      osc.stop(ctx.currentTime + duration);

      const elapsed = Math.round((performance.now() - start) * 100) / 100;
      this.metrics.foleyPlayCount++;
      this.metrics.totalSynthesisMs += elapsed;
      this.metrics.lastSynthesisMs = elapsed;
    } catch {
      // Graceful fallback if audio hardware is unavailable
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      avgSynthesisMs:
        this.metrics.foleyPlayCount > 0
          ? Math.round((this.metrics.totalSynthesisMs / this.metrics.foleyPlayCount) * 100) / 100
          : 0,
    };
  }
}

// Generate catalog of 100 distinct presets
AudioEngine.PRESETS = Array.from({ length: 100 }, (_, i) => ({
  id: `preset-${i + 1}`,
  name: `Acoustic Space ${i + 1}`,
  style: ["ambient", "kinetic", "cinematic", "glitch", "minimal"][i % 5],
  baseFreq: 140 + ((i * 13) % 800),
}));

window.snapmyAudio = new AudioEngine();
