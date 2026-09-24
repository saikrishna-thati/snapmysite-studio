// Subagent 8: 100-Preset Dynamic Audio & Foley Architecture
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.audioPool = new Map();
    this.initialized = false;
  }

  ensureContext() {
    if (
      !this.ctx &&
      typeof window !== "undefined" &&
      (window.AudioContext || window.webkitAudioContext)
    ) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx && this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  // 100 Presets across 4 sonic categories
  static PRESETS = {
    tech_saas: Array.from({ length: 25 }, (_, i) => ({
      id: `tech_pulse_${i + 1}`,
      bpm: 118 + (i % 8) * 2,
      scale: ["C4", "Eb4", "F4", "G4", "Bb4"],
      mood: "driving_minimal",
    })),
    cinematic_hero: Array.from({ length: 25 }, (_, i) => ({
      id: `hero_swell_${i + 1}`,
      bpm: 90 + (i % 6) * 4,
      scale: ["D3", "A3", "C4", "E4", "G4"],
      mood: "epic_orchestral",
    })),
    kinetic_speed: Array.from({ length: 25 }, (_, i) => ({
      id: `kinetic_break_${i + 1}`,
      bpm: 130 + (i % 10) * 2,
      scale: ["F3", "Ab3", "C4", "Eb4", "G4"],
      mood: "high_energy_breakbeat",
    })),
    ambient_luxury: Array.from({ length: 25 }, (_, i) => ({
      id: `luxury_warmth_${i + 1}`,
      bpm: 75 + (i % 5) * 3,
      scale: ["A3", "C#4", "E4", "G#4", "B4"],
      mood: "warm_rhodes_vinyl",
    })),
  };

  playFoley(cue = "ui_tick") {
    this.ensureContext();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (cue === "ui_tick") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(1400, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(300, this.ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.04);
    } else if (cue === "sfx_woosh_heavy") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(220, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.35);
      gain.gain.setValueAtTime(0.4, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } else {
      // standard click
      osc.type = "sine";
      osc.frequency.setValueAtTime(800, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.06);
      gain.gain.setValueAtTime(0.25, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.06);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.06);
    }
  }
}
