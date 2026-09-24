// Cue score engine — an original, beat-synced score + sound design, rendered offline to WAV.
// The edit grid remains 160 BPM, but arrangement, density, silence, and event weight vary by scene.
import { CUT, BEAT } from "./composer.js";

const SR = 44100;
const RENDER_TAIL = 1.2;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

const KITS = {
  kinetic: { kick: "kick_909", snare: "snare_punch", hat: "hat_closed", open: "hat_open_short", clap: "clap_fat", key: 57, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], groove: "four", wave: "sawtooth", arp: "square", motif: [0, 3, 7, 10, 7, 3], swing: 0.015 },
  editorial: { kick: "kick_soft", snare: "snare_lofi", hat: "shaker", open: "hat_clean", clap: "perc_snap", key: 62, prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [-7, -3, 0, 4], [-5, -1, 2, 5]], groove: "half", wave: "triangle", arp: "triangle", motif: [0, 4, 7, 11, 7, 4], swing: 0.035 },
  neon: { kick: "kick_tech", snare: "snare_dnb", hat: "hat_clean", open: "hat_open", clap: "clap_dance", key: 54, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], groove: "break", wave: "sawtooth", arp: "sawtooth", motif: [0, 3, 7, 10, 12, 10, 7, 3], swing: 0.01 },
  pop: { kick: "kick_house", snare: "clap_dance", hat: "hat_open_short", open: "hat_open", clap: "clap_dance", key: 60, prog: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], groove: "four", wave: "square", arp: "triangle", motif: [0, 4, 7, 9, 7, 4, 2, 0], swing: 0.02 },
  mono: { kick: "kick_sub", snare: "snare_909", hat: "hat_clean", open: "hat_open_short", clap: "perc_snap", key: 52, prog: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], groove: "half", wave: "sawtooth", arp: "triangle", motif: [0, 3, 7, 5, 3, 0], swing: 0.04 },
};

const SOUND_FAMILIES = [
  { key: "air", label: "Air", bridgeSample: "swoosh_air", clickSfx: "mouse_click_b", impactSample: "sub_drop", sfxGain: 0.82, drumGain: 0.88, musicGain: 0.6, reverb: 0.3, bridgeRate: 1.1, filterStart: 520, filterEnd: 8200, stereo: 0.55 },
  { key: "glass", label: "Glass", bridgeSample: "rev_glass", clickSfx: "glass_a", impactSample: "boom", sfxGain: 0.76, drumGain: 0.84, musicGain: 0.58, reverb: 0.44, bridgeRate: 1.04, filterStart: 780, filterEnd: 9800, stereo: 0.72 },
  { key: "sub", label: "Sub", bridgeSample: "swoosh_low", clickSfx: "mouse_down", impactSample: "sub_drop", sfxGain: 0.7, drumGain: 1.02, musicGain: 0.52, reverb: 0.22, bridgeRate: 0.86, filterStart: 260, filterEnd: 4200, stereo: 0.22 },
  { key: "tape", label: "Tape", bridgeSample: "rewind", clickSfx: "mouse_up", impactSample: "braam", sfxGain: 0.72, drumGain: 0.82, musicGain: 0.64, reverb: 0.5, bridgeRate: 0.92, filterStart: 420, filterEnd: 5600, stereo: 0.62 },
  { key: "pulse", label: "Pulse", bridgeSample: "swoosh_mid", clickSfx: "ui_click", impactSample: "kick_808", sfxGain: 0.88, drumGain: 0.96, musicGain: 0.56, reverb: 0.28, bridgeRate: 1.18, filterStart: 640, filterEnd: 10500, stereo: 0.46 },
  { key: "wood", label: "Wood", bridgeSample: "swoosh_low", clickSfx: "perc_snap", impactSample: "taiko_lo", sfxGain: 0.8, drumGain: 0.9, musicGain: 0.58, reverb: 0.34, bridgeRate: 0.98, filterStart: 340, filterEnd: 6400, stereo: 0.4 },
  { key: "rubber", label: "Rubber", bridgeSample: "swoosh_fast", clickSfx: "pop_a", impactSample: "drop_pop", sfxGain: 0.9, drumGain: 0.9, musicGain: 0.57, reverb: 0.26, bridgeRate: 1.24, filterStart: 900, filterEnd: 11200, stereo: 0.5 },
  { key: "digital", label: "Digital", bridgeSample: "glitch", clickSfx: "ui_tick", impactSample: "glitch", sfxGain: 0.78, drumGain: 0.86, musicGain: 0.62, reverb: 0.2, bridgeRate: 1.32, filterStart: 1100, filterEnd: 12500, stereo: 0.68 },
  { key: "room", label: "Room", bridgeSample: "swoosh_mid", clickSfx: "mouse_rel_b", impactSample: "crash", sfxGain: 0.68, drumGain: 0.8, musicGain: 0.68, reverb: 0.62, bridgeRate: 0.9, filterStart: 460, filterEnd: 7000, stereo: 0.58 },
  { key: "bright", label: "Bright", bridgeSample: "swoosh_air", clickSfx: "confirm", impactSample: "crash", sfxGain: 0.86, drumGain: 0.92, musicGain: 0.6, reverb: 0.36, bridgeRate: 1.28, filterStart: 1000, filterEnd: 11800, stereo: 0.74 },
];

export const SOUND_VARIATIONS = Object.fromEntries(Array.from({ length: 50 }, (_, index) => {
  const family = SOUND_FAMILIES[index % SOUND_FAMILIES.length];
  const variant = Math.floor(index / SOUND_FAMILIES.length);
  return [`snd${String(index + 1).padStart(3, "0")}`, {
    id: `snd${String(index + 1).padStart(3, "0")}`,
    label: `${family.label} ${String(variant + 1).padStart(2, "0")}`,
    bridgeSample: family.bridgeSample,
    clickSfx: family.clickSfx,
    impactSample: family.impactSample,
    sfxGain: family.sfxGain + variant * 0.018,
    drumGain: family.drumGain + (variant % 3) * 0.035,
    musicGain: family.musicGain + (variant % 4) * 0.018,
    reverb: Math.min(0.72, family.reverb + variant * 0.025),
    bridgeRate: family.bridgeRate + variant * 0.025,
    filterStart: family.filterStart + variant * 45,
    filterEnd: family.filterEnd + variant * 260,
    stereo: Math.min(0.86, family.stereo + variant * 0.018),
  }];
}));

function resolveSoundProfile(value) {
  if (typeof value === "string" && SOUND_VARIATIONS[value]) return SOUND_VARIATIONS[value];
  const n = Number(value);
  if (Number.isInteger(n) && n >= 1 && n <= 50) return SOUND_VARIATIONS[`snd${String(n).padStart(3, "0")}`];
  return SOUND_VARIATIONS.snd001;
}

function hashText(value) {
  let h = 2166136261;
  for (const ch of String(value)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function unit(seed, salt = "") { return hashText(`${seed}:${salt}`) / 4294967296; }
function loadablePick(names, samples, seed, salt) {
  const available = names.filter((name) => samples[name]);
  return available.length ? available[Math.floor(unit(seed, salt) * available.length)] : names[0];
}

const cache = new Map();
async function loadSample(ctx, base, name) {
  if (!name) return null;
  const key = base + name;
  if (!cache.has(key)) cache.set(key, fetch(base + name + ".mp3").then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(r.status))).catch(() => null));
  const ab = await cache.get(key);
  if (!ab) return null;
  try { return await ctx.decodeAudioData(ab.slice(0)); } catch { return null; }
}

function impulse(ctx, secs = 2.1, decay = 3.4) {
  const rate = ctx.sampleRate || SR;
  const len = Math.floor(rate * secs); const b = ctx.createBuffer(2, len, rate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c); let s = 1234 + c * 999;
    for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, decay); }
  }
  return b;
}

function createPan(ctx, value) {
  if (typeof ctx.createStereoPanner === "function") {
    const p = ctx.createStereoPanner(); p.pan.value = clamp(value, -1, 1); return p;
  }
  const p = ctx.createGain(); p.gain.value = 1; return p;
}

function eventClass(cue, sceneType = "") {
  const explicit = cue.cueClass || cue.class || cue.kind || cue.targetType || cue.interaction;
  const target = typeof cue.target === "object" ? [cue.target.role, cue.target.type, cue.target.id, cue.target.name].join(" ") : cue.target;
  const text = `${explicit || ""} ${target || ""} ${cue.sfx || ""} ${sceneType}`.toLowerCase();
  if (cue.transition || cue.bridge || /transition|camera|whip|wipe|zoom|glitch/.test(text)) return "transition";
  if (/cta|button|submit|launch|start|checkout/.test(text)) return "cta";
  if (/modal|dialog|drawer|open/.test(text)) return "modal";
  if (/toggle|switch|checkbox/.test(text)) return "toggle";
  if (/tab|nav|menu|select/.test(text)) return "tab";
  if (/scroll|wheel|page/.test(text)) return "scroll";
  if (/hover|focus/.test(text)) return "hover";
  if (/proof|stat|metric|result|success|complete/.test(text) || ["stat", "quote", "logos"].includes(sceneType)) return "proof";
  if (/boom|crash|braam|sub_drop|taiko|impact|drop/.test(text)) return "impact";
  if (/texture|room|ambience|vinyl|tape/.test(text)) return "texture";
  if (/click|mouse|ui_|confirm|glass|perc_snap|pop/.test(text)) return "click";
  return sceneType === "endcard" ? "end" : "accent";
}

function cuePan(cue, cls, seed) {
  if (Number.isFinite(Number(cue.pan))) return clamp(Number(cue.pan), -0.85, 0.85);
  const base = { transition: 0, impact: 0, cta: 0.04, proof: 0.24, click: 0.18, toggle: -0.22, tab: -0.28, modal: 0.1, scroll: -0.12, hover: 0.3, texture: -0.08, end: 0, accent: 0 }[cls] ?? 0;
  const wander = (unit(seed, `${cue.t}:${cue.sfx}:${cls}`) - 0.5) * 0.16;
  return clamp(base + wander, -0.82, 0.82);
}

function resolveCueSample(cue, cls, variation) {
  const sfx = cue.sfx;
  const generic = new Set(["mouse_click_b", "mouse_down", "mouse_up", "mouse_rel_b", "ui_click", "ui_tick", "toggle", "confirm", "glass_a", "perc_snap", "pop_a"]);
  if (sfx && !generic.has(sfx)) return sfx;
  if (cls === "cta") return sfx === "confirm" ? "confirm" : "mouse_click_b";
  if (cls === "modal") return "confirm";
  if (cls === "toggle") return "toggle";
  if (cls === "tab") return sfx === "ui_tick" ? "ui_tick_b" : "ui_tick";
  if (cls === "scroll") return "mouse_down";
  if (cls === "hover") return "mouse_up";
  if (cls === "click") return variation.clickSfx;
  return sfx || variation.clickSfx;
}

function cueGain(cls) {
  return { transition: 0.88, impact: 0.72, cta: 0.9, proof: 0.76, click: 0.72, toggle: 0.78, tab: 0.62, modal: 0.82, scroll: 0.56, hover: 0.42, texture: 0.35, end: 0.72, accent: 0.66 }[cls] ?? 0.66;
}

export async function renderScore({ scenes = [], cues = [], duration, style = "kinetic", energy = 1.5, base = "./audio/", soundProfile = "snd001" }) {
  const sceneList = Array.isArray(scenes) ? scenes : [];
  const cueList = Array.isArray(cues) ? cues : [];
  const K = KITS[style] || KITS.kinetic;
  const V = resolveSoundProfile(soundProfile);
  const totalDuration = Math.max(0.1, Number(duration) || sceneList.length * CUT || CUT);
  const len = Math.ceil((totalDuration + RENDER_TAIL) * SR);
  const ctx = new OfflineAudioContext(2, len, SR);
  const arrangementSeed = hashText(`${style}:${V.id}:${sceneList.map((s) => s.type).join("|")}:${cueList.length}`);
  const names = new Set([
    K.kick, K.snare, K.hat, K.open, K.clap, "riser", "boom", "crash", "sub_drop", "braam", "rev_glass",
    "swoosh_air", "swoosh_mid", "swoosh_low", "swoosh_fast", "hat_closed", "hat_open", "hat_open_short",
    "ui_tick_b", "ui_tick", "ui_click", "toggle", "confirm", "mouse_click_b", "mouse_down", "mouse_up", "mouse_rel_b",
    "glass_a", "perc_snap", "pop_a", "pop_b", "key_a", "key_b", "key_c", "kick_808", "taiko_lo", "drop_pop", "glitch",
    V.bridgeSample, V.clickSfx, V.impactSample, ...cueList.map((c) => c.sfx).filter(Boolean),
  ]);
  const S = {};
  await Promise.all([...names].map(async (name) => (S[name] = await loadSample(ctx, base, name))));

  // Separate buses leave room for intentional foreground/background contrast.
  const master = ctx.createDynamicsCompressor();
  master.threshold.value = -18; master.knee.value = 10; master.ratio.value = 3.2; master.attack.value = 0.003; master.release.value = 0.24;
  const out = ctx.createGain(); out.gain.value = 0.92; master.connect(out); out.connect(ctx.destination);
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx);
  const verbRet = ctx.createGain(); verbRet.gain.value = 0.2; verb.connect(verbRet); verbRet.connect(master);
  const verbBus = ctx.createGain(); verbBus.gain.value = 1; verbBus.connect(verb);
  const drums = ctx.createGain(); drums.gain.value = V.drumGain * 0.84; drums.connect(master);
  const low = ctx.createGain(); low.gain.value = V.drumGain * 0.72; low.connect(master);
  const music = ctx.createGain(); music.gain.value = V.musicGain; music.connect(master);
  const sfx = ctx.createGain(); sfx.gain.value = V.sfxGain; sfx.connect(master);
  const texture = ctx.createGain(); texture.gain.value = 0.24; texture.connect(master);
  const sfxVerb = ctx.createGain(); sfxVerb.gain.value = V.reverb * 0.72; sfxVerb.connect(verbBus);
  const delay = ctx.createDelay(1); delay.delayTime.value = BEAT * (0.62 + V.bridgeRate * 0.08);
  const fb = ctx.createGain(); fb.gain.value = 0.22; const dlp = ctx.createBiquadFilter(); dlp.type = "lowpass"; dlp.frequency.value = 3200;
  delay.connect(dlp); dlp.connect(fb); fb.connect(delay); const dRet = ctx.createGain(); dRet.gain.value = 0.22; dlp.connect(dRet); dRet.connect(music);
  const renderEnd = totalDuration + RENDER_TAIL;

  const hit = (name, t, gain = 1, dest = drums, rate = 1, options = {}) => {
    const b = S[name]; if (!b || t < 0 || t >= renderEnd) return false;
    const playback = Math.max(0.25, Number(rate) || 1);
    const offset = clamp(Number(options.offset) || 0, 0, Math.max(0, b.duration - 0.005));
    const natural = Math.max(0.025, (b.duration - offset) / playback);
    const dur = Math.min(natural, Number(options.maxDuration) || natural, renderEnd - t);
    if (dur <= 0.01) return false;
    const source = ctx.createBufferSource(); source.buffer = b; source.playbackRate.value = playback;
    const amp = ctx.createGain(); const attack = clamp(Number(options.attack) || Math.min(0.008, dur * 0.12), 0.001, dur * 0.35);
    const release = clamp(Number(options.release) || Math.min(0.16, dur * 0.28), 0.008, Math.max(0.009, dur - attack));
    const end = Math.min(renderEnd - 0.002, t + dur);
    const peak = Math.max(0.0001, gain);
    amp.gain.setValueAtTime(0.0001, t); amp.gain.linearRampToValueAtTime(peak, Math.min(end - 0.002, t + attack));
    amp.gain.setValueAtTime(peak, Math.max(t + attack, end - release)); amp.gain.exponentialRampToValueAtTime(0.0001, end);
    const p = createPan(ctx, options.pan || 0);
    source.connect(amp); amp.connect(p); p.connect(dest);
    if (options.wet) { const send = ctx.createGain(); send.gain.value = clamp(options.wet, 0, 1); amp.connect(send); send.connect(sfxVerb); }
    source.start(t, offset); source.stop(Math.min(renderEnd - 0.001, end + 0.02));
    return true;
  };

  const bridge = (at, gain = 0.5, cue = {}) => {
    const b = S[V.bridgeSample] || S.swoosh_air || S.swoosh_mid || S.riser;
    if (!b || at < 0 || at >= renderEnd) return;
    const start = Math.max(0, at - (cue.lead ?? 0.4)); const end = Math.min(renderEnd, at + (cue.tail ?? 0.08));
    const source = ctx.createBufferSource(); source.buffer = b;
    const filter = ctx.createBiquadFilter(); filter.type = "lowpass"; filter.Q.value = 1.4;
    const amp = ctx.createGain(); const pan = createPan(ctx, cuePan(cue, "transition", arrangementSeed) * V.stereo);
    source.playbackRate.setValueAtTime(V.bridgeRate * 0.72, start); source.playbackRate.linearRampToValueAtTime(V.bridgeRate, at);
    filter.frequency.setValueAtTime(Math.max(40, V.filterStart), start); filter.frequency.exponentialRampToValueAtTime(Math.max(80, V.filterEnd), at);
    amp.gain.setValueAtTime(0.0001, start); amp.gain.linearRampToValueAtTime(gain, Math.max(start + 0.02, at - 0.035)); amp.gain.exponentialRampToValueAtTime(0.0001, end);
    source.connect(filter); filter.connect(amp); amp.connect(pan); pan.connect(sfx);
    const send = ctx.createGain(); send.gain.value = clamp(V.reverb * 0.42, 0, 0.5); amp.connect(send); send.connect(sfxVerb);
    const offset = b === S.riser ? Math.max(0, b.duration - 0.42) : 0;
    const span = Math.min(b.duration - offset, Math.max(0.03, end - start + 0.05));
    source.start(start, offset, span); source.stop(Math.min(renderEnd - 0.001, end + 0.03));
  };

  const N = sceneList.length;
  const types = sceneList.map((s) => s.type || "statement");
  let drop = types.findIndex((type, index) => index >= 2 && ["screen", "scroll", "split"].includes(type));
  if (drop < 0) drop = Math.min(4, Math.max(0, N - 2));
  const ctaIdx = types.lastIndexOf("cta");
  const endIdx = Math.max(0, N - 1);
  const energyValue = Number(energy);
  const energyScale = 0.82 + clamp(Number.isFinite(energyValue) ? energyValue : 1.5, 0, 3) * 0.12;
  const breakdown = new Set();
  types.forEach((type, index) => { if (index > drop + 1 && ["quote", "logos"].includes(type) && (ctaIdx < 0 || index < ctaIdx)) breakdown.add(index); });
  if (!breakdown.size) {
    const quietIndex = types.findIndex((type, index) => index > drop + 2 && index < endIdx && ["stat", "feature", "statement"].includes(type));
    if (quietIndex >= 0) breakdown.add(quietIndex);
  }
  const section = (index) => (index === endIdx ? "end" : index < drop ? (index < 1 ? "intro" : "build") : breakdown.has(index) ? "break" : index === ctaIdx - 1 && ctaIdx > drop + 2 ? "prelift" : "full");
  const profileFor = (index) => {
    const sec = section(index); const type = types[index];
    let density = { intro: 0.18, build: 0.42, full: 0.72, prelift: 0.9, break: 0.2, end: 0.12 }[sec] ?? 0.5;
    if (["screen", "scroll", "split"].includes(type)) density += 0.1;
    if (["statement", "quote", "logos"].includes(type)) density -= 0.1;
    if (type === "cta") density = 0.82;
    if (index === drop) density = 0.96;
    if (!(["intro", "break", "end"].includes(sec))) density *= energyScale;
    const contrast = clamp(0.78 + (unit(arrangementSeed, `contrast:${index}`) - 0.5) * 0.32, 0.64, 0.94);
    return { sec, density: clamp(density, 0.06, 0.98), contrast, phase: Math.floor(unit(arrangementSeed, `phase:${index}`) * 4) };
  };
  const profiles = sceneList.map((_, index) => profileFor(index));
  const impactTimes = [];
  const canImpact = (at, gap = 0.72) => {
    if (impactTimes.some((time) => Math.abs(time - at) < gap)) return false;
    impactTimes.push(at); return true;
  };
  const impactChoices = {
    drop: [V.impactSample, "boom", "sub_drop", "braam", "taiko_lo"],
    cta: ["confirm", "pop_b", "perc_snap", "clap_fat"],
    end: ["crash", "rev_glass", "boom", V.impactSample],
    cue: [V.impactSample, "drop_pop", "sub_drop", "boom"],
  };
  const layeredImpact = (at, kind, gain, pan = 0) => {
    if (at < 0 || !canImpact(at)) return;
    const main = loadablePick(impactChoices[kind] || impactChoices.cue, S, arrangementSeed, `${kind}:${at}`);
    hit(main, at, gain, drums, kind === "end" ? 0.92 : 1, { pan, attack: 0.004, release: kind === "end" ? 0.5 : 0.2, wet: kind === "end" ? 0.18 : 0.1 });
    if (kind === "drop") {
      hit(K.kick, at, gain * 0.36, low, 0.92, { pan: 0, attack: 0.002, release: 0.18 });
      if (main !== "sub_drop") hit("sub_drop", at + 0.018, gain * 0.14, low, 0.86, { pan: 0, attack: 0.003, release: 0.22 });
    } else if (kind === "cta") {
      hit("key_a", at + 0.025, gain * 0.18, music, 1.02, { pan: -0.12, attack: 0.004, release: 0.16, wet: 0.12 });
    }
  };

  // --- drums: an arrangement with holes, fills, and a changing energy floor ---
  const musicBase = V.musicGain; const lowBase = V.drumGain * 0.72;
  const duck = (at, amount) => {
    const end = at + 0.04; const restore = at + 0.18;
    music.gain.setValueAtTime(musicBase, at); music.gain.linearRampToValueAtTime(musicBase * (1 - amount), end); music.gain.setTargetAtTime(musicBase, restore, 0.08);
    low.gain.setValueAtTime(lowBase, at); low.gain.linearRampToValueAtTime(lowBase * (1 - amount * 0.7), end); low.gain.setTargetAtTime(lowBase, restore, 0.08);
  };
  for (let i = 0; i < N; i++) {
    const t0 = i * CUT; const { sec, density, contrast, phase } = profiles[i]; const kicks = [];
    if (sec === "intro") {
      if (i % 2 === 1) { hit(K.kick, t0, 0.22 * contrast, low, 0.94, { pan: 0, release: 0.16 }); kicks.push(t0); }
      hit(K.hat, t0 + BEAT * 2.5, 0.12, drums, 0.96, { pan: -0.18, maxDuration: 0.16 });
      continue;
    }
    if (sec === "end") continue;
    if (sec === "break") {
      if (i % 2 === 1) hit(K.hat, t0 + BEAT * 3, 0.13, drums, 0.9, { pan: 0.22, maxDuration: 0.18 });
      if (types[i] === "stat") hit(K.snare, t0 + BEAT * 2, 0.16, drums, 0.96, { pan: 0.08, release: 0.12 });
      continue;
    }
    const full = sec === "full" || sec === "prelift";
    for (let b = 0; b < 4; b++) {
      const tb = t0 + b * BEAT;
      const off = b % 2 ? K.swing : 0;
      const kick = K.groove === "four"
        ? (b === 0 || (b === 2 && density > 0.54) || (b === 1 && density > 0.87 && phase % 2 === 0))
        : K.groove === "half"
          ? (b === 0 || (b === 2 && density > 0.66))
          : (b === 0 || (b === 2 && density > 0.5) || (b === 3 && density > 0.82 && phase === 1));
      if (kick) { hit(K.kick, tb + off, (full ? 0.72 : 0.5) * contrast, low, 0.98 + phase * 0.008, { pan: 0, attack: 0.002, release: 0.16 }); kicks.push(tb + off); }
      if (full && (b === 1 || b === 3) && density > 0.45) hit(K.snare, tb, (0.42 + density * 0.2) * contrast, drums, 0.98, { pan: 0.04, attack: 0.002, release: 0.16, wet: 0.08 });
      if (full && K.groove === "half" && b === 2 && density > 0.62) hit(K.snare, tb, 0.34 * contrast, drums, 0.98, { pan: -0.04, release: 0.14 });
      if (density > 0.76 && (b === 1 || b === 3)) hit(K.clap, tb, 0.16 * contrast, drums, 1.01, { pan: 0.2, attack: 0.002, release: 0.14 });
      if (density > 0.34) hit(K.hat, tb + BEAT / 2 + off, (0.16 + density * 0.18) * contrast, drums, 0.98, { pan: b % 2 ? 0.28 : -0.24, maxDuration: 0.18 });
      if (full && density > 0.62 && (b + phase) % 2 === 0) hit(K.hat, tb, 0.1 * contrast, drums, 1.02, { pan: -0.34, maxDuration: 0.14 });
      if (full && density > 0.88) hit(K.hat, tb + BEAT * 0.75, 0.07 * contrast, drums, 1.06, { pan: 0.34, maxDuration: 0.1 });
    }
    if (full && (i + phase) % 3 === 0) hit(K.open, t0 + BEAT * 3.5, 0.19 * contrast, drums, 1.02, { pan: 0.34, maxDuration: 0.3, release: 0.18, wet: 0.08 });
    if (i === drop - 1) {
      // Leave the last sixteenth open so the downbeat has somewhere to land.
      for (let k = 0; k < 7; k++) hit(K.snare, t0 + CUT / 2 + k * (BEAT / 4), (0.13 + k * 0.055) * contrast, drums, 1 + k * 0.012, { pan: k % 2 ? 0.16 : -0.12, attack: 0.001, release: 0.08, maxDuration: 0.16 });
    }
    if (sec === "prelift") for (let k = 0; k < 4; k++) hit(K.snare, t0 + CUT / 2 + k * (BEAT / 2), (0.16 + k * 0.065) * contrast, drums, 1 + k * 0.018, { pan: k % 2 ? 0.2 : -0.16, release: 0.09, maxDuration: 0.18 });
    kicks.forEach((at) => duck(at, sec === "prelift" ? 0.34 : 0.24));
  }

  // Major events get one deliberate foreground layer rather than a stack of generic hits.
  if (drop > 0) { const at = drop * CUT; const riser = S.riser; if (riser) hit("riser", Math.max(0, at - riser.duration), 0.42, sfx, V.bridgeRate * 0.92, { pan: 0, release: 0.12, wet: 0.2 }); layeredImpact(at, "drop", 0.68); }
  if (ctaIdx > 0) { const at = ctaIdx * CUT; const riser = S.riser; if (riser) hit("riser", Math.max(0, at - riser.duration), 0.25, sfx, V.bridgeRate, { pan: 0.08, release: 0.1, wet: 0.18 }); layeredImpact(at, "cta", 0.42, 0.02); }
  if (N > 1) layeredImpact(endIdx * CUT, "end", 0.48);

  // --- harmony: a restrained pad, a moving bass motif, and a variable melodic cell ---
  const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.Q.value = 0.8; lp.connect(music);
  const padSend = ctx.createGain(); padSend.gain.value = 0.14 + V.reverb * 0.16; lp.connect(padSend); padSend.connect(verbBus);
  lp.frequency.setValueAtTime(360, 0); lp.frequency.exponentialRampToValueAtTime(2300, Math.max(0.1, drop * CUT));
  if (drop >= 0) lp.frequency.setValueAtTime(3600, drop * CUT);
  breakdown.forEach((i) => { lp.frequency.setValueAtTime(3100, i * CUT); lp.frequency.exponentialRampToValueAtTime(720, i * CUT + 0.34); lp.frequency.exponentialRampToValueAtTime(3200, (i + 1) * CUT); });
  lp.frequency.setValueAtTime(3300, endIdx * CUT); lp.frequency.exponentialRampToValueAtTime(620, endIdx * CUT + 1.35);
  const bassF = ctx.createBiquadFilter(); bassF.type = "lowpass"; bassF.frequency.value = 360; bassF.Q.value = 2.8; bassF.connect(low);
  const arpF = ctx.createBiquadFilter(); arpF.type = "lowpass"; arpF.frequency.value = 2800; arpF.connect(music); arpF.connect(delay);

  const voice = (type, frequency, t, dur, peak, dest, attack = 0.01, release = 0.12, detune = 0, pan = 0, wet = 0) => {
    if (t < 0 || t >= renderEnd) return;
    const end = Math.min(renderEnd - 0.002, t + dur); if (end <= t + 0.01) return;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = frequency; o.detune.value = detune;
    const g = ctx.createGain(); const a = clamp(attack, 0.001, (end - t) * 0.45); const r = clamp(release, 0.008, Math.max(0.009, end - t - a));
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), Math.min(end - 0.002, t + a));
    g.gain.setValueAtTime(Math.max(0.0001, peak), Math.max(t + a, end - r)); g.gain.exponentialRampToValueAtTime(0.0001, end);
    const p = createPan(ctx, pan); o.connect(g); g.connect(p); p.connect(dest);
    if (wet) { const send = ctx.createGain(); send.gain.value = clamp(wet, 0, 1); g.connect(send); send.connect(verbBus); }
    o.start(t); o.stop(Math.min(renderEnd - 0.001, end + 0.05));
  };

  const motifShift = arrangementSeed % K.prog.length;
  for (let i = 0; i < N; i++) {
    const t0 = i * CUT; const { sec, density, contrast, phase } = profiles[i];
    const chord = K.prog[(i + motifShift + (i === drop ? 1 : 0)) % K.prog.length]; const root = K.key + chord[0];
    const padDur = sec === "end" ? 3.1 : sec === "break" ? CUT * 0.72 : CUT + 0.06;
    const padAmp = { intro: 0.032, build: 0.046, full: 0.06, prelift: 0.075, break: 0.026, end: 0.048 }[sec] * contrast;
    const padNotes = sec === "break" ? chord.slice(0, 2) : chord;
    padNotes.forEach((note, n) => {
      [-9, 9].forEach((detune) => voice(K.wave, hz(K.key + note), t0, padDur, padAmp / Math.max(2, padNotes.length) * 2.2, lp, sec === "intro" ? 0.42 : 0.07, sec === "end" ? 0.9 : 0.3, detune, detune < 0 ? -0.25 : 0.25, V.reverb * 0.16));
      if (n === 0 && sec !== "break") voice("sine", hz(K.key + note - 12), t0, padDur, padAmp * 0.32, lp, 0.12, 0.42, 0, 0, V.reverb * 0.1);
    });
    if (sec === "intro") continue;
    const bassNote = hz(root - 24);
    if (sec === "end") { voice("sine", bassNote, t0, 2.55, 0.28, low, 0.02, 1.1, 0, 0, 0.05); continue; }
    if (sec === "build") voice("sine", bassNote, t0, CUT * 0.86, 0.23 * contrast, low, 0.012, 0.2, 0, 0, 0.04);
    else if (sec !== "break") {
      const bassPattern = [0, 0, 7, 0, 5, 0, 7, 0];
      for (let k = 0; k < 8; k++) {
        if (density < 0.62 && k % 2) continue;
        const t = t0 + k * (BEAT / 2) + (k % 2 ? K.swing : 0);
        const note = hz(root - 24 + (k === 7 ? 12 : bassPattern[(k + phase) % bassPattern.length] * 0.08));
        voice("sawtooth", note, t, BEAT / 2 - 0.025, 0.12 * contrast, bassF, 0.004, 0.05, 0, -0.06, 0.02);
        voice("sine", bassNote, t, BEAT / 2 - 0.025, 0.2 * contrast, low, 0.004, 0.05, 0, 0.02, 0.02);
      }
    } else voice("sine", bassNote, t0, BEAT * 1.5, 0.12, low, 0.02, 0.35, 0, 0, 0.04);

    if (sec === "full" || sec === "prelift" || (sec === "break" && density > 0.22)) {
      const steps = sec === "prelift" ? 12 : density > 0.78 ? 10 : density > 0.48 ? 6 : 3;
      for (let k = 0; k < steps; k++) {
        const pos = k / steps; const t = t0 + pos * CUT + (k % 2 ? K.swing : 0);
        const interval = K.motif[(k + phase) % K.motif.length]; const note = K.key + 12 + interval + (k % 5 === 0 ? 12 : 0);
        const amp = (0.022 + (k % 4 === 0 ? 0.014 : 0)) * contrast * (sec === "break" ? 0.52 : 1);
        voice(K.arp, hz(note), t, Math.max(0.045, CUT / steps * 0.62), amp, arpF, 0.004, 0.045, (k % 2 ? -5 : 5), k % 2 ? 0.3 : -0.22, V.reverb * 0.12);
      }
    }
  }

  // Composer cues stay compatible, but their sound class now controls layer, pan, and weight.
  cueList.slice().sort((a, b) => (a.t || 0) - (b.t || 0)).forEach((cue) => {
    const sceneIndex = clamp(Math.floor(((Number(cue.t) || 0) + 0.12) / CUT), 0, Math.max(0, N - 1));
    const cls = eventClass(cue, types[sceneIndex] || "");
    if (cue.bridge) { bridge(Number(cue.t) || 0, (cue.gain ?? 0.5) * (profiles[sceneIndex]?.density < 0.25 ? 0.72 : 1), cue); return; }
    if (!cue.sfx) return;
    if (cls === "impact" && !canImpact(Number(cue.t) || 0, 0.62)) return;
    const soundName = resolveCueSample(cue, cls, V);
    const pan = cuePan(cue, cls, arrangementSeed) * V.stereo;
    const density = profiles[sceneIndex]?.density ?? 0.6;
    const gain = (cue.gain ?? 0.5) * cueGain(cls) * (density < 0.25 ? 0.72 : 1);
    const rate = cls === "click" || ["cta", "toggle", "tab", "modal", "scroll", "hover"].includes(cls) ? V.bridgeRate : 1;
    hit(soundName, Number(cue.t) || 0, gain, cls === "texture" ? texture : sfx, rate, { pan, attack: cls === "impact" ? 0.004 : 0.002, release: cls === "transition" ? 0.18 : 0.11, wet: cls === "transition" || cls === "modal" ? 0.2 : 0.04 });
    if (cue.transition) hit(soundName, (Number(cue.t) || 0) + 0.012, gain * 0.16, sfxVerb, rate, { pan: -pan, attack: 0.004, release: 0.22 });
    if (cls === "proof") hit("key_a", (Number(cue.t) || 0) + 0.018, gain * 0.16, music, 1, { pan: -pan * 0.7, attack: 0.004, release: 0.14, wet: 0.12 });
    if (cls === "cta") hit("confirm", (Number(cue.t) || 0) + 0.02, gain * 0.2, sfx, 1.02, { pan: -pan, attack: 0.003, release: 0.13, wet: 0.12 });
  });

  const trimmed = Math.min(ctx.length, Math.max(1, Math.ceil(totalDuration * SR)));
  return finishRender(ctx, trimmed, totalDuration, drop, sceneList, section);
}

function measureMix(buffer, frames) {
  let samplePeak = 0; let truePeak = 0; let sum = 0; let count = 0;
  const channels = buffer.numberOfChannels;
  for (let c = 0; c < channels; c++) {
    const data = buffer.getChannelData(c);
    for (let i = 0; i < frames; i++) { const value = data[i] || 0; const abs = Math.abs(value); samplePeak = Math.max(samplePeak, abs); sum += value * value; count++; }
    for (let i = 0; i < frames - 1; i++) {
      const a = data[i] || 0; const b = data[i + 1] || 0;
      for (let step = 1; step < 4; step++) truePeak = Math.max(truePeak, Math.abs(a + (b - a) * step / 4));
    }
  }
  truePeak = Math.max(truePeak, samplePeak);
  const blockSize = Math.max(1, Math.floor(SR * 0.4));
  const blocks = [];
  for (let start = 0; start < frames; start += blockSize) {
    const end = Math.min(frames, start + blockSize); let blockSum = 0; let blockCount = 0;
    for (let c = 0; c < channels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = start; i < end; i++) { const value = data[i] || 0; blockSum += value * value; blockCount++; }
    }
    if (blockCount) blocks.push(blockSum / blockCount);
  }
  const gate = Math.pow(10, -70 / 10);
  const gated = blocks.filter((power) => power > gate);
  const integratedPower = (gated.length ? gated : blocks).reduce((total, power) => total + power, 0) / Math.max(1, (gated.length ? gated : blocks).length);
  let correlation = 1;
  if (channels > 1) {
    let left = 0; let right = 0; let cross = 0;
    const l = buffer.getChannelData(0); const r = buffer.getChannelData(1);
    for (let i = 0; i < frames; i++) { left += l[i] * l[i]; right += r[i] * r[i]; cross += l[i] * r[i]; }
    correlation = cross / Math.sqrt(Math.max(0.0000001, left * right));
  }
  const rms = count ? Math.sqrt(sum / count) : 0;
  return { samplePeak, truePeak, lufs: integratedPower > 0.000001 ? -0.691 + 10 * Math.log10(integratedPower) : -Infinity, correlation: Number.isFinite(correlation) ? correlation : 1, rms };
}

function finishRender(ctx, frames, totalDuration, drop, scenes, section) {
  // This function is kept separate so the output path has one render and one measured mix pass.
  return ctx.startRendering().then((buffer) => {
    const fadeLen = Math.min(Math.floor(0.42 * SR), Math.floor(frames * 0.35));
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = Math.max(0, frames - fadeLen); i < frames; i++) data[i] *= (frames - i) / Math.max(1, fadeLen);
    }
    const before = measureMix(buffer, frames);
    const loudnessGain = Number.isFinite(before.lufs) ? clamp(Math.pow(10, (-16.5 - before.lufs) / 20), 0.42, 1.65) : 1;
    let gain = Math.min(loudnessGain, before.truePeak > 0 ? 0.88 / before.truePeak : 1.65);
    if (!Number.isFinite(gain) || gain <= 0) gain = 1;
    for (let c = 0; c < buffer.numberOfChannels; c++) {
      const data = buffer.getChannelData(c);
      for (let i = 0; i < frames; i++) data[i] = clamp((data[i] || 0) * gain, -0.98, 0.98);
      for (let i = frames; i < data.length; i++) data[i] = 0;
    }
    const after = measureMix(buffer, frames);
    if (after.truePeak > 0.89) {
      const ceilingGain = 0.88 / after.truePeak;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = 0; i < frames; i++) data[i] *= ceilingGain;
      }
    }
    if (after.correlation < -0.55) {
      const left = buffer.getChannelData(0); const right = buffer.getChannelData(1);
      for (let i = 0; i < frames; i++) { const mid = (left[i] + right[i]) * 0.5; left[i] = left[i] * 0.72 + mid * 0.28; right[i] = right[i] * 0.72 + mid * 0.28; }
    }
    const blob = toWav(buffer, frames);
    const duration = frames / SR, bpm = 160, style = "kinetic", energy = 1.5;
    // Note: store URL and provide revokeUrl cleanup to prevent memory leaks
    const url = URL.createObjectURL(blob);
    return { blob, url, duration, drop, bpm, style, energy, revokeUrl() { try { URL.revokeObjectURL(url); } catch {} } };
  });
}

function toWav(buf, frames) {
  const ch = buf.numberOfChannels; const bytes = frames * ch * 2; const ab = new ArrayBuffer(44 + bytes); const v = new DataView(ab);
  const w = (offset, value) => { for (let i = 0; i < value.length; i++) v.setUint8(offset + i, value.charCodeAt(i)); };
  w(0, "RIFF"); v.setUint32(4, 36 + bytes, true); w(8, "WAVE"); w(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true); v.setUint32(24, SR, true); v.setUint32(28, SR * ch * 2, true); v.setUint16(32, ch * 2, true); v.setUint16(34, 16, true); w(36, "data"); v.setUint32(40, bytes, true);
  const channels = [...Array(ch)].map((_, c) => buf.getChannelData(c)); let offset = 44;
  for (let i = 0; i < frames; i++) for (let c = 0; c < ch; c++) { const sample = clamp(channels[c][i] || 0, -1, 1); v.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true); offset += 2; }
  return new Blob([ab], { type: "audio/wav" });
}
