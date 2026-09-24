// Snapmy.site launch-film composer
// Turns a site brief + a directed plan into a player-compatible HTML composition
// (data-composition-id root, class="clip" timed layers, one paused GSAP timeline).
// Scene boundaries stay on the 160 BPM beat grid, while shots can hold for different spans.

export const CUT = 1.5;
export const BEAT = CUT / 4;
export const ASPECTS = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350] };

export const STYLES = {
  kinetic: {
    label: "Kinetic", dark: true, display: "Inter Tight", dw: 800, ratio: 0.6, upper: true, track: -0.035,
    body: "Inter Tight", mono: "JetBrains Mono", primary: "whip", accents: ["zoom", "flash", "blocks"], grain: 0.10, hud: true,
    fonts: "Inter+Tight:wght@500;700;800;900&family=JetBrains+Mono:wght@500",
  },
  editorial: {
    label: "Editorial", dark: false, display: "Instrument Serif", dw: 400, ratio: 0.46, upper: false, track: -0.02,
    body: "Inter", mono: "JetBrains Mono", primary: "push", accents: ["wipe", "iris", "blocks"], grain: 0.07, hud: false,
    fonts: "Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500",
  },
  neon: {
    label: "Neon", dark: true, display: "Space Grotesk", dw: 700, ratio: 0.58, upper: false, track: -0.04,
    body: "Space Grotesk", mono: "JetBrains Mono", primary: "cut", accents: ["glitch", "zoom", "blocks"], grain: 0.12, hud: true,
    fonts: "Space+Grotesk:wght@500;700&family=JetBrains+Mono:wght@500;700",
  },
  pop: {
    label: "Pop", dark: false, display: "Bricolage Grotesque", dw: 800, ratio: 0.56, upper: false, track: -0.045,
    body: "Bricolage Grotesque", mono: "JetBrains Mono", primary: "wipe", accents: ["iris", "flash", "zoom"], grain: 0.05, hud: false,
    fonts: "Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=JetBrains+Mono:wght@500",
  },
  mono: {
    label: "Minimal", dark: true, display: "Manrope", dw: 800, ratio: 0.6, upper: false, track: -0.04,
    body: "Manrope", mono: "JetBrains Mono", primary: "cut", accents: ["whip", "wipe", "push"], grain: 0.06, hud: true,
    fonts: "Manrope:wght@500;700;800&family=JetBrains+Mono:wght@500",
  },
};

// Hidden motion direction catalog. JEV/Kimi choose a profile; the composer
// turns it into camera, transition, FX, and interaction decisions internally.
const MOTION_FAMILIES = [
  { key: "precision", label: "Precision", transitions: ["push", "zoom", "cut"], camera: "linear", effects: ["clean", "glass"], interactions: ["tab", "click", "none"], pan: 0.82, depth: 0.88, tilt: 0.25, grain: 0.035, blur: 8, bridgeGain: 0.48, settle: 0.24 },
  { key: "editorial", label: "Editorial", transitions: ["wipe", "iris", "push"], camera: "drift", effects: ["paper", "soft"], interactions: ["hover", "scroll", "none"], pan: 0.66, depth: 0.76, tilt: 0.18, grain: 0.055, blur: 5, bridgeGain: 0.42, settle: 0.3 },
  { key: "signal", label: "Signal", transitions: ["glitch", "flash", "zoom"], camera: "snap", effects: ["scan", "chromatic"], interactions: ["click", "tab", "toggle"], pan: 1.18, depth: 1.12, tilt: 0.55, grain: 0.11, blur: 18, bridgeGain: 0.62, settle: 0.2 },
  { key: "glass", label: "Glass", transitions: ["iris", "zoom", "wipe"], camera: "orbit", effects: ["glass", "soft"], interactions: ["hover", "modal", "click"], pan: 0.94, depth: 1.08, tilt: 0.72, grain: 0.045, blur: 12, bridgeGain: 0.5, settle: 0.34 },
  { key: "orbit", label: "Orbit", transitions: ["whip", "push", "zoom"], camera: "orbit", effects: ["glow", "grain"], interactions: ["tab", "scroll", "click"], pan: 1.34, depth: 1.2, tilt: 1.05, grain: 0.095, blur: 16, bridgeGain: 0.58, settle: 0.28 },
  { key: "product", label: "Product", transitions: ["wipe", "push", "cut"], camera: "linear", effects: ["clean", "glow"], interactions: ["click", "modal", "tab"], pan: 0.9, depth: 0.98, tilt: 0.38, grain: 0.04, blur: 9, bridgeGain: 0.52, settle: 0.26 },
  { key: "kinetic", label: "Kinetic", transitions: ["whip", "flash", "blocks"], camera: "snap", effects: ["chromatic", "scan"], interactions: ["click", "toggle", "tab"], pan: 1.48, depth: 1.16, tilt: 1.2, grain: 0.13, blur: 24, bridgeGain: 0.68, settle: 0.2 },
  { key: "quiet", label: "Quiet", transitions: ["iris", "cut", "wipe"], camera: "drift", effects: ["soft", "paper"], interactions: ["hover", "none", "scroll"], pan: 0.48, depth: 0.68, tilt: 0.12, grain: 0.028, blur: 3, bridgeGain: 0.34, settle: 0.42 },
  { key: "neon", label: "Neon", transitions: ["glitch", "whip", "blocks"], camera: "orbit", effects: ["scan", "chromatic", "glow"], interactions: ["toggle", "click", "modal"], pan: 1.62, depth: 1.28, tilt: 1.4, grain: 0.15, blur: 26, bridgeGain: 0.72, settle: 0.18 },
  { key: "launch", label: "Launch", transitions: ["zoom", "flash", "whip"], camera: "snap", effects: ["glow", "glass", "scan"], interactions: ["click", "tab", "modal"], pan: 1.28, depth: 1.22, tilt: 0.86, grain: 0.08, blur: 20, bridgeGain: 0.66, settle: 0.22 },
];

export const MOTION_VARIATIONS = Object.fromEntries(Array.from({ length: 100 }, (_, index) => {
  const family = MOTION_FAMILIES[index % MOTION_FAMILIES.length];
  const variant = Math.floor(index / MOTION_FAMILIES.length);
  return [`mv${String(index + 1).padStart(3, "0")}`, {
    id: `mv${String(index + 1).padStart(3, "0")}`,
    label: `${family.label} ${String(variant + 1).padStart(2, "0")}`,
    family: family.key,
    primary: family.transitions[variant % family.transitions.length],
    accents: family.transitions.filter((_, i) => i !== variant % family.transitions.length),
    camera: family.camera,
    effect: family.effects[variant % family.effects.length],
    interaction: family.interactions[variant % family.interactions.length],
    pan: family.pan * (1 + variant * 0.055),
    depth: family.depth * (1 + variant * 0.04),
    tilt: family.tilt + (variant % 4) * 0.28,
    grain: Math.min(0.18, family.grain + variant * 0.006),
    blur: family.blur + (variant % 5) * 2,
    bridgeGain: family.bridgeGain + (variant % 3) * 0.035,
    settle: Math.max(0.18, family.settle + (variant % 4) * 0.035),
    soundProfile: `snd${String((index % 50) + 1).padStart(3, "0")}`,
  }];
}));

export function resolveMotionVariation(value, brief = {}, style = "kinetic") {
  const raw = typeof value === "object" && value ? value.id || value.variation || value.key : value;
  if (typeof raw === "string" && MOTION_VARIATIONS[raw]) return MOTION_VARIATIONS[raw];
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 100) return MOTION_VARIATIONS[`mv${String(n).padStart(3, "0")}`];
  const key = `${brief.domain || brief.name || "snapmy-site"}:${style}`;
  return MOTION_VARIATIONS[`mv${String((hash(key) % 100) + 1).padStart(3, "0")}`];
}

export const SCENE_TYPES = ["coldopen", "hook", "statement", "flashword", "screen", "scroll", "feature", "featureStack", "stat", "quote", "logos", "marquee", "split", "cta", "endcard", "flyin", "depthReveal", "matchcut", "track"];

// Product scenes share one browser window. Keeping this list deliberately small
// means the rig only persists while the viewer is looking at the product world.
const WINDOW_SCENE_TYPES = new Set(["screen", "scroll", "split"]);

// Scenes that carry real product motion and may span several content beats inside one camera group.
const CAMERA_SCENE_TYPES = new Set(["flyin", "track", "depthReveal", "matchcut"]);

// Product-subject scene types used for the product-screen-time measurement.
const PRODUCT_SCENE_TYPES = new Set(["screen", "scroll", "split", "flyin", "depthReveal", "matchcut", "track"]);

// SFX cue each transition / scene type implies (consumed by the score engine)
const TRANSITION_SFX = { whip: "swoosh_fast", zoom: "swoosh_air", flash: "rev_glass", wipe: "swoosh_mid", iris: "swoosh_low", glitch: "glitch", push: "swoosh_mid", cut: null, blocks: "swoosh_fast" };

/* ---------------- utils ---------------- */
export function rng(seed) {
  let s = seed >>> 0 || 2654435769;
  const next = () => { s |= 0; s = (s + 1831565813) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  return { next, pick: (a) => a[Math.floor(next() * a.length)], range: (a, b) => a + (b - a) * next() };
}
export function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const J = (v) => JSON.stringify(v);
const r3 = (n) => Math.round(n * 1000) / 1000;
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function hexToRgb(h) { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.split("").map((c) => c + c).join(""); const n = parseInt(h, 16); if (isNaN(n) || h.length !== 6) return null; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
const rgbToHex = ([r, g, b]) => "#" + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, "0")).join("");
function lum(hex) { const c = hexToRgb(hex) || [0, 0, 0]; const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); }
export function contrast(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
function mix(a, b, t) { const x = hexToRgb(a) || [0, 0, 0], y = hexToRgb(b) || [0, 0, 0]; return rgbToHex(x.map((v, i) => v + (y[i] - v) * t)); }
function saturation(hex) { const c = hexToRgb(hex); if (!c) return 0; const mx = Math.max(...c), mn = Math.min(...c); return mx === 0 ? 0 : (mx - mn) / mx; }

/* ---------------- evidence + timing ---------------- */
function focalPoint(value, fallback = { x: 0.5, y: 0.5 }) {
  const coord = (v, fallbackValue) => { const n = typeof v === "string" ? parseFloat(v) : Number(v); return Number.isFinite(n) ? (n > 1 ? n / 100 : n) : fallbackValue; };
  const raw = value?.focalPoint || value?.focal_point || value?.crop?.focalPoint || value?.crop?.focal_point || value?.focus;
  if (Array.isArray(raw)) return { x: clamp(coord(raw[0], fallback.x), 0, 1), y: clamp(coord(raw[1], fallback.y), 0, 1) };
  if (typeof raw === "string") {
    const p = raw.split(/[\s,]+/).map((n) => parseFloat(n));
    if (p.length >= 2 && p.every(Number.isFinite)) return { x: clamp(p[0] > 1 ? p[0] / 100 : p[0], 0, 1), y: clamp(p[1] > 1 ? p[1] / 100 : p[1], 0, 1) };
  }
  if (raw && typeof raw === "object") return { x: clamp(coord(raw.x ?? raw.left, fallback.x), 0, 1), y: clamp(coord(raw.y ?? raw.top, fallback.y), 0, 1) };
  return fallback;
}

function assetInfo(value, index = 0, role = "visual") {
  if (!value) return null;
  if (typeof value === "string") return { id: `asset-${index + 1}`, url: value, role, focalPoint: { x: 0.5, y: 0.5 } };
  if (typeof value !== "object") return null;
  const url = value.url || value.src || value.image || value.href || value.path;
  if (!url) return null;
  const width = Number(value.width || value.naturalWidth || 0) || 0;
  const height = Number(value.height || value.naturalHeight || 0) || 0;
  const fp = focalPoint(value);
  return {
    ...value,
    id: String(value.id || value.key || `asset-${index + 1}`),
    url: String(url),
    role: value.role || role,
    page: value.page || value.route || "",
    width,
    height,
    focalPoint: fp,
    fullPage: Boolean(value.fullPage || value.fullpage || value.isFullPage || role === "fullpage" || (height > width * 1.4 && height > 0)),
  };
}

function collectAssets(brief = {}) {
  const out = []; const seen = new Set();
  const add = (value, role) => {
    const a = assetInfo(value, out.length, role); if (!a) return;
    const existing = out.find((item) => item.url === a.url);
    if (existing) { if (a.fullPage) { existing.fullPage = true; existing.role = existing.role === "screen" ? "workflow" : existing.role; } return; }
    seen.add(a.url); out.push(a);
  };
  const assets = [
    ...(Array.isArray(brief.assets) ? brief.assets : brief.assets ? Object.values(brief.assets) : []),
    ...(Array.isArray(brief.evidenceAssets) ? brief.evidenceAssets : []),
    ...(Array.isArray(brief.sourceAssets) ? brief.sourceAssets : []),
  ];
  assets.forEach((a) => add(a, a?.role || "visual"));
  (brief.screenshots || []).forEach((a) => add(a, a?.role || "screen"));
  if (brief.fullpage) add(brief.fullpage, "fullpage");
  (brief.fullpages || []).forEach((a) => add(a, "fullpage"));
  return out;
}

function resolveAsset(value, assets = []) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isInteger(value)) return assets[value] || null;
  if (typeof value === "string") return assets.find((a) => a.id === value || a.url === value) || assetInfo(value, assets.length);
  if (typeof value === "object") return assetInfo(value, assets.length, value.role || "visual");
  return null;
}

function assignAssets(scenes, assets) {
  let previous = null;
  return scenes.map((scene, index) => {
    const visual = PRODUCT_SCENE_TYPES.has(scene.type);
    if (!visual) return { ...scene, asset: null };
    const explicit = scene.asset ?? scene.src ?? (Number.isInteger(scene.shot) ? assets[scene.shot] : null)
      ?? (Number.isInteger(scene.from) ? assets[scene.from] : null);
    const requested = resolveAsset(explicit, assets);
    const preferred = assets.filter((a) => scene.type !== "scroll" || a.fullPage);
    const candidates = preferred.length ? preferred : assets;
    const cameraTreatment = scene.type === "matchcut" || scene.type === "track" || scene.type === "depthReveal" || scene.type === "flyin";
    const reusable = Boolean(scene.allowRepeat || scene.matchCut || scene.holdAsset || cameraTreatment || scene.shot != null || scene.from != null);
    let asset = requested;
    const explicitMissing = !requested && explicit != null;
    if (!asset && candidates.length) asset = candidates.find((a) => a.id !== previous) || candidates[0];
    if (asset && asset.id === previous && !requested) {
      const alternate = candidates.find((a) => a.id !== previous);
      if (alternate) asset = alternate;
      else if (!reusable) asset = asset;
    }
    if (scene.type === "scroll" && asset && !asset.fullPage && !scene.allowStillScroll) {
      const full = candidates.find((a) => a.fullPage);
      asset = full || asset;
    }
    if (asset) previous = asset.id;
    return { ...scene, asset };
  });
}

function assignMatchAssets(scenes, assets) {
  return scenes.map((scene) => {
    if (scene.type !== "matchcut") return scene;
    const fromAsset = resolveAsset(scene.from != null ? scene.from : scene.asset, assets);
    const toAsset = resolveAsset(scene.to != null ? scene.to : scene.matchTo, assets) || scene.asset || fromAsset;
    return { ...scene, asset: scene.asset || fromAsset || toAsset, fromAsset, toAsset };
  });
}

function shotTiming(scene, index, rand) {
  const defaults = { coldopen: 1.5, hook: 1.125, statement: 1.5, flashword: 1.125, screen: 2.75, scroll: 2.75, feature: 1.875, featureStack: 1.875, stat: 1.875, quote: 2.25, logos: 1.5, marquee: 1.5, split: 2.75, cta: 2.25, endcard: 2.625, flyin: 4.5, depthReveal: 3.75, matchcut: 3.75, track: 4.5 };
  const requested = Number(scene.duration ?? scene.durationSeconds ?? 0);
  const quiet = Boolean(scene.quiet || scene.hold === true || scene.holdQuiet === true || scene.silent === true);
  const longHold = Number(scene.hold ?? scene.holdDuration ?? 0);
  if (quiet) {
    const quietSpan = clamp(Math.round((longHold > 1.5 ? longHold : 5.5) / BEAT) * BEAT, Math.round(5.5 / BEAT) * BEAT, CUT * 4.4);
    const entrance = BEAT * 0.7;
    const followThrough = clamp(Number(scene.followThrough ?? scene.follow_through ?? 0.24), 0.08, 0.45);
    const hold = clamp(Number(longHold > 1.5 ? longHold : quietSpan - entrance - followThrough), BEAT * 0.55, Math.max(BEAT * 0.55, quietSpan - BEAT * 0.3));
    return { span: quietSpan, entrance, hold, followThrough, quiet: true };
  }
  const requestedSpan = requested > 0 ? Math.round(requested / BEAT) * BEAT : 0;
  if (requestedSpan >= 5) {
    const entrance = PRODUCT_SCENE_TYPES.has(scene.type) ? BEAT * 1.8 : BEAT * 1.2;
    const followThrough = clamp(Number(scene.followThrough ?? scene.follow_through ?? 0.2), 0.08, 0.45);
    const hold = clamp(Number(scene.hold ?? (requestedSpan - entrance - followThrough)), BEAT * 0.55, Math.max(BEAT * 0.55, requestedSpan - BEAT * 0.3));
    return { span: requestedSpan, entrance, hold, followThrough, quiet: false };
  }
  const variance = requested > 0 ? 0 : (index % 3 === 1 ? rand.range(-0.12, 0.12) : index % 3 === 2 ? rand.range(-0.08, 0.16) : 0);
  const raw = requested > 0 ? requested : (defaults[scene.type] || CUT) + variance;
  const explicitHero = Boolean(scene.hero || scene.hold);
  const span = clamp(Math.round(raw / BEAT) * BEAT, BEAT * 3, explicitHero ? CUT * 4.5 : CUT * 3.5);
  const entrance = PRODUCT_SCENE_TYPES.has(scene.type) || scene.type === "screen" || scene.type === "scroll" || scene.type === "split" ? BEAT * 1.8 : BEAT * 1.2;
  const followThrough = clamp(Number(scene.followThrough ?? scene.follow_through ?? (scene.type === "cta" || scene.type === "endcard" ? 0.3 : 0.18)), 0.08, 0.45);
  const hold = clamp(Number(scene.hold ?? (span - entrance - followThrough)), BEAT * 0.55, Math.max(BEAT * 0.55, span - BEAT * 0.3));
  return { span, entrance, hold, followThrough, quiet: false };
}

function shotMotion(scene, index, type, motion, rand) {
  const map = { coldopen: "reveal", hook: "staccato", statement: "clarify", flashword: "impact", screen: "focus", scroll: "scan", feature: "reveal", featureStack: "cascade", stat: "count", quote: "settle", logos: "assemble", marquee: "glide", split: "compare", cta: "commit", endcard: "land", flyin: "soar", depthReveal: "unveil", matchcut: "match", track: "truck" };
  const q = Boolean(scene.quiet || scene.hold === true || scene.holdQuiet === true || scene.silent === true);
  const source = typeof scene.motion === "object" ? scene.motion : {};
  const intent = scene.motionIntent || scene.motion_intent || (typeof scene.motion === "string" ? scene.motion : source.intent) || map[type] || "reveal";
  const direction = Number(source.direction ?? scene.direction ?? ((index + (motion.camera === "orbit" ? 1 : 0)) % 2 ? 1 : -1)) < 0 ? -1 : 1;
  return {
    intent,
    direction,
    quiet: q,
    anticipation: clamp(Number(source.anticipation ?? scene.anticipation ?? (intent === "impact" || intent === "commit" ? 0.16 : 0.08)), 0, 0.28),
    overshoot: q ? 0 : clamp(Number(source.overshoot ?? scene.overshoot ?? (intent === "land" || intent === "settle" ? 0.018 : 0.035)), 0, 0.08),
    followThrough: clamp(Number(source.followThrough ?? scene.followThrough ?? scene.follow_through ?? (intent === "glide" ? 0.24 : 0.16)), 0.08, 0.45),
    tilt: q ? 0 : clamp(Number(source.tilt ?? scene.tilt ?? (motion.tilt || 0) * 0.18 + rand.range(-0.3, 0.3)), -2.5, 2.5),
  };
}

function quietShotCode(id, t0, timing) {
  const span = Math.max(BEAT, timing.span);
  const hold = Math.max(BEAT, span - Math.min(0.9, span * 0.3));
  return [
    `tl.fromTo("#${id}-motion",{opacity:.82,scale:1.008},{opacity:1,scale:1,duration:${r3(Math.min(0.9, span * 0.3))},ease:"sine.out"},${r3(t0)});`,
    `tl.to("#${id}-motion",{opacity:.9,scale:1.002,duration:${r3(Math.max(BEAT, hold * 0.42))},ease:"sine.inOut"},${r3(t0 + Math.min(0.9, span * 0.3))});`,
    `tl.to("#${id}-motion",{opacity:1,scale:1,duration:${r3(Math.max(BEAT, hold * 0.58))},ease:"sine.inOut"},${r3(t0 + Math.min(0.9, span * 0.3) + hold * 0.42)});`,
  ];
}

function effectPolicy(brief = {}, plan = {}, motion = {}, style = {}) {
  const requested = plan.treatment || plan.effects || {};
  const fx = Array.isArray(requested) ? Object.fromEntries(requested.map((x) => [x, true])) : (requested && typeof requested === "object" ? requested : {});
  const productTone = `${brief.category || ""} ${brief.domain || ""} ${brief.name || ""}`.toLowerCase();
  const signal = /(crypto|web3|gaming|developer|terminal|cli|security|cyber|music)/.test(productTone);
  return {
    chrome: fx.chrome === true || fx.browserFrame === true,
    hud: fx.hud === true,
    glare: fx.glare === true,
    vignette: fx.vignette === true ? 0.16 : 0,
    grain: clamp(Number(fx.grain ?? (fx.texture ? 0.018 : 0)), 0, 0.04),
    scan: fx.scan === true && signal,
    glitch: fx.glitch === true && signal,
    flash: fx.flash === true,
    blocks: fx.blocks === true,
    contrast: fx.contrast === true,
    effect: fx.effect || (signal && motion.effect === "scan" ? "scan" : "clean"),
  };
}

function targetBounds(asset, scene, W, H) {
  const raw = scene.target || scene.targetBounds || asset?.target || asset?.targetBounds;
  if (!raw || typeof raw !== "object") return null;
  const x = Number(raw.x ?? raw.left), y = Number(raw.y ?? raw.top), w = Number(raw.width ?? raw.w), h = Number(raw.height ?? raw.h);
  if (![x, y, w, h].every(Number.isFinite)) return null;
  const normalized = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 1;
  return { x: (normalized ? x * W : x), y: (normalized ? y * H : y), w: (normalized ? w * W : w), h: (normalized ? h * H : h) };
}

function targetMarkup(id, asset, scene, W, H, u) {
  const b = targetBounds(asset, scene, W, H); if (!b) return "";
  return `<div class="target-mark" id="${id}-target" style="left:${Math.round(b.x)}px;top:${Math.round(b.y)}px;width:${Math.max(4, Math.round(b.w))}px;height:${Math.max(4, Math.round(b.h))}px"></div>`;
}

function assetStyle(asset, top = 0) {
  if (!asset?.url) return `top:${top}px`;
  const fp = focalPoint(asset);
  const fit = asset.crop?.fit === "contain" || asset.fit === "contain" ? "contain" : "cover";
  return `top:${top}px;background-image:url('${esc(asset.url)}');background-position:${Math.round(fp.x * 100)}% ${Math.round(fp.y * 100)}%;background-size:${fit}`;
}

export function palette(brief, style) {
  const cols = (brief.colors || []).filter((c) => hexToRgb(c));
  // most saturated brand color as accent
  let accent = cols.slice().sort((a, b) => saturation(b) - saturation(a))[0] || "#E3412B";
  if (saturation(accent) < 0.18) accent = "#E3412B";
  const second = cols.find((c) => c !== accent && saturation(c) > 0.2 && contrast(c, accent) > 1.4) || mix(accent, style.dark ? "#ffffff" : "#000000", 0.35);
  const bg = style.dark ? mix("#0A0A0B", accent, 0.06) : mix("#F4F1EA", accent, 0.05);
  const fg = style.dark ? "#F5F3EE" : "#121212";
  let acc = accent;
  // keep accent legible on bg
  let guard = 0;
  while (contrast(acc, bg) < 3 && guard++ < 8) acc = mix(acc, style.dark ? "#ffffff" : "#000000", 0.15);
  const onAccent = contrast("#ffffff", accent) >= contrast("#111111", accent) ? "#ffffff" : "#111111";
  const surface = style.dark ? mix(bg, "#ffffff", 0.07) : mix(bg, "#000000", 0.05);
  const muted = mix(fg, bg, 0.45);
  return { bg, fg, accent: acc, field: accent, onAccent, second, surface, muted };
}

// greedy line wrap
function wrap(text, maxChars) {
  const words = String(text).split(/\s+/).filter(Boolean); const lines = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim(); }
  if (cur) lines.push(cur); return lines;
}
function fitSize(lines, width, ratio, maxFs) { const longest = Math.max(1, ...lines.map((l) => l.length)); return Math.min(maxFs, Math.floor(width / (longest * ratio))); }
function clip(text, n) { const s = String(text || "").trim(); if (s.length <= n) return s; const cut = s.slice(0, n); return cut.slice(0, cut.lastIndexOf(" ") > n * 0.5 ? cut.lastIndexOf(" ") : n).replace(/[,.;:\-–—]+$/, "") ; }

/* ---------------- transitions ---------------- */
function transitionCode(kind, O, I, T, ctx) {
  const { W, H, dir, motion = {}, treatment = {} } = ctx; const L = [];
  const blur = treatment.contrast ? Math.min(18, motion.blur || 18) : Math.min(8, motion.blur || 8);
  const x = Math.round(W * 0.38) * dir;
  switch (kind) {
    case "whip":
      L.push(`tl.fromTo(${J(O)},{x:0,filter:"blur(0px)"},{x:${-x},filter:"blur(${blur}px)",duration:.2,ease:"power3.in",immediateRender:false},${r3(T - 0.2)});`);
      L.push(`tl.fromTo(${J(I)},{x:${x},filter:"blur(${blur}px)"},{x:0,filter:"blur(0px)",duration:.34,ease:"expo.out",immediateRender:false},${r3(T - 0.02)});`);
      break;
    case "zoom":
      L.push(`tl.fromTo(${J(O)},{scale:1,filter:"blur(0px)",opacity:1},{scale:1.7,filter:"blur(${Math.round(blur * 0.65)}px)",opacity:0,duration:.24,ease:"power3.in",immediateRender:false},${r3(T - 0.22)});`);
      L.push(`tl.fromTo(${J(I)},{scale:.72,filter:"blur(${Math.round(blur * 0.58)}px)"},{scale:1,filter:"blur(0px)",duration:.42,ease:"expo.out",immediateRender:false},${r3(T - 0.04)});`);
      break;
    case "flash":
      L.push(`tl.fromTo("#fx-flash",{opacity:0},{opacity:1,duration:.12,ease:"power2.in",immediateRender:false},${r3(T - 0.12)});`);
      L.push(`tl.to("#fx-flash",{opacity:0,duration:.4,ease:"power2.out"},${r3(T)});`);
      L.push(`tl.fromTo(${J(I)},{scale:1.1},{scale:1,duration:.6,ease:"expo.out",immediateRender:false},${r3(T)});`);
      break;
    case "wipe":
      L.push(`tl.fromTo(${J(I)},{clipPath:"inset(0% 0% 0% 100%)"},{clipPath:"inset(0% 0% 0% 0%)",duration:.36,ease:"expo.inOut",immediateRender:false},${r3(T - 0.18)});`);
      L.push(`tl.fromTo(${J(O)},{x:0},{x:${Math.round(-W * 0.12)},duration:.36,ease:"expo.inOut",immediateRender:false},${r3(T - 0.18)});`);
      break;
    case "iris":
      L.push(`tl.fromTo(${J(I)},{clipPath:"circle(0% at 50% 50%)"},{clipPath:"circle(80% at 50% 50%)",duration:.46,ease:"expo.inOut",immediateRender:false},${r3(T - 0.2)});`);
      L.push(`tl.fromTo(${J(O)},{scale:1},{scale:.9,duration:.46,ease:"power2.inOut",immediateRender:false},${r3(T - 0.2)});`);
      break;
    case "push":
      L.push(`tl.fromTo(${J(O)},{yPercent:0},{yPercent:-100,duration:.4,ease:"power4.inOut",immediateRender:false},${r3(T - 0.2)});`);
      L.push(`tl.fromTo(${J(I)},{yPercent:100},{yPercent:0,duration:.4,ease:"power4.inOut",immediateRender:false},${r3(T - 0.2)});`);
      break;
    case "glitch": {
      const offs = [[-38, 14], [52, -10], [-18, 26], [0, 0]];
      offs.forEach(([a, b], k) => L.push(`tl.set(${J(k < 2 ? O : I)},{x:${a},y:${b},filter:${J(k === 3 ? "none" : `hue-rotate(${60 + k * 70}deg) saturate(2.2)`)}},${r3(T - 0.12 + k * 0.045)});`));
      L.push(`tl.fromTo("#fx-glitch",{opacity:0},{opacity:1,duration:.02,immediateRender:false},${r3(T - 0.12)});`);
      L.push(`tl.set("#fx-glitch",{backgroundPosition:"0px 37px"},${r3(T - 0.07)});`);
      L.push(`tl.set("#fx-glitch",{opacity:0},${r3(T + 0.08)});`);
      break;
    }
    case "blocks":
      L.push(`tl.fromTo("#fx-blocks i",{scaleY:0,transformOrigin:"50% 100%"},{scaleY:1,duration:.2,ease:"power3.in",stagger:.028,immediateRender:false},${r3(T - 0.3)});`);
      L.push(`tl.fromTo("#fx-blocks i",{scaleY:1,transformOrigin:"50% 0%"},{scaleY:0,duration:.28,ease:"power3.out",stagger:.028,immediateRender:false},${r3(T + 0.02)});`);
      break;
    case "cut":
    default:
      L.push(`tl.fromTo(${J(I)},{scale:1.08},{scale:1,duration:.5,ease:"expo.out",immediateRender:false},${r3(T)});`);
  }
  return L;
}

/* ---------------- scenes ---------------- */
// each builder returns { html, code: string[] } ; t0 = downbeat of the scene
function sceneBuilders(ctx) {
  const { W, H, P, S, brief, u, portrait, motion, treatment } = ctx;
  const windowed = () => Boolean(ctx.windowed);
  const timing = () => ctx.timing || { span: CUT, hold: CUT * 0.5, followThrough: 0.16 };
  const spec = () => ctx.motionSpec || { direction: 1, followThrough: 0.16, overshoot: 0.03, anticipation: 0.08 };
  const up = (s) => (S.upper ? String(s).toUpperCase() : String(s));
  const padX = Math.round(W * (portrait ? 0.08 : 0.075));
  const innerW = W - padX * 2;
  const kicker = (id, text) => `<div class="kick" id="${id}-k"><span class="dot"></span>${esc(text)}</div>`;
  const kickerIn = (id, t0) => `tl.fromTo("#${id}-k",{opacity:0,x:-24},{opacity:1,x:0,duration:.4,ease:"expo.out"},${r3(t0 + 0.05)});`;
  const drift = (id, t0, amt = 0.045) => {
    const span = Math.max(BEAT, timing().span);
    const follow = Math.min(spec().followThrough || timing().followThrough || 0.16, span * 0.28);
    const dx = Math.round((spec().direction || 1) * amt * W * 0.012);
    return [`tl.fromTo("#${id} .cam",{scale:1,x:0},{scale:${1 + amt * 0.72},x:${dx},duration:${r3(Math.max(BEAT, span - follow))},ease:"sine.inOut"},${r3(t0)});`, `tl.to("#${id} .cam",{scale:${1 + amt},x:${Math.round(dx * 0.35)},duration:${r3(follow)},ease:"power2.out"},${r3(t0 + span - follow)});`].join("");
  };
  const assetFor = (sc) => sc.asset || null;
  const hasFrame = (sc) => sc.browserFrame === true || (sc.browserFrame !== false && treatment.chrome);
  const chrome = () => `<div class="chrome"><i></i><i></i><i></i><span class="url mono">${esc(brief.domain || "")}</span></div>`;
  const deviceMarkup = (id, asset, frame, top, className = "device-frame") => {
    const body = asset?.url ? `<div class="shot" style="${assetStyle(asset, top)}"></div>` : `<div class="shot ghost" style="top:${top}px"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`;
    return `<div class="browser ${frame ? "" : "clean-browser"} ${className}" id="${id}-b">${frame ? chrome() : ""}${body}</div>`;
  };
  const cursorMarkup = (id, uu) => `<svg class="cursor rig-cursor" id="${id}-cur" viewBox="0 0 24 24" width="${Math.round(uu * 6)}" height="${Math.round(uu * 6)}"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
  const cursorPath = (id, t0, bounds, span) => {
    const from = { x: -Math.round(W * 0.28), y: -Math.round(H * 0.24), rotate: -8 };
    const to = bounds && Number.isFinite(bounds.x)
      ? { x: bounds.x + bounds.w * 0.45 - W / 2, y: bounds.y + bounds.h * 0.42 - H / 2 }
      : { x: Math.round(W * 0.06), y: Math.round(H * 0.08), rotate: 2 };
    const start = t0 + Math.min(BEAT * 1.6, span * 0.2);
    const travel = clamp(span * 0.34, 0.55, 1.5);
    const settle = Math.min(0.24, span * 0.08);
    return [
      `tl.fromTo("#${id}-cur",{x:${from.x},y:${from.y},opacity:0,rotation:-8},{x:${Math.round(to.x * 0.92)},y:${Math.round(to.y * 0.94)},rotation:${to.rotate},opacity:1,duration:${r3(travel)},ease:"power2.inOut"},${r3(start)});`,
      `tl.to("#${id}-cur",{x:${Math.round(to.x)},y:${Math.round(to.y)},rotation:${to.rotate},duration:${r3(settle)},ease:"power2.out"},${r3(start + travel)});`,
      `tl.to("#${id}-cur",{y:${Math.round(to.y) + Math.round(u * 0.35)},duration:${r3(Math.min(0.26, span * 0.08))},ease:"power2.inOut"},${r3(start + travel + settle)});`,
    ];
  };
  const interactionCode = (sc, id, t0, type, asset) => {
    const mode = sc.interaction || (type === "scroll" ? "scroll" : type === "screen" ? motion.interaction : "none");
    const target = targetBounds(asset, sc, W, H);
    const code = [];
    if (target && ["click", "tab", "toggle", "modal"].includes(mode)) {
      code.push(`tl.fromTo("#${id}-target",{opacity:0,scale:.94},{opacity:.72,scale:1,duration:.18,ease:"power2.out"},${r3(t0 + Math.min(timing().span * 0.46, timing().span - BEAT))});`, `tl.to("#${id}-target",{opacity:.18,scale:1.035,duration:${r3(Math.min(.34, timing().followThrough + .12))},ease:"sine.out"},${r3(t0 + Math.min(timing().span * 0.62, timing().span - BEAT * 0.6))});`);
    }
    if (target && mode === "modal") code.push(`tl.fromTo("#${id}-b",{filter:"brightness(1)"},{filter:"brightness(1.1)",duration:.12,yoyo:true,repeat:1,ease:"power2.inOut"},${r3(t0 + Math.min(timing().span * 0.58, timing().span - BEAT * 0.5))});`);
    const sfx = { click: "mouse_click_b", tab: "ui_tick", toggle: "toggle", modal: "confirm", hover: "swoosh_air", scroll: "mouse_down" }[mode];
    return { code, hits: target && sfx ? [{ t: t0 + (mode === "scroll" ? Math.min(.2, timing().span * .18) : Math.min(timing().span * .58, timing().span - BEAT * 0.5)), sfx, gain: mode === "hover" ? 0.18 : 0.3 }] : [] };
  };

  return {
    coldopen(sc, id, t0) {
      const name = up(sc.word || brief.name || "Snapmy.site");
      const chars = [...name];
      const fs = Math.min(Math.round(H * (portrait ? 0.16 : 0.26)), Math.floor(innerW / (chars.length * S.ratio)));
      const html = `<div class="cam center"><div class="mono tiny" id="${id}-tag">${esc(brief.domain || "")}</div><h1 class="disp mask" style="font-size:${fs}px">${chars.map((c, i) => `<span class="ch" data-i="${i}">${c === " " ? "&nbsp;" : esc(c)}</span>`).join("")}</h1><div class="rule" id="${id}-rule"></div></div>`;
      const code = [
        `tl.fromTo("#${id} .ch",{yPercent:120,rotate:8},{yPercent:0,rotate:0,duration:.55,ease:"expo.out",stagger:${r3(Math.min(0.05, 0.3 / chars.length))}},${r3(t0 + 0.05)});`,
        `tl.fromTo("#${id}-rule",{scaleX:0},{scaleX:1,duration:.5,ease:"expo.inOut"},${r3(t0 + BEAT * 2)});`,
        `tl.fromTo("#${id}-tag",{opacity:0,y:20},{opacity:.7,y:0,duration:.4,ease:"power3.out"},${r3(t0 + BEAT * 2)});`,
        drift(id, t0, 0.06),
      ];
      return { html, code };
    },
    hook(sc, id, t0) {
      const words = (sc.words && sc.words.length ? sc.words : String(sc.text || "").split(/\s+/)).slice(0, 4).map(up);
      const lines = words;
      const fs = fitSize(lines, innerW, S.ratio, Math.round(H * (portrait ? 0.12 : 0.2)));
      const html = `<div class="cam stack">${words.map((w, i) => `<div class="mask"><div class="disp w" id="${id}-w${i}" style="font-size:${fs}px;${i === words.length - 1 ? `color:var(--accent)` : ""}">${esc(w)}</div></div>`).join("")}</div>`;
      const code = words.map((w, i) => `tl.fromTo("#${id}-w${i}",{yPercent:110,skewY:6},{yPercent:0,skewY:0,duration:.34,ease:"expo.out"},${r3(t0 + i * BEAT)});`);
      code.push(drift(id, t0, 0.05));
      return { html, code, hits: words.map((_, i) => ({ t: t0 + i * BEAT, sfx: "perc_snap", gain: 0.5 })) };
    },
    statement(sc, id, t0) {
      const text = sc.text || brief.headline || "";
      const maxC = portrait ? 12 : 18;
      const lines = wrap(clip(text, 64), maxC).slice(0, 4);
      const fs = fitSize(lines, innerW, S.ratio, Math.round(H * (portrait ? 0.1 : 0.15)));
      const accentWord = (sc.accent || "").toLowerCase();
      const html = `<div class="cam left">${sc.kicker ? kicker(id, sc.kicker) : ""}${lines.map((l, i) => `<div class="mask"><div class="disp ln" id="${id}-l${i}" style="font-size:${fs}px">${l.split(" ").map((w) => accentWord && w.toLowerCase().replace(/[^\w]/g, "") === accentWord.replace(/[^\w]/g, "") ? `<span class="hl" id="${id}-hl"><b></b><span>${esc(up(w))}</span></span>` : esc(up(w))).join(" ")}</div></div>`).join("")}</div>`;
      const code = [
        `tl.fromTo("#${id} .ln",{yPercent:112},{yPercent:0,duration:.5,ease:"expo.out",stagger:.07},${r3(t0 + 0.02)});`,
        sc.kicker ? kickerIn(id, t0) : "",
        accentWord ? `tl.fromTo("#${id}-hl b",{scaleX:0},{scaleX:1,duration:.4,ease:"expo.inOut"},${r3(t0 + BEAT * 2)});` : "",
        drift(id, t0, 0.035),
      ];
      return { html, code };
    },
    flashword(sc, id, t0) {
      const w = up(clip(sc.word || sc.text || brief.name, 14));
      const fs = Math.min(Math.round(H * (portrait ? 0.2 : 0.42)), Math.floor(innerW / (Math.max(3, w.length) * S.ratio)));
      const html = `<div class="field"></div><div class="cam center"><div class="disp fw" id="${id}-w" style="font-size:${fs}px;color:var(--onAccent)">${esc(w)}</div></div>`;
      const code = [
        `tl.fromTo("#${id}-w",{scale:1.35,rotate:-4,opacity:0},{scale:1,rotate:0,opacity:1,duration:.45,ease:"expo.out"},${r3(t0)});`,
        `tl.to("#${id}-w",{scale:.94,duration:${CUT},ease:"none"},${r3(t0 + 0.45)});`,
      ];
      return { html, code, hits: [{ t: t0, sfx: "boom", gain: 0.55 }] };
    },
    screen(sc, id, t0, idx) {
      const asset = assetFor(sc);
      const fw = portrait ? W * 0.9 : W * 0.74;
      const fh = fw * (portrait ? 1.25 : 0.6);
      const cap = sc.caption ? `<div class="cap disp" id="${id}-cap" style="font-size:${Math.round(u * (portrait ? 6 : 5.2))}px">${esc(up(clip(sc.caption, 34)))}</div>` : "";
      const frame = hasFrame(sc);
      const bodyTop = windowed() ? 0 : (frame ? Math.round(u * 4.4) : 0);
      const body = asset?.url ? `<div class="shot" style="${assetStyle(asset, bodyTop)}"></div>` : `<div class="shot ghost" style="top:${bodyTop}px"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`;
      const page = `<div class="window-page" id="${id}-b">${body}${treatment.glare ? `<div class="glare" id="${id}-g"></div>` : ""}</div>`;
      const mark = targetMarkup(id, asset, sc, W, H, u);
      const html = windowed() ? `<div class="cam center persp window-cam">${page}${cap}${mark}</div>` : `<div class="cam center persp"><div class="browser ${frame ? "" : "clean-browser"}" id="${id}-b" style="width:${Math.round(fw)}px;height:${Math.round(fh)}px">${frame ? chrome() : ""}${body}${treatment.glare ? `<div class="glare" id="${id}-g"></div>` : ""}</div>${cap}${mark}</div>`;
      const active = Math.max(BEAT, timing().span);
      const code = [
        `tl.fromTo("#${id}-b",{rotateX:${frame ? 14 : 5},rotateY:${frame && !portrait ? -5 : 0},y:${Math.round(H * (frame ? 0.08 : 0.025))},scale:${frame ? .92 : .98}},{rotateX:${frame ? 2 : 0},rotateY:0,y:0,scale:1,duration:${r3(Math.min(.8, active * .42))},ease:"power3.out"},${r3(t0)});`,
        `tl.to("#${id}-b",{rotateX:0,scale:${frame ? 1.018 : 1.01},duration:${r3(Math.max(BEAT, active - Math.min(.8, active * .42)))},ease:"sine.inOut"},${r3(t0 + Math.min(.8, active * .42))});`,
        treatment.glare ? `tl.fromTo("#${id}-g",{xPercent:-120},{xPercent:140,duration:${r3(Math.min(1.1, active * .6))},ease:"power2.inOut"},${r3(t0 + Math.min(.25, active * .12))});` : "",
        sc.caption ? `tl.fromTo("#${id}-cap",{opacity:0,y:30},{opacity:1,y:0,duration:${r3(Math.min(.45, active * .25))},ease:"expo.out"},${r3(t0 + Math.min(BEAT * 2, active * .55))});` : "",
      ];
      const interaction = interactionCode(sc, id, t0, "screen", asset);
      return { html, code: [...code, ...interaction.code], hits: interaction.hits };
    },
    scroll(sc, id, t0, idx) {
      const asset = assetFor(sc);
      const fw = portrait ? W * 0.86 : W * 0.62;
      const fh = portrait ? H * 0.7 : H * 0.8;
      const body = asset?.url ? `<img class="tall" id="${id}-img" src="${esc(asset.url)}" alt="" style="object-position:${Math.round(focalPoint(asset).x * 100)}% ${Math.round(focalPoint(asset).y * 100)}%">` : `<div class="shot ghost tallghost" id="${id}-img"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div><div class="gh2"></div><div class="gh3"></div></div>`;
      const page = `<div class="window-page" id="${id}-b"><div class="viewport">${body}</div></div>`;
      const frame = hasFrame(sc);
      const mark = targetMarkup(id, asset, sc, W, H, u);
      const html = windowed() ? `<div class="cam center window-cam">${page}${mark}</div>` : `<div class="cam center"><div class="browser ${frame ? "" : "clean-browser"}" id="${id}-b" style="width:${Math.round(fw)}px;height:${Math.round(fh)}px">${frame ? chrome() : ""}<div class="viewport">${body}</div></div>${mark}</div>`;
      const active = Math.max(BEAT, timing().span);
      const code = [
        `tl.fromTo("#${id}-b",{y:${Math.round(H * (frame ? 0.18 : 0.06))},rotate:${frame && !portrait ? -2 : 0}},{y:0,rotate:0,duration:${r3(Math.min(.6, active * .28))},ease:"expo.out"},${r3(t0)});`,
        `tl.fromTo("#${id}-img",{yPercent:0},{yPercent:-${portrait ? 45 : 55},duration:${r3(Math.max(BEAT, active - Math.min(.35, active * .16)))},ease:"power2.inOut"},${r3(t0 + Math.min(.1, active * .08))});`,
      ];
      const interaction = interactionCode(sc, id, t0, "scroll", asset);
      return { html, code: [...code, ...interaction.code], hits: interaction.hits };
    },
    feature(sc, id, t0, idx) {
      const showNum = (ctx.featureCount || 0) > 1;
      const ord = sc.ordinal != null ? sc.ordinal : (ctx.featureOrdinal != null ? ctx.featureOrdinal : (sc.index ?? idx));
      const n = String((ord >= 0 ? ord : 0) + 1).padStart(2, "0");
      const title = up(clip(sc.title || sc.text, 40));
      const lines = wrap(title, portrait ? 12 : 20).slice(0, 3);
      const fs = fitSize(lines, innerW * (portrait ? 1 : 0.78), S.ratio, Math.round(H * (portrait ? 0.085 : 0.12)));
      const numFs = Math.round(H * (portrait ? 0.22 : 0.42));
      const num = showNum ? `<div class="num disp" id="${id}-n" style="font-size:${numFs}px">${n}</div>` : "";
      const html = `<div class="cam left feat${showNum ? "" : " sonum"}">${num}<div class="ftext">${sc.kicker ? kicker(id, sc.kicker) : ""}${lines.map((l, i) => `<div class="mask"><div class="disp ln" style="font-size:${fs}px">${esc(l)}</div></div>`).join("")}${sc.sub ? `<p class="sub" id="${id}-s" style="font-size:${Math.round(u * 2.6)}px">${esc(clip(sc.sub, 80))}</p>` : ""}</div></div>`;
      const code = [
        showNum ? `tl.fromTo("#${id}-n",{yPercent:30,opacity:0},{yPercent:0,opacity:1,duration:.7,ease:"expo.out"},${r3(t0)});` : "",
        `tl.fromTo("#${id} .ln",{yPercent:112},{yPercent:0,duration:.5,ease:"expo.out",stagger:.07},${r3(t0 + BEAT * 0.5)});`,
        sc.kicker ? kickerIn(id, t0) : "",
        sc.sub ? `tl.fromTo("#${id}-s",{opacity:0,y:16},{opacity:1,y:0,duration:.45,ease:"power3.out"},${r3(t0 + BEAT * 2)});` : "",
        drift(id, t0, 0.03),
      ];
      return { html, code };
    },
    featureStack(sc, id, t0) {
      const items = (sc.items || brief.features || []).slice(0, 3).map((x) => up(clip(typeof x === "string" ? x : x.title, 26)));
      const fs = Math.round(Math.min(u * (portrait ? 6 : 6.2), innerW / (Math.max(8, ...items.map((s) => s.length)) * S.ratio * 0.72)));
      const html = `<div class="cam center"><div class="chips">${items.map((t, i) => `<div class="chip" id="${id}-c${i}" style="font-size:${fs}px"><span class="tick">✓</span>${esc(t)}</div>`).join("")}</div></div>`;
      const code = items.map((_, i) => `tl.fromTo("#${id}-c${i}",{y:${Math.round(H * 0.18)},opacity:0,rotate:${i % 2 ? 3 : -3}},{y:0,opacity:1,rotate:0,duration:.42,ease:"back.out(1.6)"},${r3(t0 + i * BEAT)});`);
      code.push(drift(id, t0, 0.03));
      return { html, code, hits: items.map((_, i) => ({ t: t0 + i * BEAT, sfx: "pop_a", gain: 0.45 })) };
    },
    stat(sc, id, t0) {
      const raw = String(sc.value || "10x");
      const m = raw.match(/^([^\d]*)([\d.,]+)(.*)$/);
      const pre = m ? m[1] : "", num = m ? parseFloat(m[2].replace(/,/g, "")) : 0, post = m ? m[3] : raw;
      const dec = m && m[2].includes(".") ? (m[2].split(".")[1] || "").length : 0;
      const fs = Math.min(Math.round(H * (portrait ? 0.2 : 0.36)), Math.floor(innerW / (Math.max(3, raw.length) * S.ratio * 1.05)));
      const html = `<div class="cam center"><div class="disp statv" style="font-size:${fs}px"><span>${esc(pre)}</span><span id="${id}-v">${m ? (0).toFixed(dec) : esc(raw)}</span><span class="acc">${esc(post)}</span></div><div class="statl" id="${id}-l" style="font-size:${Math.round(u * 3.4)}px">${esc(up(clip(sc.label || "", 48)))}</div><div class="bar"><i id="${id}-bar"></i></div></div>`;
      const code = [
        `tl.fromTo("#${id} .statv",{scale:.8,opacity:0},{scale:1,opacity:1,duration:.4,ease:"expo.out"},${r3(t0)});`,
        m ? `(function(){var o={v:0},el=document.getElementById("${id}-v");tl.fromTo(o,{v:0},{v:${num},duration:1.0,ease:"power3.out",onUpdate:function(){el.textContent=o.v.toLocaleString("en-US",{minimumFractionDigits:${dec},maximumFractionDigits:${dec}})}},${r3(t0 + 0.05)});})();` : "",
        `tl.fromTo("#${id}-bar",{scaleX:0},{scaleX:1,duration:1.0,ease:"power3.out"},${r3(t0 + 0.05)});`,
        `tl.fromTo("#${id}-l",{opacity:0,y:20},{opacity:1,y:0,duration:.4,ease:"power3.out"},${r3(t0 + BEAT * 2)});`,
        drift(id, t0, 0.03),
      ];
      const hits = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => ({ t: t0 + 0.05 + k * 0.1, sfx: "ui_tick", gain: 0.25 - k * 0.02 }));
      return { html, code, hits };
    },
    quote(sc, id, t0) {
      const text = clip(sc.text || "", 90);
      const lines = wrap(text, portrait ? 18 : 30).slice(0, 4);
      const fs = fitSize(lines, innerW, 0.5, Math.round(H * (portrait ? 0.055 : 0.075)));
      const html = `<div class="cam left quote"><div class="qm disp" id="${id}-q">“</div>${lines.map((l) => `<div class="mask"><div class="ln qt" style="font-size:${fs}px">${esc(l)}</div></div>`).join("")}<div class="who mono" id="${id}-a">— ${esc(clip(sc.author || brief.name, 40))}</div></div>`;
      const code = [
        `tl.fromTo("#${id}-q",{scale:0,rotate:-20},{scale:1,rotate:0,duration:.5,ease:"back.out(2)"},${r3(t0)});`,
        `tl.fromTo("#${id} .ln",{yPercent:110},{yPercent:0,duration:.5,ease:"expo.out",stagger:.08},${r3(t0 + 0.1)});`,
        `tl.fromTo("#${id}-a",{opacity:0,x:-20},{opacity:.75,x:0,duration:.4,ease:"power3.out"},${r3(t0 + BEAT * 2.5)});`,
        drift(id, t0, 0.025),
      ];
      return { html, code };
    },
    logos(sc, id, t0) {
      const names = (sc.names || brief.logos || []).slice(0, 6);
      const cols = portrait ? 2 : 3;
      const html = `<div class="cam center"><div class="kick" id="${id}-k"><span class="dot"></span>${esc(sc.kicker || "Trusted by")}</div><div class="logos" style="grid-template-columns:repeat(${cols},1fr)">${names.map((n, i) => `<div class="lg" id="${id}-g${i}" style="font-size:${Math.round(u * (portrait ? 5.4 : 6))}px">${esc(clip(n, 16))}</div>`).join("")}</div></div>`;
      const code = [kickerIn(id, t0), `tl.fromTo("#${id} .lg",{opacity:0,y:30,scale:.9},{opacity:1,y:0,scale:1,duration:.4,ease:"expo.out",stagger:${r3(BEAT / 2)}},${r3(t0 + 0.05)});`, drift(id, t0, 0.03)];
      return { html, code };
    },
    marquee(sc, id, t0) {
      const text = up(clip(sc.text || brief.name, 24));
      const fs = Math.round(H * (portrait ? 0.09 : 0.16));
      const row = (k) => `<div class="mrow" id="${id}-r${k}" style="font-size:${fs}px">${Array(6).fill(`<span class="${k === 1 ? "solid" : "outline"}">${esc(text)}</span><span class="star">✦</span>`).join("")}</div>`;
      const html = `<div class="cam mq">${row(0)}${row(1)}${row(2)}</div>`;
      const code = [0, 1, 2].map((k) => `tl.fromTo("#${id}-r${k}",{xPercent:${k % 2 ? -30 : -5}},{xPercent:${k % 2 ? -5 : -30},duration:${CUT + 0.4},ease:"none"},${r3(t0 - 0.2)});`);
      code.push(`tl.fromTo("#${id} .mq",{rotate:-6,scale:1.2},{rotate:-4,scale:1.05,duration:${CUT},ease:"power2.out"},${r3(t0)});`);
      return { html, code };
    },
    split(sc, id, t0, idx) {
      const asset = assetFor(sc);
      const lines = wrap(up(clip(sc.text || brief.headline, 48)), portrait ? 14 : 12).slice(0, 4);
      const fs = fitSize(lines, portrait ? innerW : W * 0.36, S.ratio, Math.round(H * (portrait ? 0.07 : 0.1)));
      const html = `<div class="cam splitw ${portrait ? "col" : ""}"><div class="stext">${lines.map((l) => `<div class="mask"><div class="disp ln" style="font-size:${fs}px">${esc(l)}</div></div>`).join("")}</div><div class="sframe" id="${id}-f">${asset?.url ? `<div class="shot" style="${assetStyle(asset)}"></div>` : `<div class="shot ghost"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`}</div>${targetMarkup(id, asset, sc, W, H, u)}</div>`;
      const active = Math.max(BEAT, timing().span);
      const code = [
        `tl.fromTo("#${id} .ln",{yPercent:112},{yPercent:0,duration:${r3(Math.min(.5, active * .28))},ease:"expo.out",stagger:.07},${r3(t0 + 0.02)});`,
        `tl.fromTo("#${id}-f",{clipPath:"inset(0% 0% 100% 0% round 24px)"},{clipPath:"inset(0% 0% 0% 0% round 24px)",duration:${r3(Math.min(.6, active * .34))},ease:"expo.inOut"},${r3(t0 + 0.05)});`,
        asset?.url ? `tl.fromTo("#${id}-f .shot",{scale:1.16},{scale:1.01,duration:${r3(Math.max(BEAT, active - .1))},ease:"power2.out"},${r3(t0 + 0.05)});` : "",
      ];
      return { html, code };
    },
    cta(sc, id, t0) {
      const line = up(clip(sc.text || brief.cta || brief.tagline || brief.headline || "See what is possible", 30));
      const lines = wrap(line, portrait ? 12 : 22).slice(0, 2);
      const fs = fitSize(lines, innerW, S.ratio, Math.round(H * (portrait ? 0.1 : 0.14)));
      const btn = clip(sc.button || brief.ctaLabel || brief.cta_text || `Explore ${brief.name || "the product"}`, 22);
      const active = Math.max(BEAT, timing().span);
      const showCursor = sc.cursor === true || sc.showCursor === true;
      const cursor = showCursor ? `<svg class="cursor" id="${id}-cur" viewBox="0 0 24 24" width="${Math.round(u * 6)}" height="${Math.round(u * 6)}"><path d="M4 2l16 9-7 2-3 7z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>` : "";
      const html = `<div class="cam center">${lines.map((l) => `<div class="mask"><div class="disp ln" style="font-size:${fs}px">${esc(l)}</div></div>`).join("")}<div class="btnwrap"><div class="btn" id="${id}-btn" style="font-size:${Math.round(u * 3.2)}px">${esc(btn)} <span class="arr">→</span><i class="rip" id="${id}-rip"></i></div><div class="url2 mono" style="font-size:${Math.round(u * 2.2)}px">${esc(brief.domain || "")}</div></div>${cursor}</div>`;
      const code = [
        `tl.fromTo("#${id} .ln",{yPercent:112},{yPercent:0,duration:${r3(Math.min(.5, active * .24))},ease:"expo.out",stagger:.07},${r3(t0)});`,
        `tl.fromTo("#${id}-btn",{scale:.78,opacity:0},{scale:1,opacity:1,duration:${r3(Math.min(.45, active * .24))},ease:"back.out(1.45)"},${r3(t0 + Math.min(BEAT, active * .18))});`,
        showCursor ? `tl.fromTo("#${id}-cur",{x:${Math.round(W * 0.3)},y:${Math.round(H * 0.3)},opacity:0},{x:${Math.round(u * 2)},y:${Math.round(u * 2)},opacity:1,duration:${r3(Math.min(.5, active * .28))},ease:"power3.inOut"},${r3(t0 + Math.min(BEAT * 1.6, active * .54))});` : "",
        `tl.to("#${id}-btn",{scale:.94,duration:.08,ease:"power2.in"},${r3(t0 + Math.max(BEAT, active - BEAT * 0.9))});`,
        `tl.to("#${id}-btn",{scale:1,duration:${r3(Math.min(.32, active * .18))},ease:"power2.out"},${r3(t0 + Math.max(BEAT, active - BEAT * 0.82))});`,
        `tl.fromTo("#${id}-rip",{scale:0,opacity:.45},{scale:2.8,opacity:0,duration:${r3(Math.min(.6, active * .32))},ease:"power2.out"},${r3(t0 + Math.max(BEAT, active - BEAT * 0.9))});`,
      ];
      return { html, code, hits: [{ t: t0 + Math.max(BEAT, active - BEAT * 0.9), sfx: "mouse_click_b", gain: 0.5 }] };
    },
    flyin(sc, id, t0) {
      const asset = assetFor(sc);
      const frame = hasFrame(sc);
      const fw = portrait ? W * 0.66 : W * 0.54;
      const fh = fw * (portrait ? 1.25 : 0.62);
      const active = Math.max(BEAT * 4, timing().span);
      const flight = Math.max(2.5, active * 0.6);
      const push = Math.max(BEAT * 3, active - flight - 0.4);
      const pushAt = t0 + flight;
      const cap = sc.caption ? `<div class="cap disp" id="${id}-cap" style="font-size:${Math.round(u * (portrait ? 6 : 5.2))}px">${esc(up(clip(sc.caption, 34)))}</div>` : "";
      const bodyTop = frame ? Math.round(u * 4.4) : 0;
      const body = asset?.url ? `<div class="shot" style="${assetStyle(asset, bodyTop)}"></div>` : `<div class="shot ghost" style="top:${bodyTop}px"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`;
      const mark = targetMarkup(id, asset, sc, W, H, u);
      const html = `<div class="cam center persp rig-cam"><div class="fly-rig" id="${id}-rig"><div class="browser ${frame ? "" : "clean-browser"}" id="${id}-b" style="width:${Math.round(fw)}px;height:${Math.round(fh)}px">${frame ? chrome() : ""}${body}${treatment.glare ? `<div class="glare" id="${id}-g"></div>` : ""}</div>${cursorMarkup(id, u)}</div>${cap}${mark}<div class="scrim" id="${id}-scrim"></div></div>`;
      const code = [
        `tl.set("#${id}-rig",{z:-1400,scale:.6,rotationX:18,rotationY:-8,opacity:0,transformPerspective:${Math.round(W * 1.4)}},${r3(t0 - BEAT * 0.5)});`,
        `tl.to("#${id}-rig",{opacity:1,duration:.4,ease:"power2.out"},${r3(t0)});`,
        `tl.fromTo("#${id}-rig",{z:-1400,scale:.6,rotationX:18,rotationY:-8,opacity:0},{z:-180,scale:.96,rotationX:4,rotationY:0,opacity:1,duration:${r3(flight)},ease:"power3.out"},${r3(t0)});`,
        `tl.fromTo("#${id}-b",{rotateX:6,rotateY:-4},{rotateX:1,rotateY:0,duration:${r3(flight * 0.9)},ease:"power2.out"},${r3(t0 + 0.1)});`,
        treatment.glare ? `tl.fromTo("#${id}-g",{xPercent:-130},{xPercent:130,duration:${r3(flight)},ease:"power2.inOut"},${r3(t0 + flight * 0.3)});` : "",
        `tl.to("#${id}-rig",{z:40,scale:2.4,rotationX:0,rotateX:0,transformPerspective:${Math.round(W * 1.4)},duration:${r3(push)},ease:"power2.inOut"},${r3(pushAt)});`,
        `tl.fromTo("#${id}-scrim",{opacity:0},{opacity:.5,duration:${r3(push * 0.55)},ease:"power2.in"},${r3(pushAt)});`,
        `tl.fromTo("#${id}-b",{saturate:1,brightness:1},{brightness:1.05,duration:${r3(push * 0.4)},yoyo:true,repeat:1,ease:"power2.inOut"},${r3(pushAt + push * 0.3)});`,
        sc.caption ? `tl.fromTo("#${id}-cap",{opacity:0,y:30},{opacity:1,y:0,duration:${r3(Math.min(.45, active * .25))},ease:"expo.out"},${r3(t0 + Math.min(flight * 0.8, active * .5))});` : "",
        ...cursorPath(id, t0, targetBounds(asset, sc, W, H), active),
      ];
      const hits = [{ t: r3(t0 + 0.05), sfx: "swoosh_air", gain: 0.5 }, { t: r3(pushAt), sfx: "swoosh_fast", gain: 0.55 }];
      const bounds = targetBounds(asset, sc, W, H);
      if (bounds) hits.push({ t: r3(t0 + Math.min(BEAT * 1.6, active * 0.2) + clamp(active * 0.34, 0.55, 1.5)), sfx: "mouse_click_b", gain: 0.32 });
      return { html, code, hits };
    },
    depthReveal(sc, id, t0) {
      const asset = assetFor(sc);
      const active = Math.max(BEAT * 3, timing().span);
      const fw = portrait ? W * 0.9 : W * 0.74;
      const fh = fw * (portrait ? 1.25 : 0.6);
      const frame = hasFrame(sc);
      const bodyTop = frame ? Math.round(u * 4.4) : 0;
      const body = asset?.url ? `<div class="shot" style="${assetStyle(asset, bodyTop)}"></div>` : `<div class="shot ghost" style="top:${bodyTop}px"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`;
      const words = up(clip(sc.text || brief.headline || brief.name, 30));
      const lines = wrap(words, portrait ? 10 : 14).slice(0, 3);
      const maskTitle = `${lines.map((l) => esc(l)).join(" ")}`;
      const mark = targetMarkup(id, asset, sc, W, H, u);
      const html = `<div class="cam center persp depth-cam"><div class="depth-bg" id="${id}-bg">${asset?.url ? `<div class="shot" style="${assetStyle(asset)}"></div>` : `<div class="shot ghost"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`}</div>${frame ? `<div class="browser" id="${id}-b" style="width:${Math.round(fw)}px;height:${Math.round(fh)}px">${chrome()}${body}</div>` : ""}<div class="depth-fg" id="${id}-fg"><h2 class="depth-type disp" style="font-size:${Math.round(u * (portrait ? 13 : 11))}px">${maskTitle}</h2><div class="depth-rule" id="${id}-rule"></div></div>${mark}${treatment.glare ? `<div class="glare" id="${id}-g"></div>` : ""}</div>`;
      const code = [
        `tl.fromTo("#${id}-bg",{scale:1.22,y:${Math.round(H * 0.04)}},{scale:1.02,y:0,duration:${r3(Math.max(BEAT, active * 0.8))},ease:"power2.out"},${r3(t0)});`,
        `tl.to("#${id} .depth-type",{yPercent:7,duration:${r3(Math.max(BEAT, active * 0.7))},ease:"sine.inOut"},${r3(t0 + active * 0.28)});`,
        `tl.fromTo("#${id}-fg",{clipPath:"inset(0% 0% 0% 0%)"},{clipPath:"inset(0% 0% 100% 0%)",duration:${r3(Math.min(0.7, active * 0.34))},ease:"power3.inOut"},${r3(t0 + active * 0.42)});`,
        `tl.to("#${id}-fg",{y:${Math.round(-H * 0.14)},duration:${r3(Math.max(BEAT, active * 0.7))},ease:"power2.inOut"},${r3(t0 + active * 0.42)});`,
        `tl.to("#${id}-bg",{scale:1.06,duration:${r3(Math.max(BEAT, active * 0.6))},ease:"sine.inOut"},${r3(t0 + active * 0.3)});`,
        `tl.fromTo("#${id}-rule",{scaleX:0},{scaleX:1,duration:${r3(Math.min(0.6, active * 0.3))},ease:"expo.inOut"},${r3(t0 + 0.1)});`,
        treatment.glare ? `tl.fromTo("#${id}-g",{xPercent:-130},{xPercent:130,duration:${r3(Math.min(1.1, active * 0.6))},ease:"power2.inOut"},${r3(t0 + Math.min(0.4, active * 0.15))});` : "",
      ];
      return { html, code, hits: [{ t: r3(t0 + active * 0.42), sfx: "swoosh_mid", gain: 0.42 }] };
    },
    matchcut(sc, id, t0) {
      const from = sc.fromAsset || sc.matchFrom || assetFor(sc);
      const to = sc.toAsset || sc.matchTo || from;
      const active = Math.max(BEAT * 3, timing().span);
      const cut = t0 + active * 0.5;
      const shape = sc.shape === "rect" ? "inset" : "circle";
      const clipFrom = shape === "rect" ? "inset(4% 6% 4% 6% round 28px)" : "circle(9% at 50% 50%)";
      const clipTo = shape === "rect" ? "inset(0% 0% 0% 0% round 0px)" : "circle(86% at 50% 50%)";
      const layerFrom = from?.url ? `<div class="shot match-a" style="${assetStyle(from)}"></div>` : `<div class="shot ghost"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`;
      const layerTo = to?.url ? `<div class="shot match-b" style="${assetStyle(to)}"></div>` : `<div class="shot ghost"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div></div>`;
      const cap = sc.text ? `<div class="cap disp" id="${id}-cap" style="font-size:${Math.round(u * 5)}px">${esc(up(clip(sc.text, 34)))}</div>` : "";
      const mark = targetMarkup(id, to || from, sc, W, H, u);
      const html = `<div class="cam center persp match-wrap"><div class="match-stage" id="${id}-stage"><div class="match-layer match-out" id="${id}-out">${layerFrom}</div><div class="match-layer match-in" id="${id}-in">${layerTo}</div></div>${cap}${mark}<div class="match-flash" id="${id}-flash"></div></div>`;
      const code = [
        `tl.set("#${id}-in",{clipPath:${J(clipFrom)}},${r3(t0)});`,
        `tl.fromTo("#${id}-out",{scale:1.14,filter:"blur(0px)"},{scale:1,filter:"blur(0px)",duration:${r3(active * 0.5)},ease:"power2.inOut"},${r3(t0)});`,
        `tl.fromTo("#${id}-in",{clipPath:${J(clipFrom)}},{clipPath:${J(shape === "rect" ? "inset(0% 0% 0% 0% round 0px)" : "circle(46% at 50% 50%)")},duration:${r3(active * 0.32)},ease:"power2.inOut"},${r3(cut - active * 0.14)});`,
        `tl.to("#${id}-in",{clipPath:${J(clipTo)},duration:${r3(active * 0.46)},ease:"power2.inOut"},${r3(cut + active * 0.04)});`,
        `tl.to("#${id}-out",{scale:1.06,filter:"blur(2px)",duration:${r3(active * 0.46)},ease:"power2.inOut"},${r3(cut)});`,
        `tl.fromTo("#${id}-stage",{scale:1},{scale:1.03,duration:${r3(active * 0.9)},ease:"sine.inOut"},${r3(t0)});`,
        `tl.fromTo("#${id}-flash",{opacity:.42},{opacity:0,duration:.34,ease:"power2.out"},${r3(cut - 0.05)});`,
        sc.text ? `tl.fromTo("#${id}-cap",{opacity:0,y:24},{opacity:1,y:0,duration:${r3(Math.min(.45, active * .22))},ease:"expo.out"},${r3(cut + active * 0.12)});` : "",
      ];
      return { html, code, hits: [{ t: r3(cut), sfx: "boom", gain: 0.45 }] };
    },
    track(sc, id, t0) {
      const asset = assetFor(sc);
      const frame = hasFrame(sc);
      const active = Math.max(BEAT * 4, timing().span);
      const gid = id;
      const mark = targetMarkup(id, asset, sc, W, H, u);
      const cap = sc.caption ? `<div class="track-cap disp" id="${id}-cap" style="font-size:${Math.round(u * 4.6)}px">${esc(up(clip(sc.caption, 34)))}</div>` : "";
      const wide = asset?.url ? `<img class="track-img" id="${id}-img" src="${esc(asset.url)}" alt="" style="object-position:${Math.round(focalPoint(asset).x * 100)}% ${Math.round(focalPoint(asset).y * 100)}%">` : `<div class="shot ghost track-ghost"><div class="gh1"></div><div class="gh2"></div><div class="gh3"></div><div class="gh2"></div><div class="gh3"></div></div>`;
      const html = `<div class="cam center track-cam"><div class="track-rig"><div class="track-stage" id="${id}-stage"><div class="browser track-browser ${frame ? "" : "clean-browser"}" id="${id}-b"><div class="track-band">${frame ? `<div class="chrome"><i></i><i></i><i></i><span class="url mono">${esc(brief.domain || "")}</span></div>` : ""}${wide}</div></div><div class="track-para" id="${id}-para"><div class="track-chip" style="font-size:${Math.round(u * 2.4)}px"><b></b>${esc(clip(sc.kicker || sc.label || cap ? (sc.kicker || sc.label || "") : (brief.category || brief.name || "Live view"), 28))}</div></div><div class="track-glare" id="${id}-glare"></div></div>${cap}${mark}${cursorMarkup(id, u)}</div>`;
      const code = [
        `tl.fromTo("#${id}-stage",{x:${Math.round(W * 0.02)},y:${Math.round(H * 0.03)},scale:1.02},{x:${-Math.round(W * 0.12)},y:0,scale:1.06,duration:${r3(active)},ease:"power1.inOut"},${r3(t0)});`,
        `tl.fromTo("#${id}-img",{xPercent:0},{xPercent:-28,duration:${r3(active)},ease:"none"},${r3(t0)});`,
        `tl.fromTo("#${id}-para",{x:${Math.round(W * 0.16)},y:${Math.round(-H * 0.04)}},{x:${-Math.round(W * 0.1)},y:${Math.round(H * 0.03)},duration:${r3(Math.max(BEAT, active * 0.95))},ease:"sine.inOut"},${r3(t0)});`,
        `tl.fromTo("#${id}-glare",{xPercent:-140},{xPercent:120,duration:${r3(active * 0.7)},ease:"power2.inOut"},${r3(t0 + active * 0.2)});`,
        sc.caption ? `tl.fromTo("#${id}-cap",{opacity:0,y:28},{opacity:1,y:0,duration:${r3(Math.min(.5, active * .22))},ease:"expo.out"},${r3(t0 + active * 0.3)});` : "",
        ...cursorPath(id, t0, targetBounds(asset, sc, W, H), active),
      ];
      const hits = [{ t: r3(t0 + active * 0.3), sfx: "mouse_down", gain: 0.3 }];
      if (targetBounds(asset, sc, W, H)) hits.push({ t: r3(t0 + Math.min(BEAT * 1.6, active * 0.2) + clamp(active * 0.34, 0.55, 1.5)), sfx: "ui_tick", gain: 0.28 });
      return { html, code, hits };
    },
    endcard(sc, id, t0, idx, isLast, total) {
      const name = brief.name || "Snapmy.site";
      const logoAsset = assetInfo(brief.logo, 0, "logo");
      const logo = logoAsset?.url || brief.logo;
      const fs = Math.min(Math.round(H * (portrait ? 0.1 : 0.14)), Math.floor(innerW / (name.length * S.ratio)));
      const la = brief.logoAspect || (logoAsset?.width && logoAsset?.height ? logoAsset.width / logoAsset.height : 0);
      const wordmark = logo && la >= 1.8;
      const tint = S.dark ? "brightness(0) invert(1)" : "brightness(0)";
      const mark = wordmark ? `<img class="logo wm" id="${id}-m" src="${esc(logo)}" alt="" style="height:${Math.round(Math.min(fs * 1.2, (innerW * 0.6) / la))}px;max-width:${Math.round(innerW * 0.6)}px;filter:${tint}">`
        : logo && la > 0 ? `<div class="plate" id="${id}-m" style="width:${Math.round(fs * 1.15)}px;height:${Math.round(fs * 1.15)}px"><img src="${esc(logo)}" alt=""></div>`
        : `<div class="mark" id="${id}-m" style="width:${Math.round(fs * 1.1)}px;height:${Math.round(fs * 1.1)}px;font-size:${Math.round(fs * 0.6)}px">${esc(name[0] || "C")}</div>`;
      const active = Math.max(BEAT * 4, timing().span);
      const html = `<div class="cam center"><div class="lockup">${mark}<div class="disp nm" id="${id}-nm" style="font-size:${fs}px;${wordmark ? "display:none" : ""}">${esc(name)}</div></div><div class="tagl" id="${id}-t" style="font-size:${Math.round(u * 2.8)}px">${esc(clip(sc.text || brief.tagline || brief.headline || brief.domain, 60))}</div><div class="url2 mono" id="${id}-u" style="font-size:${Math.round(u * 2.2)}px">${esc(brief.domain || "")}</div><div class="sweep" id="${id}-sw"></div></div>`;
      const end = total;
      const code = [
        `tl.fromTo("#${id}-m",{scale:.84,rotate:-8,opacity:0},{scale:1,rotate:0,opacity:1,duration:${r3(Math.min(.6, active * .24))},ease:"power2.out"},${r3(t0)});`,
        `tl.fromTo("#${id}-nm",{scale:1.08,opacity:0,filter:"blur(5px)"},{scale:1,opacity:1,filter:"blur(0px)",duration:${r3(Math.min(.8, active * .34))},ease:"power2.out"},${r3(t0 + 0.08)});`,
        `tl.fromTo("#${id}-t",{opacity:0,y:18},{opacity:.85,y:0,duration:${r3(Math.min(.5, active * .22))},ease:"power3.out"},${r3(t0 + Math.min(BEAT * 2, active * .52))});`,
        `tl.fromTo("#${id}-u",{opacity:0},{opacity:.6,duration:${r3(Math.min(.5, active * .22))}},${r3(t0 + Math.min(BEAT * 2.5, active * .66))});`,
        treatment.glare ? `tl.fromTo("#${id}-sw",{xPercent:-150},{xPercent:150,duration:${r3(Math.min(1.2, active * .5))},ease:"power2.inOut"},${r3(t0 + .3)});` : "",
        `tl.to("#${id} .cam",{opacity:0,scale:.985,duration:${r3(Math.min(.5, active * .22))},ease:"power2.in"},${r3(Math.max(t0 + BEAT, end - .5))});`,
      ];
      return { html, code, hits: [{ t: t0, sfx: "boom", gain: 0.55 }] };
    },
  };
}

/* ---------------- transition planner ---------------- */
function planTransitions(scenes, S, rand, motion = {}, treatment = {}) {
  const out = [null];
  for (let i = 1; i < scenes.length; i++) {
    const prev = scenes[i - 1].type, cur = scenes[i].type;
    const prevIntent = scenes[i - 1].motionIntent || scenes[i - 1].motion?.intent;
    const intent = scenes[i].motionIntent || scenes[i].motion?.intent;
    let k = motion.primary || S.primary;
    if (scenes[i].transition && ["whip", "zoom", "flash", "wipe", "iris", "push", "glitch", "blocks", "cut"].includes(scenes[i].transition)) k = scenes[i].transition;
    else if (cur === "flashword") k = "cut";
    else if (cur === "screen" && prev !== "screen") k = intent === "focus" ? "push" : "cut";
    else if (cur === "endcard") k = "cut";
    else if (cur === "quote" || cur === "logos") k = "cut";
    else if (intent === "impact" || intent === "commit") k = treatment.flash ? "flash" : "cut";
    else if (intent === "glide" || prevIntent === "glide") k = "wipe";
    else if (prev === "screen" && cur === "feature") k = "push";
    else if (rand.next() < 0.18) { const accents = (motion.accents || S.accents).filter((a) => a !== "blocks" && (a !== "glitch" || treatment.glitch) && (a !== "flash" || treatment.flash)); if (accents.length) k = rand.pick(accents); }
    if (["glitch", "blocks"].includes(k) && !treatment[k]) k = "cut";
    if (k === out[i - 1]) k = "cut";
    out.push(k);
  }
  return out;
}

const HARD_BREAK_SCENE_TYPES = new Set(["quote", "logos", "stat", "cta", "endcard"]);

function isProductSceneBefore(scenes, i) {
  const scene = scenes[i];
  return Boolean(scene && PRODUCT_SCENE_TYPES.has(scene.type) && (scene.fromAsset?.url || scene.toAsset?.url || scene.asset?.url));
}

function planWindowGroups(scenes, motion = {}, timings = null) {
  const isWindowScene = (scene) => Boolean(PRODUCT_SCENE_TYPES.has(scene.type) && (scene.fromAsset?.url || scene.toAsset?.url || scene.asset?.url));
  const isHardBreak = (i) => HARD_BREAK_SCENE_TYPES.has(scenes[i]?.type);
  const cameraMove = motion.camera === "push" || motion.camera === "track" || motion.camera === "orbit";
  const spanFor = (g) => {
    if (!timings) return 0;
    const a = timings[g.start], b = timings[g.end];
    return a && b ? b.end - a.t : 0;
  };
  const capacity = 12;
  const runs = [];
  for (let i = 0; i < scenes.length;) {
    if (!isWindowScene(scenes[i])) { i++; continue; }
    const start = i;
    let end = i;
    while (end + 1 < scenes.length && !isHardBreak(end + 1)) end++;
    end = Math.min(end, start + capacity - 1);
    runs.push({ start, end });
    i = end + 1;
  }
  const longestIndex = () => {
    let best = -1, bestSpan = -1;
    runs.forEach((r, k) => { const s = spanFor(r); if (s > bestSpan) { bestSpan = s; best = k; } });
    return best;
  };
  const longest = () => {
    const k = longestIndex();
    return k === -1 ? 0 : spanFor(runs[k]);
  };
  if (timings && runs.length > 1) {
    while (longest() < 6.25) {
      let pick = -1, pickCost = Infinity;
      for (let k = 0; k < runs.length - 1; k++) {
        const a = runs[k], b = runs[k + 1];
        if (b.start - a.end > 2) continue;
        const cost = b.start - a.end;
        if (cost < pickCost) { pickCost = cost; pick = k; }
      }
      if (pick === -1) break;
      const absorbed = { start: runs[pick].start, end: runs[pick + 1].end };
      if (absorbed.end - absorbed.start + 1 > capacity) break;
      runs.splice(pick, 2, absorbed);
    }
  }
  if (timings && runs.length) {
    const k = longestIndex();
    if (k !== -1) {
      while (spanFor(runs[k]) < 6.5) {
        const r = runs[k];
        if (r.end + 1 >= scenes.length) break;
        if (r.end - r.start + 2 > capacity) break;
        r.end += 1;
      }
    }
  }
  return runs;
}

function windowGroupForScene(scenes, motion = {}, timings = null) {
  const index = new Map();
  planWindowGroups(scenes, motion, timings).forEach((g) => { for (let i = g.start; i <= g.end; i++) index.set(i, g); });
  return index;
}

function waypointFor(index, W, motion = {}, asset = null, scene = {}, total = 1) {
  const scale = W / 1920;
  const fp = focalPoint(asset, { x: 0.5, y: 0.5 });
  const role = asset?.role || scene.type || "visual";
  const progress = total <= 1 ? 0 : index / (total - 1);
  const pan = motion.pan || 1, depth = motion.depth || 1;
  const camera = motion.camera || "linear";
  const biasX = role === "workflow" || role === "result" ? 0.12 : role === "proof" ? -0.1 : 0;
  const biasY = role === "hero" ? -0.08 : role === "proof" ? 0.1 : 0;
  const arc = camera === "orbit" ? Math.sin(progress * Math.PI) : camera === "drift" ? Math.sin(progress * Math.PI * 0.85) * 0.45 : camera === "snap" ? (index ? 0.6 : 0) : progress * 0.25;
  const x = ((0.5 - fp.x) * 760 + biasX * 420 + arc * 110) * pan;
  const y = ((0.5 - fp.y) * 500 + biasY * 300 + Math.cos(progress * Math.PI) * (camera === "orbit" ? 42 : 14)) * pan;
  const z = (-240 - (role === "hero" ? 70 : role === "workflow" ? 130 : 0) - progress * 180) * depth;
  return {
    x: Math.round(x * scale), y: Math.round(y * scale), z: Math.round(z * scale),
    scale: r3(1 + (role === "result" ? 0.045 : role === "hero" ? 0.025 : 0.012) + (camera === "snap" ? 0.012 : 0)),
    rx: Math.round((index ? (motion.tilt || 0) * (0.35 + progress * 0.35) : 0) * 10) / 10,
    ry: Math.round((index ? ((fp.x - 0.5) * 2 + (camera === "orbit" ? Math.sin(progress * Math.PI) : 0)) * (motion.tilt || 0.3) : 0) * 10) / 10,
  };
}

function shotMotionCode(id, t0, timing, spec) {
  if (spec.quiet) return quietShotCode(id, t0, timing);
  const dir = spec.direction || 1;
  const anticipation = Math.max(0.04, spec.anticipation || 0.08);
  const follow = Math.min(spec.followThrough || timing.followThrough || 0.16, Math.max(0.08, timing.span * 0.24));
  const prepAt = Math.max(0, t0 - anticipation * 0.45);
  const settleAt = Math.max(t0 + anticipation, t0 + timing.span - follow);
  const offset = 9 + Math.round((spec.intent === "impact" ? 5 : 0));
  const tilt = r3((spec.tilt || 0) * 0.12);
  return [
    `tl.fromTo("#${id}-motion",{x:${-dir * offset},y:${dir * 3},scale:${r3(1 - (spec.overshoot || 0.025))},rotate:${-tilt}},{x:0,y:0,scale:1,rotate:0,duration:${r3(anticipation)},ease:"power3.out"},${r3(prepAt)});`,
    `tl.to("#${id}-motion",{x:${dir * Math.round(offset * (spec.overshoot ? 0.5 : 0.28))},y:${-dir * 2},scale:${r3(1 + (spec.overshoot || 0.025))},rotate:${tilt},duration:${r3(follow * 0.58)},ease:"power2.out"},${r3(settleAt)});`,
    `tl.to("#${id}-motion",{x:0,y:0,scale:1,rotate:0,duration:${r3(Math.max(0.08, follow * 0.42))},ease:"sine.out"},${r3(settleAt + follow * 0.58)});`,
  ];
}

/* ---------------- plan fallback (no LLM) ---------------- */
const FALLBACK_STRUCTURES = [
  ["screen", "statement", "scroll", "feature", "stat", "split", "cta", "endcard"],
  ["flyin", "hook", "feature", "depthReveal", "featureStack", "cta", "endcard"],
  ["scroll", "flashword", "matchcut", "feature", "quote", "track", "cta", "endcard"],
  ["depthReveal", "statement", "feature", "stat", "flyin", "featureStack", "cta", "endcard"],
  ["track", "hook", "feature", "split", "quote", "screen", "cta", "endcard"],
  ["split", "flashword", "scroll", "stat", "feature", "matchcut", "cta", "endcard"],
  ["matchcut", "statement", "flyin", "featureStack", "quote", "depthReveal", "cta", "endcard"],
  ["flyin", "hook", "scroll", "feature", "matchcut", "quote", "cta", "endcard"],
];
const FALLBACK_PRODUCT_TYPES = ["screen", "scroll", "split", "flyin", "depthReveal", "matchcut", "track"];
const FALLBACK_CONTENT_TYPES = ["hook", "statement", "flashword", "feature", "featureStack", "quote", "logos"];
export function fallbackPlan(brief, decisions = {}) {
  const f = (brief.features || []).map((x) => (typeof x === "string" ? { title: x } : x)).filter((x) => x.title);
  const stats = (brief.stats || []).filter((s) => s.value);
  const quotes = (brief.quotes || []).filter((q) => q.text);
  const logos = (brief.logos || []).filter(Boolean);
  const assets = collectAssets(brief);

  const given = (Array.isArray(decisions.structure) ? decisions.structure : []).filter((k) => SCENE_TYPES.includes(k));
  const key = `${brief.domain || brief.name || "product"}:${brief.name || ""}`;
  const mixed = (hash(brief.domain || brief.name || "product") ^ (hash(brief.name || "") << 1) ^ (hash(brief.headline || brief.description || "") << 2)) >>> 0;
  const bankIndex = mixed % FALLBACK_STRUCTURES.length;
  const structure = (given.length ? given.slice() : FALLBACK_STRUCTURES[bankIndex].slice())
    .filter((t, i, a) => t !== "marquee" && a.indexOf(t) === i)
    .filter((t) => (t === "stat" ? stats.length > 0 : t === "quote" ? quotes.length > 0 : t === "logos" ? logos.length >= 3 : t === "featureStack" ? f.length >= 2 : true));
  if (!structure.some((t) => FALLBACK_PRODUCT_TYPES.includes(t))) structure.splice(Math.min(1, structure.length), 0, FALLBACK_PRODUCT_TYPES[hash(`${key}:p`) % FALLBACK_PRODUCT_TYPES.length]);
  if (structure.filter((t) => t === "stat").length > 1) { let seen = false; for (let i = structure.length - 1; i >= 0; i--) { if (structure[i] === "stat") { if (seen) structure.splice(i, 1); seen = true; } } }
  if (!structure.length || structure[0] === "endcard") structure.unshift(FALLBACK_PRODUCT_TYPES[hash(`${key}:o`) % FALLBACK_PRODUCT_TYPES.length]);
  if (!structure.includes("cta")) structure.push("cta");
  if (structure[structure.length - 1] !== "endcard") structure.push("endcard");

  const hook = String(decisions.hook || brief.hookCandidates?.[0] || brief.headline || brief.name || "").split(/\s+/).filter(Boolean).slice(0, 4);
  const pathName = String(brief.domain || brief.name || "product").split(/[./]/)[0] || "product";
  const withUrl = assets.filter((a) => a.url);
  const pathAsset = withUrl.length ? withUrl[hash(`${key}:a`) % withUrl.length] : null;
  const pathScroll = withUrl.find((a) => a.fullPage) || pathAsset;
  const productAsset = (n) => withUrl.length ? withUrl[(hash(`${key}:${n}`) + n) % withUrl.length] : null;
  let featAt = 0, prodAt = 0, statAt = 0;
  const feat = () => ({ type: "feature", title: f[featAt]?.title || brief.headline || brief.name || pathName, sub: f[featAt]?.desc, index: featAt++, motionIntent: "reveal" });
  const S = [];
  structure.forEach((type, i) => {
    if (type === "screen") { S.push({ type: "screen", asset: productAsset(prodAt++) || undefined, caption: clip(brief.headline, 34), motionIntent: "focus" }); return; }
    if (type === "scroll") { S.push({ type: "scroll", asset: pathScroll || undefined, caption: clip(brief.headline, 34), motionIntent: "scan" }); return; }
    if (type === "split") { S.push({ type: "split", asset: productAsset(prodAt++) || undefined, text: brief.headline, motionIntent: "compare" }); return; }
    if (type === "flyin") { S.push({ type: "flyin", asset: productAsset(prodAt++) || undefined, caption: clip(brief.headline, 34), motionIntent: "soar" }); return; }
    if (type === "depthReveal") { S.push({ type: "depthReveal", asset: productAsset(prodAt++) || undefined, text: brief.headline || brief.name, motionIntent: "unveil" }); return; }
    if (type === "matchcut") { S.push({ type: "matchcut", asset: productAsset(prodAt++) || undefined, text: clip(brief.headline, 34), motionIntent: "match" }); return; }
    if (type === "track") { S.push({ type: "track", asset: productAsset(prodAt++) || undefined, caption: clip(brief.headline, 34), motionIntent: "truck" }); return; }
    if (type === "hook") { S.push({ type: "hook", words: hook.length ? hook : [brief.name || pathName], motionIntent: "staccato" }); return; }
    if (type === "statement") { S.push({ type: "statement", text: brief.description || brief.headline || brief.name || pathName, kicker: brief.category || "", motionIntent: "clarify" }); return; }
    if (type === "flashword") { S.push({ type: "flashword", word: String(brief.headline || brief.name || pathName).split(/\s+/).sort((a, b) => b.length - a.length)[0], motionIntent: "impact" }); return; }
    if (type === "quote") { S.push({ type: "quote", text: quotes[0]?.text || brief.headline || brief.name, author: quotes[0]?.author, motionIntent: "settle" }); return; }
    if (type === "stat") { S.push({ type: "stat", value: stats[statAt]?.value || "10x", label: stats[statAt]?.label || brief.category, motionIntent: "count" }); statAt++; return; }
    if (type === "logos") { S.push({ type: "logos", names: logos.slice(0, 6), motionIntent: "assemble" }); return; }
    if (type === "featureStack") { S.push({ type: "featureStack", items: (f.length ? f : [{ title: brief.headline || brief.name || pathName }]).slice(0, 3).map((x) => x.title), motionIntent: "cascade" }); return; }
    if (type === "feature") { S.push(feat()); return; }
    if (type === "cta") { S.push({ type: "cta", text: brief.cta || brief.tagline || brief.headline, button: brief.ctaLabel || brief.cta_text, motionIntent: "commit" }); return; }
    if (type === "coldopen") { S.push({ type: "coldopen", word: brief.name }); return; }
    if (type === "endcard") { S.push({ type: "endcard", text: brief.tagline || brief.headline || brief.name, motionIntent: "land" }); }
  });
  if (!S.length) S.push({ type: "screen", asset: pathAsset || undefined, caption: clip(brief.headline, 34), motionIntent: "focus" });
  if (S[S.length - 1].type !== "endcard") S.push({ type: "endcard", text: brief.tagline || brief.headline || brief.name, motionIntent: "land" });
  const style = decisions.style || "kinetic";
  const cameraSeed = hash(`${key}:cam`) % ["push", "track", "orbit", "match", "reveal", "static"].length;
  const direction = {
    concept: `A ${style} product film for ${brief.name || pathName} that opens on real content and builds through its strongest beats.`,
    structure: S.map((s) => s.type),
    camera: ["push", "track", "orbit", "match", "reveal", "static"][cameraSeed],
    opening: S[0].type,
    hero: S.some((s) => s.asset?.url),
    beat: decisions.beat || 20,
    holds: [S.find((s) => FALLBACK_PRODUCT_TYPES.includes(s.type))?.type].filter(Boolean),
  };
  return { style, motionVariation: decisions.motionVariation || decisions.motion_variation || decisions.motion?.variation, scenes: S.slice(0, 24), structure: direction.structure, direction, panel: [] };
}

/* ---------------- main composer ---------------- */
export function compose(brief, plan, opts = {}) {
  const aspect = opts.aspect || "16:9";
  const [W, H] = ASPECTS[aspect] || ASPECTS["16:9"];
  const portrait = H > W * 1.05;
  const styleKey = STYLES[plan.style] ? plan.style : "kinetic";
  const S = STYLES[styleKey];
  const motion = resolveMotionVariation(plan.motionVariation || plan.motion_variation || plan.motion?.variation, brief, styleKey);
  const P = palette(brief, S);
  const rand = rng(hash((brief.domain || "") + styleKey + (opts.seed || 0)));
  const u = Math.min(W, H) / 100;
  const treatment = effectPolicy(brief, plan, motion, S);
  const assetPool = collectAssets(brief);
  let scenes = (plan.scenes || []).filter((s) => SCENE_TYPES.includes(s.type));
  const structure = (Array.isArray(plan.structure) ? plan.structure : []).filter((k) => SCENE_TYPES.includes(k));
  if (!scenes.length) scenes = fallbackPlan(brief, { style: styleKey, motionVariation: motion.id }).scenes;
  if (structure.length) {
    const pool = scenes.slice();
    const ordered = [];
    structure.forEach((type) => {
      const at = pool.findIndex((s) => s.type === type);
      if (at !== -1) ordered.push(pool.splice(at, 1)[0]);
    });
    if (ordered.length) scenes = ordered;
  }
  if (!scenes.length) scenes = [{ type: "statement", text: brief.headline || brief.name }];
  if (scenes[scenes.length - 1].type !== "endcard") scenes.push({ type: "endcard" });
  const featureCount = scenes.filter((s) => s.type === "feature").length;
  { let k = 0; scenes = scenes.map((s) => (s.type === "feature" ? { ...s, ordinal: k++ } : s)); }
  scenes = assignAssets(scenes, assetPool);
  scenes = assignMatchAssets(scenes, assetPool);
  // Real evidence only: a product shot without a real capture is skipped, never faked.
  scenes = scenes.filter((sc) => { if (!PRODUCT_SCENE_TYPES.has(sc.type)) return true; const a = sc.type === "matchcut" ? (sc.fromAsset || sc.toAsset || sc.asset) : sc.asset; return Boolean(a?.url) && !String(a.url).startsWith("data:"); });
  if (!scenes.length || scenes[scenes.length - 1].type !== "endcard") scenes.push({ type: "endcard" });
  const direction = plan.direction && typeof plan.direction === "object" ? plan.direction : {};
  const holds = Array.isArray(direction.holds) ? direction.holds.filter((k) => typeof k === "string") : [];
  if (holds.length) scenes = scenes.map((s) => holds.includes(s.type) ? { ...s, quiet: true, holdQuiet: true } : s);
  if (holds.length && !scenes.some((s) => Number(s.hold) > 1.5)) {
    const firstHeld = scenes.findIndex((s) => holds.includes(s.type));
    if (firstHeld !== -1) scenes[firstHeld] = { ...scenes[firstHeld], hold: 5.5 };
  }
  const N = scenes.length;
  const timings = [];
  const prevAssets = [];
  let cursor = 0;
  scenes.forEach((scene, i) => { const timing = shotTiming(scene, i, rand); const t = cursor; prevAssets.push(scene.fromAsset || scene.asset || null); timings.push({ ...timing, t, end: t + timing.span }); cursor += timing.span; });
  const heroAt = timings.findIndex((x) => x.span >= 5);
  if (heroAt === -1) {
    const namedHero = holds.length ? scenes.findIndex((s) => s.type === holds[0]) : -1;
    const productIdx = scenes.map((s, i) => ({ i, s })).filter(({ s }) => PRODUCT_SCENE_TYPES.has(s.type) && s.asset?.url).sort((a, b) => b.s.asset?.url.length - a.s.asset?.url.length)[0]?.i;
    const mid = Math.floor((N - 1) / 2);
    const pick = namedHero !== -1 ? namedHero : productIdx != null ? productIdx : mid;
    const base = shotTiming({ ...scenes[pick], quiet: true, hold: 5.5 }, pick, rand);
    timings[pick] = { ...timings[pick], ...base };
    let acc = 0;
    for (let i = 0; i < N; i++) { timings[i] = { ...timings[i], t: acc, end: acc + timings[i].span }; acc = timings[i].end; }
  }
  const productBlocks = () => {
    const blocks = [];
    for (let i = 0; i < N;) {
      if (!isProductSceneBefore(scenes, i)) { i++; continue; }
      const start = i;
      let span = 0;
      while (i < N && isProductSceneBefore(scenes, i)) { span += timings[i].span; i++; }
      blocks.push({ start, end: i - 1, span });
    }
    return blocks;
  };
  const MIN_CONTINUOUS = 6.25;
  let prodBlocks = productBlocks();
  if (prodBlocks.length && Math.max(...prodBlocks.map((b) => b.span)) < MIN_CONTINUOUS) {
    const target = prodBlocks.slice().sort((a, b) => b.span - a.span)[0];
    const need = MIN_CONTINUOUS - target.span;
    const grow = target.span >= 5 ? target.start : target.end;
    const extra = Math.ceil(need / BEAT) * BEAT;
    const quietBase = shotTiming({ ...scenes[grow], quiet: true, hold: Math.min(6.375, timings[grow].span + extra) }, grow, rand);
    timings[grow] = { ...timings[grow], ...quietBase };
    let acc = 0;
    for (let i = 0; i < N; i++) { timings[i] = { ...timings[i], t: acc, end: acc + timings[i].span }; acc = timings[i].end; }
  }
  const duration = r3(timings[N - 1].end + 0.42);
  // One continuous camera across the whole film: each scene is a linear segment of a
  // single path, so exiting momentum carries through the cut into the next entrance;
  // quiet holds slow the camera but never stop it.
  const camera = continuousCamera(scenes, timings, plan, W, H, rand);
  const camDirAt = (i) => camera.dirAt(i);
  const ctx = { W, H, P, S, brief, u, portrait, dir: 1, motion, treatment, prevAssets, featureCount, featureOrdinal: 0 };
  const B = sceneBuilders(ctx);
  const trans = planTransitions(scenes, S, rand, motion, treatment);
  const windowGroups = planWindowGroups(scenes, motion, timings);
  const windowGroupAt = windowGroupForScene(scenes, motion, timings);
  const code = [];
  const cues = []; // for the score engine
  const sceneMeta = [];
  let html = "";
  const OV = 0.3; // overlap around each cut for transitions
  const isProductScene = (i) => isProductSceneBefore(scenes, i);
  let windowGroupIndex = 0;
  scenes.forEach((sc, i) => {
    const id = `s${i}`; const shotPlan = timings[i]; const t0 = shotPlan.t;
    const isLast = i === N - 1;
    const LEAD = { whip: 0.02, zoom: 0.04, flash: 0, wipe: 0.18, iris: 0.2, push: 0.2, glitch: 0.03, blocks: 0, cut: 0 };
    const group = windowGroupAt.get(i);

    if (group && isProductScene(i)) {
      if (i !== group.start) return;
      const gid = `wg${windowGroupIndex++}`;
      const groupParts = [];
      const groupEnd = group.end === N - 1 ? duration : timings[group.end].end + OV;
      const fw = portrait ? W * 0.9 : W * 0.74;
      const fh = fw * (portrait ? 1.25 : 0.6);
      const memberIndices = [];
      const wpIndex = new Map();

      ctx.windowed = true;
      for (let j = group.start; j <= group.end; j++) {
        const member = scenes[j];
        if (!isProductScene(j)) continue;
        memberIndices.push(j);
        wpIndex.set(j, memberIndices.length - 1);
      }
      const groupStart = memberIndices.length ? timings[memberIndices[0]].t : timings[group.start].t;
      memberIndices.forEach((j) => {
        const member = scenes[j];
        const memberId = `s${j}`;
        const memberTiming = timings[j];
        const memberT = memberTiming.t;
        ctx.timing = memberTiming;
        ctx.motionSpec = shotMotion(member, j, member.type, motion, rand);
        const built = B[member.type](member, memberId, memberT, j, j === N - 1, duration);
        const wp = waypointFor(wpIndex.get(j), W, motion, member.asset, member, memberIndices.length);
        groupParts.push(`<div id="${memberId}" class="window-shot" data-motion-intent="${esc(ctx.motionSpec.intent)}" data-quiet="${memberTiming.quiet ? 1 : 0}" style="--wx:${wp.x}px;--wy:${wp.y}px;--wz:${wp.z}px;--ws:${wp.scale};opacity:${j === memberIndices[0] ? 1 : 0}"><div class="sc" id="${memberId}-sc"><div class="motion-stage" id="${memberId}-motion">${built.html}</div></div></div>`);
        code.push(`// ${j} ${member.type} · persistent window`, ...built.code.filter(Boolean), ...shotMotionCode(memberId, memberT, memberTiming, ctx.motionSpec));
        (built.hits || []).forEach((h) => cues.push({ ...h, scene: j }));
        sceneMeta.push({ i: j, type: member.type, t: memberT, duration: memberTiming.span, hold: memberTiming.hold, asset: member.asset?.id || null, motion: ctx.motionSpec.intent, transition: j === group.start ? trans[j] : "camera", label: sceneLabel(member) });
        if (wpIndex.get(j) > 0) {
          cues.push({ t: memberT, gain: 0.62, scene: j, transition: "camera", bridge: true });
        }
      });
      ctx.windowed = false;

      const start = group.start === 0 ? 0 : Math.max(0, groupStart - (LEAD[trans[group.start]] ?? 0));
      const rigId = `${gid}-rig`;
      const camId = `${gid}-camera-rig`;
      const shots = memberIndices.length;
      const frame = treatment.chrome ? `<div class="chrome"><i></i><i></i><i></i><span class="url mono">${esc(brief.domain || "")}</span></div>` : "";
      html += `<section id="${gid}" class="clip window-group" data-window-shots="${shots}" data-start="${r3(start)}" data-duration="${r3(groupEnd - start)}" data-track-index="1" style="z-index:${10 + group.start}">${PRODUCT_SCENE_TYPES.has(scenes[memberIndices[0]].type) && scenes[memberIndices[0]].asset?.url ? `<div class="depth-plane" style="background-image:url(&quot;${esc(scenes[memberIndices[0]].asset.url)}&quot;)"></div>` : ""}<div class="window-rig camera-rig" id="${rigId}"><div class="browser ${treatment.chrome ? "" : "clean-browser"}" id="${gid}-browser" style="width:${Math.round(fw)}px;height:${Math.round(fh)}px">${frame}${treatment.chrome ? `<span class="window-count mono">${shots} views</span>` : ""}<div class="window-stage"><div class="window-camera" id="${camId}"><div class="window-world" id="${gid}-world">${groupParts.join("")}</div></div>${treatment.glare ? `<div class="glare"></div>` : ""}</div></div></div></section>\n`;

      const first = waypointFor(0, W, motion, scenes[memberIndices[0]].asset, scenes[memberIndices[0]], shots);
      code.push(`tl.set("#${camId}",{x:${-first.x},y:${-first.y},z:${first.z},rotationX:${first.rx},rotationY:${first.ry}},${r3(groupStart)});`);
      let cursor = groupStart;
      for (let k = 1; k < memberIndices.length; k++) {
        const j = memberIndices[k];
        const prevMember = memberIndices[k - 1];
        const wp = waypointFor(wpIndex.get(j), W, motion, scenes[j].asset, scenes[j], shots);
        const moveAt = Math.max(cursor, timings[j].t - BEAT);
        const moveDuration = Math.max(BEAT, timings[j].t - moveAt);
        const revealAt = timings[j].t - Math.min(.28, timings[j].span * .18);
        code.push(`tl.to("#${camId}",{x:${-wp.x},y:${-wp.y},z:${wp.z},rotationX:${wp.rx},rotationY:${wp.ry},duration:${r3(moveDuration)},ease:"power2.inOut"},${r3(moveAt)});`);
        code.push(`tl.fromTo("#s${j}",{opacity:0,scale:.97},{opacity:1,scale:1,duration:${r3(Math.min(.28, timings[j].span * .18))},ease:"power2.out"},${r3(revealAt)});`);
        code.push(`tl.to("#s${prevMember}",{opacity:0,duration:${r3(Math.min(.24, timings[prevMember].span * .16))},ease:"power2.in"},${r3(revealAt + .05)});`);
        cursor = moveAt + moveDuration;
      }
      {
        const lastIdx = memberIndices[memberIndices.length - 1];
        const tailAt = Math.min(cursor, groupEnd - BEAT);
        const tailDuration = Math.max(BEAT, groupEnd - tailAt - 0.02);
        const last = waypointFor(memberIndices.length - 1, W, motion, scenes[lastIdx].asset, scenes[lastIdx], shots);
        const push = Math.max(1, Math.round(W * 0.02 * (motion.depth || 1)));
        code.push(`tl.to("#${camId}",{x:${-last.x - push},y:${-last.y},z:${last.z - Math.round(push * 1.6)},rotationX:${last.rx},rotationY:${last.ry},duration:${r3(tailDuration)},ease:"sine.inOut"},${r3(tailAt)});`);
      }
      if (group.start > 0) {
        ctx.dir = camDirAt(group.start);
        const k = trans[group.start];
        code.push(...transitionCode(k, `#s${group.start - 1}-sc`, `#s${group.start}-sc`, groupStart, ctx));
        if (TRANSITION_SFX[k]) cues.push({ t: groupStart - 0.12, sfx: TRANSITION_SFX[k], gain: 0.5, scene: group.start, transition: k });
      }
      return;
    }

    const start = i === 0 ? 0 : Math.max(0, t0 - (LEAD[trans[i]] ?? 0));
    const end = isLast ? duration : shotPlan.end + OV;
    ctx.windowed = false;
    ctx.timing = shotPlan;
    ctx.motionSpec = shotMotion(sc, i, sc.type, motion, rand);
    if (sc.type === "feature" && sc.ordinal == null) { ctx.featureOrdinal = (ctx.featureSeen = (ctx.featureSeen || 0)); ctx.featureSeen += 1; }
    const built = B[sc.type](sc, id, t0, i, isLast, duration);
    const absorbed = Boolean(group && !isProductScene(i));
    html += `<section id="${id}" class="clip scene t-${sc.type}" data-start="${r3(start)}" data-duration="${r3(end - start)}" data-shot-duration="${r3(shotPlan.span)}" data-hold="${r3(shotPlan.hold)}" data-motion-intent="${esc(ctx.motionSpec.intent)}" data-quiet="${shotPlan.quiet ? 1 : 0}" data-track-index="${1 + (i % 2)}" style="z-index:${10 + i}">${PRODUCT_SCENE_TYPES.has(sc.type) && sc.asset?.url ? `<div class="depth-plane" style="background-image:url(&quot;${esc(sc.asset.url)}&quot;)"></div>` : ""}<div class="sc" id="${id}-sc"><div class="ground"></div><div class="motion-stage" id="${id}-motion">${built.html}</div></div></section>\n`;
    code.push(`// ${i} ${sc.type}`, ...built.code.filter(Boolean), ...shotMotionCode(id, t0, shotPlan, ctx.motionSpec));
    (built.hits || []).forEach((h) => cues.push({ ...h, scene: i }));
    if (i > 0 && !absorbed) {
      ctx.dir = camDirAt(i);
      const k = trans[i];
      code.push(...transitionCode(k, `#s${i - 1}-sc`, `#${id}-sc`, t0, ctx));
      if (TRANSITION_SFX[k]) cues.push({ t: t0 - 0.12, sfx: TRANSITION_SFX[k], gain: 0.5, scene: i, transition: k });
    }
    sceneMeta.push({ i, type: sc.type, t: t0, duration: shotPlan.span, hold: shotPlan.hold, asset: sc.asset?.id || null, motion: ctx.motionSpec.intent, transition: absorbed ? "camera" : trans[i], label: sceneLabel(sc) });
  });

  const fingerprint = scenes.map((s) => s.type).join(">");
  sceneMeta.sort((a, b) => a.i - b.i);
  let productSeconds = 0;
  scenes.forEach((sc, i) => {
    const a = sc.type === "matchcut" ? (sc.fromAsset || sc.toAsset || sc.asset) : sc.asset;
    if (PRODUCT_SCENE_TYPES.has(sc.type) && a?.url) productSeconds += timings[i].span;
  });
  productSeconds = r3(productSeconds);
  let continuousShotSeconds = 0;
  windowGroups.forEach((g) => {
    const members = [];
    for (let j = g.start; j <= g.end; j++) if (isProductScene(j)) members.push(j);
    if (!members.length) return;
    const t = timings[members[0]].t;
    const end = timings[g.end].end;
    if (end - t > continuousShotSeconds) continuousShotSeconds = end - t;
  });
  continuousShotSeconds = r3(Math.max(0, continuousShotSeconds));
  const firstContent = scenes.find((sc) => sc.type !== "coldopen" && (sc.asset?.url || sc.text || sc.word || sc.title || sc.value || sc.caption));
  const firstContentAt = r3(firstContent ? timings[scenes.indexOf(firstContent)].t : 0);
  const statsCount = scenes.filter((s) => s.type === "stat").length;
  const aspectMatches = W === (ASPECTS[aspect] || ASPECTS["16:9"])[0] && H === (ASPECTS[aspect] || ASPECTS["16:9"])[1];
  const checks = { productSeconds, continuousShotSeconds, firstContentAt, statsCount, aspectMatches };

  code.push(...camera.code);
  const grainSteps = [];
  if (treatment.grain > 0) for (let t = 0; t < duration; t += 1 / 12) grainSteps.push(`tl.set("#fx-grain",{backgroundPosition:"${Math.floor(rand.next() * 200)}px ${Math.floor(rand.next() * 200)}px"},${r3(t)});`);
  // HUD progress
  const hud = treatment.hud ? `<div id="hud" class="clip" data-start="0" data-duration="${r3(duration)}" data-track-index="5"><div class="hud-in mono"><span class="rec"></span><span>${esc((brief.name || "").toUpperCase())}</span><span class="sp"></span><span id="hud-n">01/${String(N).padStart(2, "0")}</span></div><div class="hud-bar"><i id="hud-p"></i></div></div>` : "";
  const hudCode = treatment.hud ? [`tl.fromTo("#hud-p",{scaleX:0},{scaleX:1,duration:${r3(duration)},ease:"none"},0);`, `(function(){var hp={v:0},el=document.getElementById("hud-n");tl.fromTo(hp,{v:0},{v:${N},duration:${r3(duration)},ease:"none",onUpdate:function(){var k=Math.min(${N},Math.floor(hp.v)+1);el.textContent=(k<10?"0":"")+k+"/${String(N).padStart(2, "0")}"}},0);})();`, `tl.to("#hud",{opacity:0,duration:.4},${r3(Math.max(0, duration - .5))});`] : [];

  const blocks = treatment.blocks ? Array(7).fill("<i></i>").join("") : "";
  const fontsHref = `https://fonts.googleapis.com/css2?family=${S.fonts}&display=block`;
  const audioTag = opts.audioSrc ? `<audio id="score" data-start="0" data-duration="${r3(duration)}" data-track-index="9" data-volume="1" src="${esc(opts.audioSrc)}"></audio>` : "";

  const css = buildCSS({ W, H, P, S, u, portrait, grain: treatment.grain, motion, treatment });
  const doc = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=${W}, height=${H}">
<title>${esc(brief.name || "Snapmy.site")} — launch film</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${fontsHref}">
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>${css}</style>
</head>
<body>
<div id="root" data-composition-id="cue" data-start="0" data-duration="${r3(duration)}" data-width="${W}" data-height="${H}" data-fps="30">
<div id="bgl" class="clip" data-start="0" data-duration="${r3(duration)}" data-track-index="0"></div>
${html}
 <div id="fx" class="clip" data-start="0" data-duration="${r3(duration)}" data-track-index="6"><div id="fx-blocks">${blocks}</div><div id="fx-glitch"></div><div id="fx-flash"></div><div id="fx-grain"></div><div id="fx-vig"></div></div>
${hud}
${audioTag}
</div>
<script>
(function(){
  var tl = gsap.timeline({ paused: true });
  ${code.join("\n  ")}
  ${hudCode.join("\n  ")}
  ${grainSteps.join("")}
  tl.set({}, {}, ${r3(duration)});
  window.__timelines = window.__timelines || {};
  window.__timelines["cue"] = tl;
})();
</script>
</body>
</html>`;
  return { html: doc, duration, width: W, height: H, cues, scenes: sceneMeta, style: styleKey, palette: P, bpm: 160, soundProfile: motion.soundProfile, fingerprint, checks };
}

function continuousCamera(scenes, timings, plan, W, H, rand) {
  const m = plan.motion || plan.direction || {};
  const family = ["push", "track", "orbit", "match", "reveal", "static"].includes(m.camera) ? m.camera : "push";
  const intensity = clamp(Number.isFinite(Number(m.intensity)) ? Number(m.intensity) : 0.4, 0, 1);
  const amp = W * (0.012 + intensity * 0.03);
  const shape = { push: [0.35, 0.1, 0.018, 0.4], track: [1, 0.15, 0.006, 0.8], orbit: [0.7, 0.2, 0.01, 2.2], match: [0.8, 0.25, 0.012, 1], reveal: [0.25, 0.35, 0.014, 0.5], static: [0.12, 0.06, 0.004, 0.2] }[family];
  const keys = [{ x: 0, y: 0, s: 1, r: 0 }];
  const dirs = [];
  let dir = rand.next() > 0.5 ? 1 : -1;
  scenes.forEach((sc, i) => {
    const product = PRODUCT_SCENE_TYPES.has(sc.type);
    // Direction changes only between story blocks, so neighbouring shots share momentum.
    if (i > 0 && product !== PRODUCT_SCENE_TYPES.has(scenes[i - 1].type) && rand.next() > 0.45) dir *= -1;
    const quiet = timings[i].quiet || timings[i].hold > 1.5;
    const speed = (quiet ? 0.35 : 1) * (product ? 1.2 : 0.7);
    const prev = keys[keys.length - 1];
    keys.push({ x: prev.x + dir * amp * shape[0] * speed, y: Math.sin(i * 1.3) * amp * shape[1], s: 1 + ((i % 3) + 1) * shape[2] * (product ? 1.4 : 0.6), r: dir * shape[3] * (0.4 + intensity) });
    dirs.push(dir);
  });
  const code = [`tl.set("#root",{"--cx":0,"--cy":0,"--cs":1,"--cr":0},0);`];
  scenes.forEach((_, i) => {
    const k = keys[i + 1];
    code.push(`tl.to("#root",{"--cx":${r3(k.x)},"--cy":${r3(k.y)},"--cs":${r3(k.s)},"--cr":${r3(k.r)},duration:${r3(Math.max(0.1, timings[i].span))},ease:"none"},${r3(timings[i].t)});`);
  });
  return { code, dirAt: (i) => -(dirs[i] || 1), family, intensity };
}

function sceneLabel(sc) {
  return String(sc.word || (sc.words || []).join(" ") || sc.text || sc.title || sc.caption || sc.value || sc.type || "").slice(0, 40);
}

function buildCSS({ W, H, P, S, u, portrait, grain, motion = {}, treatment = {} }) {
  const noise = "data:image/svg+xml;utf8," + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .5 0 0 0 0 .5 0 0 0 0 .5 0 0 0 1.4 0'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`);
  const scan = "repeating-linear-gradient(0deg, rgba(255,0,90,.5) 0 3px, transparent 3px 11px, rgba(0,220,255,.45) 11px 13px, transparent 13px 29px)";
  const effect = treatment.effect || "clean";
  const stageFilter = effect === "soft" || effect === "paper" ? "saturate(.92) contrast(.98)" : effect === "chromatic" ? "saturate(1.12) contrast(1.04)" : "none";
  const stageOverlay = treatment.scan ? `background-image:${scan};opacity:.035;` : effect === "glow" ? `background:radial-gradient(circle at 65% 42%, ${P.field}22, transparent 48%);opacity:.35;` : effect === "glass" ? `background:linear-gradient(115deg, transparent 35%, rgba(255,255,255,.12) 50%, transparent 65%);opacity:.28;` : "opacity:0;";
  const chromeH = treatment.chrome ? Math.round(u * 4.4) : 0;
  return `
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px;overflow:hidden;background:${P.bg}}
#root{position:relative;width:100%;height:100%;overflow:hidden;color:${P.fg};font-family:"${S.body}",system-ui,sans-serif;
  --accent:${P.accent};--field:${P.field};--onAccent:${P.onAccent};--fg:${P.fg};--bg:${P.bg};--surface:${P.surface};--muted:${P.muted};--second:${P.second}}
#bgl{position:absolute;inset:0;background:radial-gradient(120% 90% at 20% 0%, ${S.dark ? mix(P.bg, P.field, 0.16) : mix(P.bg, P.field, 0.1)} 0%, ${P.bg} 60%)}
.scene{position:absolute;inset:0;overflow:hidden}
 .sc{position:absolute;inset:0;will-change:transform,filter}
 .motion-stage{position:absolute;inset:0;will-change:transform;transform-origin:50% 50%}
.window-group{position:absolute;inset:0;overflow:hidden}
.window-rig{position:absolute;inset:0;display:grid;place-items:center;perspective:${Math.round(W * 1.4)}px;transform-style:preserve-3d;will-change:transform}
.clip.scene,.window-group{perspective:2400px}
.clip.scene>.sc,.window-group>.window-rig{translate:calc(var(--cx,0)*-1px) calc(var(--cy,0)*1px);scale:var(--cs,1);rotate:y calc(var(--cr,0)*1deg)}
.depth-plane{position:absolute;inset:-12%;background-size:cover;background-position:50% 0;filter:blur(${Math.round(u * 2.2)}px) saturate(1.1);opacity:.26;translate:calc(var(--cx,0)*.55px) calc(var(--cy,0)*-.4px);scale:calc(1.08 + (var(--cs,1) - 1) * .5);pointer-events:none}
.window-rig .browser{transform-style:preserve-3d}
 .window-stage{position:absolute;left:0;right:0;top:${chromeH}px;bottom:0;overflow:hidden;background:var(--surface);transform-style:preserve-3d;filter:${stageFilter}}
.window-stage:after{content:"";position:absolute;inset:0;pointer-events:none;${stageOverlay}}
.window-camera,.window-world{position:absolute;inset:0;transform-style:preserve-3d;will-change:transform}
.window-shot{position:absolute;inset:0;transform:translate3d(var(--wx),var(--wy),var(--wz)) scale(var(--ws));transform-origin:50% 50%;transform-style:preserve-3d;will-change:transform,opacity}
.window-shot .sc{overflow:hidden}
.window-page{position:absolute;inset:0;overflow:hidden;background:var(--surface);border-radius:${Math.round(u * 0.6)}px}
.window-page .shot{top:0}
.window-page .viewport{top:0}
 .window-count{position:absolute;right:${Math.round(u * 1.8)}px;top:${Math.max(4, Math.round(u * .9))}px;font-size:${Math.round(u * 1.35)}px;color:var(--muted);opacity:${treatment.chrome ? .65 : .45};z-index:2}
.ground{position:absolute;inset:0;background:radial-gradient(110% 80% at 70% 110%, ${mix(P.bg, P.field, S.dark ? 0.2 : 0.12)} 0%, ${P.bg} 58%)}
.cam{position:absolute;inset:0;display:flex;flex-direction:column;padding:0 ${Math.round(W * (portrait ? 0.08 : 0.075))}px}
.center{align-items:center;justify-content:center;text-align:center}
.left{align-items:flex-start;justify-content:center;text-align:left}
.stack{align-items:flex-start;justify-content:center;gap:${Math.round(u * 0.2)}px}
.persp{perspective:${Math.round(W * 1.4)}px}
.window-cam{padding:0 ${Math.round(W * (portrait ? 0.05 : 0.055))}px}
.disp{font-family:"${S.display}",serif;font-weight:${S.dw};letter-spacing:${S.track}em;line-height:.92;${S.upper ? "text-transform:uppercase;" : ""}}
.mono{font-family:"${S.mono}",monospace}
.tiny{font-size:${Math.round(u * 1.9)}px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:${Math.round(u * 2)}px;opacity:.7}
.mask{overflow:hidden;padding:0 .04em .06em;margin-bottom:-.06em}
.mask>*{display:block}
.ch{display:inline-block}
.rule{width:${Math.round(u * 14)}px;height:${Math.max(3, Math.round(u * 0.5))}px;background:var(--accent);margin-top:${Math.round(u * 3)}px;transform-origin:0 50%}
.kick{display:flex;align-items:center;gap:${Math.round(u)}px;font-family:"${S.mono}",monospace;font-size:${Math.round(u * 2)}px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted);margin-bottom:${Math.round(u * 2.4)}px}
.kick .dot{width:${Math.round(u * 1.1)}px;height:${Math.round(u * 1.1)}px;border-radius:50%;background:var(--accent)}
.hl{position:relative;display:inline-block;padding:0 .08em}
.hl b{position:absolute;left:0;right:0;bottom:.08em;height:.36em;background:var(--accent);opacity:${S.dark ? 0.85 : 0.9};transform-origin:0 50%;z-index:0}
.hl span{position:relative;z-index:1;${S.dark ? "" : "color:var(--fg)"}}
.field{position:absolute;inset:0;background:var(--field)}
.fw{line-height:.85}
.browser{position:relative;border-radius:${Math.round(u * 1.6)}px;overflow:hidden;background:var(--surface);box-shadow:0 ${Math.round(u * 4)}px ${Math.round(u * 10)}px rgba(0,0,0,${S.dark ? 0.55 : 0.22}),0 0 0 1px rgba(${S.dark ? "255,255,255" : "0,0,0"},.08);transform-style:preserve-3d}
.chrome{height:${Math.round(u * 4.4)}px;display:flex;align-items:center;gap:${Math.round(u * 0.8)}px;padding:0 ${Math.round(u * 1.8)}px;background:${S.dark ? "#1b1b1d" : "#ecebe7"};border-bottom:1px solid rgba(${S.dark ? "255,255,255" : "0,0,0"},.07)}
.chrome i{width:${Math.round(u * 1.2)}px;height:${Math.round(u * 1.2)}px;border-radius:50%;background:${S.dark ? "#3a3a3d" : "#c9c6bf"}}
.chrome .url{margin-left:${Math.round(u * 2)}px;font-size:${Math.round(u * 1.6)}px;color:var(--muted);background:${S.dark ? "#262629" : "#fff"};padding:${Math.round(u * 0.5)}px ${Math.round(u * 2)}px;border-radius:99px;flex:0 1 auto}
 .shot{position:absolute;left:0;right:0;top:${chromeH}px;bottom:0;background-size:cover;background-position:50% 50%;background-repeat:no-repeat}
.ghost{background:linear-gradient(135deg,var(--surface),${mix(P.surface, P.field, 0.25)});padding:${Math.round(u * 5)}px;display:flex;flex-direction:column;gap:${Math.round(u * 2)}px}
.ghost div{border-radius:${Math.round(u)}px;background:rgba(${S.dark ? "255,255,255" : "0,0,0"},.08)}
.gh1{height:18%;width:60%;background:var(--accent)!important;opacity:.8}.gh2{height:10%;width:85%}.gh3{height:30%;width:100%}
.glare{position:absolute;inset:0;background:linear-gradient(105deg,transparent 35%,rgba(255,255,255,.22) 50%,transparent 65%);pointer-events:none}
 .target-mark{position:absolute;border:1px solid var(--accent);border-radius:${Math.round(u * .7)}px;box-shadow:0 0 ${Math.round(u * 1.4)}px ${P.field}55;opacity:0;pointer-events:none;transform-origin:50% 50%}
 .target-mark:after{content:"";position:absolute;right:${Math.round(u * .8)}px;top:${Math.round(u * .8)}px;width:${Math.max(3, Math.round(u * .9))}px;height:${Math.max(3, Math.round(u * .9))}px;border-radius:50%;background:var(--accent)}
 .cap{margin-top:${Math.round(u * 3.5)}px}
 .viewport{position:absolute;left:0;right:0;top:${chromeH}px;bottom:0;overflow:hidden}
.tall{display:block;width:100%;height:auto}
.tallghost{position:relative!important;top:0!important;height:260%!important}
.feat{flex-direction:${portrait ? "column" : "row"};align-items:${portrait ? "flex-start" : "center"};justify-content:${portrait ? "center" : "flex-start"};gap:${Math.round(u * 4)}px}
.num{color:transparent;-webkit-text-stroke:${Math.max(2, Math.round(u * 0.25))}px var(--accent);line-height:.8;${S.upper ? "" : ""}}
.ftext{display:flex;flex-direction:column;align-items:flex-start}
.sub{margin-top:${Math.round(u * 2.2)}px;color:var(--muted);max-width:${Math.round(W * 0.5)}px;line-height:1.35;font-weight:500}
.chips{display:flex;flex-direction:column;gap:${Math.round(u * 2.2)}px;align-items:center}
.chip{display:flex;align-items:center;gap:${Math.round(u * 1.6)}px;padding:${Math.round(u * 1.6)}px ${Math.round(u * 3.2)}px;border-radius:99px;background:var(--surface);border:1px solid rgba(${S.dark ? "255,255,255" : "0,0,0"},.1);font-family:"${S.display}",sans-serif;font-weight:${Math.min(S.dw, 700)};letter-spacing:-.02em;${S.upper ? "text-transform:uppercase;" : ""}box-shadow:0 ${Math.round(u)}px ${Math.round(u * 4)}px rgba(0,0,0,${S.dark ? 0.4 : 0.1})}
.chip:nth-child(2){background:var(--field);color:var(--onAccent);border-color:transparent}
.tick{display:inline-grid;place-items:center;width:1.2em;height:1.2em;border-radius:50%;background:var(--accent);color:var(--onAccent);font-size:.6em}
.chip:nth-child(2) .tick{background:var(--onAccent);color:var(--field)}
.statv{display:flex;align-items:baseline;line-height:.9;font-variant-numeric:tabular-nums}
.statv .acc{color:var(--accent)}
.statl{margin-top:${Math.round(u * 2)}px;font-family:"${S.mono}",monospace;letter-spacing:.08em;color:var(--fg);opacity:.72}
.bar{width:${Math.round(W * (portrait ? 0.6 : 0.36))}px;height:${Math.max(3, Math.round(u * 0.45))}px;background:rgba(${S.dark ? "255,255,255" : "0,0,0"},.1);margin-top:${Math.round(u * 3)}px;border-radius:9px;overflow:hidden}
.bar i{display:block;height:100%;background:var(--accent);transform-origin:0 50%}
.quote .qm{font-size:${Math.round(u * 22)}px;line-height:.6;color:var(--accent);height:${Math.round(u * 10)}px}
.qt{font-family:"${S.display}",serif;font-weight:${S.dw === 400 ? 400 : 600};letter-spacing:-.02em;line-height:1.08}
.who{margin-top:${Math.round(u * 3)}px;font-size:${Math.round(u * 2)}px;letter-spacing:.12em;text-transform:uppercase}
.logos{display:grid;gap:${Math.round(u * 2)}px ${Math.round(u * 5)}px;margin-top:${Math.round(u * 2)}px}
.lg{font-family:"${S.display}",sans-serif;font-weight:${Math.min(S.dw, 700)};letter-spacing:-.02em;opacity:.9;padding:${Math.round(u * 1.5)}px ${Math.round(u * 2)}px;border-top:1px solid rgba(${S.dark ? "255,255,255" : "0,0,0"},.14);text-align:left;min-width:${Math.round(u * 20)}px}
.mq{justify-content:center;gap:${Math.round(u * 1)}px;padding:0;left:-20%;right:-20%}
.mrow{display:flex;white-space:nowrap;gap:.3em;font-family:"${S.display}",sans-serif;font-weight:${S.dw};letter-spacing:${S.track}em;${S.upper ? "text-transform:uppercase;" : ""}line-height:1}
.mrow .outline{color:transparent;-webkit-text-stroke:${Math.max(2, Math.round(u * 0.2))}px var(--fg);opacity:.5}
.mrow .solid{color:var(--accent)}
.mrow .star{color:var(--accent);font-size:.5em;align-self:center}
.splitw{flex-direction:row;align-items:center;justify-content:space-between;gap:${Math.round(u * 4)}px}
.splitw.col{flex-direction:column;justify-content:center}
.stext{flex:0 0 ${portrait ? "auto" : "40%"}}
.sframe{position:relative;flex:1;height:${portrait ? "46%" : "72%"};width:${portrait ? "100%" : "auto"};border-radius:${Math.round(u * 2.4)}px;overflow:hidden;box-shadow:0 ${Math.round(u * 3)}px ${Math.round(u * 8)}px rgba(0,0,0,.35)}
.sframe .shot{top:0}
.btnwrap{display:flex;flex-direction:column;align-items:center;gap:${Math.round(u * 1.6)}px;margin-top:${Math.round(u * 4)}px;position:relative}
.btn{position:relative;overflow:visible;display:inline-flex;align-items:center;gap:.5em;padding:.7em 1.5em;border-radius:99px;background:var(--field);color:var(--onAccent);font-weight:700;letter-spacing:-.01em;box-shadow:0 ${Math.round(u)}px ${Math.round(u * 4)}px ${P.field}66}
.rip{position:absolute;left:50%;top:50%;width:${Math.round(u * 8)}px;height:${Math.round(u * 8)}px;margin:-${Math.round(u * 4)}px 0 0 -${Math.round(u * 4)}px;border-radius:50%;border:${Math.max(2, Math.round(u * 0.3))}px solid var(--accent);opacity:0}
.url2{color:var(--muted);letter-spacing:.08em}
.cursor{position:absolute;left:50%;top:${portrait ? "58%" : "66%"};filter:drop-shadow(0 4px 8px rgba(0,0,0,.4))}
.lockup{display:flex;align-items:center;gap:${Math.round(u * 2.6)}px}
.mark{display:grid;place-items:center;border-radius:28%;background:var(--field);color:var(--onAccent);font-family:"${S.display}",sans-serif;font-weight:800}
.logo{object-fit:contain}
.plate{display:grid;place-items:center;border-radius:24%;background:#fff;padding:14%;box-shadow:0 ${Math.round(u)}px ${Math.round(u * 4)}px rgba(0,0,0,.25)}
.plate img{width:100%;height:100%;object-fit:contain}
.nm{line-height:1}
.tagl{margin-top:${Math.round(u * 2.4)}px;color:var(--muted);max-width:${Math.round(W * 0.7)}px;line-height:1.3;font-weight:500}
.sweep{position:absolute;inset:0;background:linear-gradient(100deg,transparent 40%,${S.dark ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.5)"} 50%,transparent 60%);pointer-events:none}
#fx{position:absolute;inset:0;pointer-events:none;z-index:500}
#fx-blocks{position:absolute;inset:0;display:flex}
#fx-blocks i{flex:1;background:var(--field);transform:scaleY(0)}
#fx-blocks i:nth-child(even){background:${mix(P.field, S.dark ? "#000000" : "#ffffff", 0.2)}}
#fx-glitch{position:absolute;inset:0;background:${scan};mix-blend-mode:screen;opacity:0}
#fx-flash{position:absolute;inset:0;background:#fff;opacity:0}
 #fx-grain{position:absolute;inset:-50px;background-image:url("${noise}");opacity:${grain};mix-blend-mode:${S.dark ? "overlay" : "multiply"}}
 #fx-vig{position:absolute;inset:0;background:radial-gradient(ellipse at center, transparent 58%, rgba(0,0,0,${treatment.vignette || 0}) 100%)}
#hud{position:absolute;left:0;right:0;top:0;z-index:600;pointer-events:none}
.hud-in{display:flex;align-items:center;gap:${Math.round(u * 1.2)}px;padding:${Math.round(u * 3)}px ${Math.round(W * 0.04)}px 0;font-size:${Math.round(u * 1.5)}px;letter-spacing:.2em;color:${P.fg};opacity:.55}
.hud-in .sp{flex:1}
.rec{width:${Math.round(u * 0.9)}px;height:${Math.round(u * 0.9)}px;border-radius:50%;background:var(--accent)}
.hud-bar{position:absolute;left:${Math.round(W * 0.04)}px;right:${Math.round(W * 0.04)}px;top:${Math.round(u * 6.2)}px;height:2px;background:rgba(${S.dark ? "255,255,255" : "0,0,0"},.1)}
.hud-bar i{display:block;height:100%;background:var(--accent);transform-origin:0 50%}
.rig-cam{perspective:${Math.round(W * 1.4)}px}
.fly-rig{position:absolute;left:50%;top:50%;transform-style:preserve-3d;will-change:transform,opacity}
.fly-rig .browser{position:absolute;left:0;top:0;transform-origin:50% 50%;transform-style:preserve-3d;translate:-50% -50%}
.scrim{position:absolute;inset:0;background:radial-gradient(80% 70% at 50% 50%, transparent 20%, ${S.dark ? "rgba(0,0,0,.72)" : "rgba(0,0,0,.42)"} 100%);pointer-events:none;opacity:0}
.depth-cam{perspective:${Math.round(W * 1.4)}px;transform-style:preserve-3d}
.depth-bg{position:absolute;inset:${Math.round(u * 3)}px;border-radius:${Math.round(u * 2)}px;overflow:hidden;box-shadow:0 ${Math.round(u * 4)}px ${Math.round(u * 12)}px rgba(0,0,0,${S.dark ? 0.5 : 0.24})}
.depth-bg .shot{top:0!important}
.depth-fg{position:absolute;inset:-2% -6%;display:grid;place-items:center;background:linear-gradient(0deg, ${P.bg} 62%, ${mix(P.bg, P.field, S.dark ? 0.22 : 0.14)} 100%);will-change:transform,clip-path}
.depth-type{color:var(--fg);text-align:center;padding:0 ${Math.round(W * 0.06)}px;line-height:.96;text-shadow:0 ${Math.round(u * 0.4)}px ${Math.round(u * 2)}px ${S.dark ? "rgba(0,0,0,.5)" : "rgba(255,255,255,.4)"}}
.depth-rule{position:absolute;left:50%;top:64%;width:${Math.round(u * 16)}px;height:${Math.max(3, Math.round(u * 0.5))}px;margin-left:-${Math.round(u * 8)}px;background:var(--accent);transform-origin:50% 50%}
.match-wrap{perspective:${Math.round(W * 1.4)}px}
.match-stage{position:absolute;left:${Math.round(W * 0.06)}px;right:${Math.round(W * 0.06)}px;top:${Math.round(H * 0.08)}px;bottom:${Math.round(H * 0.08)}px;border-radius:${Math.round(u * 2)}px;overflow:hidden;transform-style:preserve-3d;will-change:transform;box-shadow:0 ${Math.round(u * 5)}px ${Math.round(u * 14)}px rgba(0,0,0,${S.dark ? 0.55 : 0.28})}
.match-layer{position:absolute;inset:0;overflow:hidden;will-change:transform,clip-path}
.match-layer .shot{top:0!important}
.match-layer.match-in{z-index:2;background:${P.bg}}
.match-flash{position:absolute;inset:0;background:var(--accent);opacity:0;pointer-events:none;mix-blend-mode:screen}
.track-cam{padding:0}
.track-rig{position:absolute;inset:0;overflow:hidden;background:${S.dark ? mix(P.bg, "#000000", 0.12) : mix(P.bg, P.field, 0.08)}}
.track-stage{position:absolute;top:${Math.round(H * 0.14)}px;bottom:${Math.round(H * 0.14)}px;left:${Math.round(-W * 0.05)}px;width:${Math.round(W * 1.5)}px;border-radius:${Math.round(u * 1.6)}px;overflow:hidden;transform-style:preserve-3d;will-change:transform;box-shadow:0 ${Math.round(u * 4)}px ${Math.round(u * 12)}px rgba(0,0,0,${S.dark ? 0.5 : 0.26})}
.track-browser{position:absolute;inset:0;border-radius:0;box-shadow:none;overflow:hidden;background:var(--surface)}
.track-band{position:absolute;inset:0;overflow:hidden}
.track-img{display:block;width:128%;height:100%;object-fit:cover}
.track-ghost{position:absolute;inset:0;width:128%;height:100%}
.track-para{position:absolute;left:0;right:0;top:${Math.round(H * 0.06)}px;display:flex;justify-content:center;pointer-events:none;will-change:transform}
.track-chip{display:inline-flex;align-items:center;gap:${Math.round(u)}px;padding:${Math.round(u * 1.1)}px ${Math.round(u * 2.6)}px;border-radius:99px;background:var(--surface);border:1px solid rgba(${S.dark ? "255,255,255" : "0,0,0"},.12);font-family:"${S.mono}",monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--fg);box-shadow:0 ${Math.round(u)}px ${Math.round(u * 4)}px rgba(0,0,0,${S.dark ? 0.4 : 0.12})}
.track-chip b{width:${Math.round(u * 0.9)}px;height:${Math.round(u * 0.9)}px;border-radius:50%;background:var(--accent)}
.track-cap{position:absolute;left:0;right:0;bottom:${Math.round(u * 2)}px;text-align:center;color:var(--fg);text-shadow:0 ${Math.round(u * 0.4)}px ${Math.round(u * 2)}px ${S.dark ? "rgba(0,0,0,.6)" : "rgba(255,255,255,.6)"}}
.track-glare{position:absolute;inset:0;background:linear-gradient(100deg,transparent 42%,rgba(255,255,255,.14) 50%,transparent 58%);pointer-events:none}
.rig-cursor{z-index:5}
`;
}
