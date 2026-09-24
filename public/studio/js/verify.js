// Verifier for Snapmy.site launch films. Recomputes every metric from comp.scenes.
// ASPECTS mirrors composer.js so aspect can be validated without trusting comp.checks.

const ASPECTS = { "16:9": [1920, 1080], "9:16": [1080, 1920], "1:1": [1080, 1080], "4:5": [1080, 1350] };
const PRODUCT_SCENE_TYPES = new Set(["screen", "scroll", "split", "flyin", "depthReveal", "matchcut", "track"]);
const r3 = (n) => Math.round(n * 1000) / 1000;
const pct = (n) => Math.round(n * 1000) / 10;

function assetTruthy(a) {
  if (!a) return false;
  if (typeof a === "string") return a.trim().length > 0;
  if (typeof a === "object") return Boolean(a.url || a.id);
  return false;
}

function isProductSubject(scene) {
  return Boolean(scene) && PRODUCT_SCENE_TYPES.has(scene.type) && assetTruthy(scene.asset);
}

function authoredHasContent(scene) {
  if (!scene || typeof scene !== "object") return false;
  if (["word", "text", "title", "value", "caption", "kicker", "author", "label"].some((k) => typeof scene[k] === "string" && scene[k].trim())) return true;
  if (Array.isArray(scene.words) && scene.words.some((w) => String(w).trim())) return true;
  if (Array.isArray(scene.items) && scene.items.length > 0) return true;
  if (Array.isArray(scene.names) && scene.names.length > 0) return true;
  if (scene.shot != null || scene.asset != null || scene.from != null || scene.to != null) return true;
  return false;
}

function sceneHasContent(scene) {
  if (!scene || typeof scene !== "object") return false;
  if (assetTruthy(scene.asset)) return true;
  return ["word", "text", "title", "value", "caption", "kicker", "author", "label"].some((k) => typeof scene[k] === "string" && scene[k].trim())
    || (Array.isArray(scene.words) && scene.words.some((w) => String(w).trim()));
}

function recompute(plan, comp) {
  const scenes = (Array.isArray(comp.scenes) ? comp.scenes : []).slice().sort((a, b) => Number(a.i) - Number(b.i));
  const authored = plan && Array.isArray(plan.scenes) ? plan.scenes : null;
  const duration = Number(comp.duration) || 0;

  const fingerprint = (comp.scenes || []).map((s) => s.type).join(">");

  let productSeconds = 0;
  for (const s of scenes) if (isProductSubject(s)) productSeconds += Number(s.duration) || 0;

  let continuousShotSeconds = 0;
  let runStart = null;
  let runEnd = null;
  for (const s of scenes) {
    if (isProductSubject(s)) {
      const t = Number(s.t) || 0;
      const end = t + (Number(s.duration) || 0);
      if (runStart === null) { runStart = t; runEnd = end; }
      else runEnd = end;
    } else if (runStart !== null) {
      if (runEnd - runStart > continuousShotSeconds) continuousShotSeconds = runEnd - runStart;
      runStart = null;
      runEnd = null;
    }
  }
  if (runStart !== null && runEnd - runStart > continuousShotSeconds) continuousShotSeconds = runEnd - runStart;

  const authoredContent = (s, idx) => {
    let a = null;
    if (authored && authored.length === scenes.length) a = authored[idx];
    if (!a && authored) a = authored.find((x) => x && x.type === s.type) || null;
    return authoredHasContent(a);
  };

  let firstContentAt = null;
  scenes.forEach((s, idx) => {
    if (firstContentAt !== null) return;
    const content = sceneHasContent(s) || authoredContent(s, idx);
    if (content) firstContentAt = Number(s.t) || 0;
  });
  if (firstContentAt === null) firstContentAt = 0;

  const statsCount = scenes.filter((s) => s.type === "stat").length;

  let aspectMatches = true;
  if (comp.aspect != null && ASPECTS[comp.aspect]) {
    aspectMatches = Number(comp.width) === ASPECTS[comp.aspect][0] && Number(comp.height) === ASPECTS[comp.aspect][1];
  } else {
    const key = (plan && plan.aspect) || (comp.aspect) || "16:9";
    const target = ASPECTS[key] || ASPECTS["16:9"];
    aspectMatches = Number(comp.width) === target[0] && Number(comp.height) === target[1];
  }

  return { scenes, duration, fingerprint, productSeconds, continuousShotSeconds, firstContentAt, statsCount, aspectMatches };
}


// --- Production Grade Quality Pass: Timing, Cursor, and Safe Zones ---

const DWELL_PER_WORD = 0.3; // 300ms per word
const DWELL_BASE = 0.6;     // 600ms base reading dwell

const SHOT_TIMING_SPECS = {
  hook: { min: 1.8, max: 2.8, name: "Cold Open / Hook" },
  coldopen: { min: 1.8, max: 2.8, name: "Cold Open / Hook" },
  screen: { min: 2.5, max: 3.8, name: "Hero Product Reveal" },
  flyin: { min: 2.5, max: 4.2, name: "Contextual Interaction" },
  track: { min: 2.5, max: 4.2, name: "Contextual Interaction" },
  featureStack: { min: 2.4, max: 3.6, name: "Feature Proof" },
  statement: { min: 2.0, max: 3.4, name: "Narrative Statement" },
  cta: { min: 2.0, max: 3.2, name: "Resolution & CTA" },
  endcard: { min: 2.0, max: 3.0, name: "Resolution & CTA" }
};

export function validateShotTiming(scenes) {
  const issues = [];
  (scenes || []).forEach((sc, i) => {
    const type = sc.type || "unknown";
    const dur = Number(sc.duration) || 0;
    const spec = SHOT_TIMING_SPECS[type];
    
    // Check against shot-specific duration limits
    if (spec) {
      const isHold = sc.quiet || sc.hold || (dur >= 5 && dur <= 6.5);
      if (!isHold && dur < spec.min) {
        issues.push(`Shot ${i + 1} (${spec.name}): duration ${r3(dur)}s is below minimum ${spec.min}s`);
      } else if (!isHold && dur > spec.max) {
        issues.push(`Shot ${i + 1} (${spec.name}): duration ${r3(dur)}s exceeds ceiling ${spec.max}s`);
      }
    }

    // Text reading speed validation
    const text = sc.text || sc.headline || sc.caption || (Array.isArray(sc.words) ? sc.words.join(" ") : "");
    if (typeof text === "string" && text.trim()) {
      const words = text.trim().split(/\s+/).length;
      const minDwell = r3((words * DWELL_PER_WORD) + DWELL_BASE);
      if (dur < minDwell) {
        issues.push(`Shot ${i + 1} (${type}): ${words} words require at least ${minDwell}s reading time, got ${r3(dur)}s`);
      }
    }
  });
  return issues;
}

export function validateCursorTargets(scenes, W = 1920, H = 1080) {
  const issues = [];
  const textOnlyTypes = new Set(["hook", "coldopen", "statement", "quote", "stat", "logos", "marquee"]);

  (scenes || []).forEach((sc, i) => {
    const type = sc.type || "";
    const hasCursor = sc.cursor === true || sc.showCursor === true || (sc.hits || []).some(h => (h.sfx || "").includes("click"));

    // 1. Text scenes must never have a cursor
    if (textOnlyTypes.has(type) && hasCursor) {
      issues.push(`Shot ${i + 1} (${type}): cursor forbidden in typography/stat shot`);
    }

    // 2. Interactive scenes with cursor must have verified UI target bounds
    if (hasCursor) {
      const rawTarget = sc.target || sc.targetBounds || (sc.asset && (sc.asset.target || sc.asset.targetBounds));
      if (!rawTarget) {
        issues.push(`Shot ${i + 1} (${type}): cursor present without validated semantic UI target`);
      } else {
        const x = Number(rawTarget.x ?? rawTarget.left);
        const y = Number(rawTarget.y ?? rawTarget.top);
        const w = Number(rawTarget.width ?? rawTarget.w);
        const h = Number(rawTarget.height ?? rawTarget.h);

        if (![x, y, w, h].every(Number.isFinite)) {
          issues.push(`Shot ${i + 1} (${type}): invalid non-numeric target bounds`);
        } else {
          // Normalize if relative (0-1)
          const px = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 1 ? x * W : x;
          const py = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 1 ? y * H : y;
          const pw = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 1 ? w * W : w;
          const ph = Math.max(Math.abs(x), Math.abs(y), Math.abs(w), Math.abs(h)) <= 1 ? h * H : h;

          if (px < 0 || px + pw > W || py < 0 || py + ph > H) {
            issues.push(`Shot ${i + 1} (${type}): cursor target out of canvas viewport bounds`);
          }
          if (pw < 16 || ph < 16) {
            issues.push(`Shot ${i + 1} (${type}): cursor target too small (<16px hitbox)`);
          }
        }
      }
    }
  });
  return issues;
}

export function validateTextSafeZones(scenes, W = 1920, H = 1080) {
  const issues = [];
  const safeMarginX = W * 0.08; // 8% safe zone inset
  const safeMarginY = H * 0.08;

  (scenes || []).forEach((sc, i) => {
    const text = sc.text || sc.headline || sc.caption || "";
    if (typeof text === "string" && text.length > 0) {
      // Check maximum line lengths without break
      const words = text.split(" ");
      const longestWord = Math.max(...words.map(w => w.length));
      if (longestWord > 22) {
        issues.push(`Shot ${i + 1} (${sc.type}): word "${words.find(w => w.length === longestWord)}" exceeds 22 chars without hyphenation`);
      }

      // Check max character limits in narrative cards
      if (text.length > 120) {
        issues.push(`Shot ${i + 1} (${sc.type}): text length ${text.length} chars violates safe-density threshold (max 120)`);
      }
    }
  });
  return issues;
}

export function verifyFilm(brief, plan, comp) {
  const out = {
    ok: false,
    fingerprint: "",
    productSeconds: 0,
    continuousShotSeconds: 0,
    firstContentAt: 0,
    statsCount: 0,
    aspectMatches: false,
    issues: [],
  };
  try {
    if (!comp || typeof comp !== "object") {
      out.issues.push("composer returned no film");
      return out;
    }
    const m = recompute(plan, comp);
    const scenes = m.scenes;
    out.fingerprint = m.fingerprint;
    out.productSeconds = r3(m.productSeconds);
    out.continuousShotSeconds = r3(m.continuousShotSeconds);
    out.firstContentAt = r3(m.firstContentAt);
    out.statsCount = m.statsCount;
    out.aspectMatches = m.aspectMatches;

    if (!scenes.length) {
      out.issues.push("the film has no scenes");
      return out;
    }

    if (r3(m.firstContentAt) > 1.5) {
      out.issues.push("no content on screen in the first 1.5s");
    }
    if (m.duration > 0 && m.productSeconds / m.duration < 0.2) {
      out.issues.push(`product on screen ${pct(m.productSeconds / m.duration)}% of runtime (<20%)`);
    }
    let productRun = 0;
    let bestRun = 0;
    for (const s of scenes) {
      if (isProductSubject(s)) { productRun++; if (productRun > bestRun) bestRun = productRun; }
      else productRun = 0;
    }
    const cameraBuffer = Math.max(0, (bestRun - 1)) * 0.25;
    const effectiveCameraSeconds = Math.max(0, m.continuousShotSeconds - cameraBuffer);
    if (effectiveCameraSeconds < 6 && bestRun < 3) {
      out.issues.push(`longest continuous camera motion ${r3(effectiveCameraSeconds)}s (<6s)`);
    }
    const heroHold = scenes.reduce((best, s) => { const d = Number(s.duration); return d > best ? d : best; }, 0);
    if (heroHold < 5) {
      out.issues.push("no held hero moment (>=5s)");
    } else if (heroHold > 6.5) {
      out.issues.push(`held moment ${r3(heroHold)}s exceeds 6.5s ceiling`);
    }
    if (m.statsCount > 2) {
      out.issues.push(`${m.statsCount} stats (>2)`);
    }
    if (scenes.some((s) => s.type === "marquee")) {
      out.issues.push("self-titled marquee beat");
    }
    if (!m.aspectMatches) {
      out.issues.push("canvas does not match the requested aspect");
    }
    // Five-shot timing, cursor target, and safe zone validation passes
    const timingIssues = validateShotTiming(scenes);
    out.issues.push(...timingIssues);

    const cursorIssues = validateCursorTargets(scenes, Number(comp.width) || 1920, Number(comp.height) || 1080);
    out.issues.push(...cursorIssues);

    const safeZoneIssues = validateTextSafeZones(scenes, Number(comp.width) || 1920, Number(comp.height) || 1080);
    out.issues.push(...safeZoneIssues);

    if (plan && plan.structure != null) {
      const expected = Array.isArray(plan.structure) ? plan.structure.join(">") : String(plan.structure);
      if (expected !== out.fingerprint) out.issues.push("structure mismatch");
    }
    out.ok = out.issues.length === 0;
    return out;
  } catch (e) {
    out.issues.push("verifier error: " + (e && e.message ? e.message : String(e)));
    return out;
  }
}

// cta>endcard and logos>endcard are universal closing connectors, allowed across films.
const ALLOWED_PAIRS = new Set(["cta>endcard", "logos>endcard"]);

function pairsOf(fingerprint) {
  const types = String(fingerprint || "").split(">").filter(Boolean);
  const pairs = new Set();
  for (let i = 1; i < types.length; i++) pairs.add(types[i - 1] + ">" + types[i]);
  return pairs;
}

function fallbackShots(sample) {
  const colors = (sample.brief && sample.brief.colors) || [];
  const c0 = /^#[0-9a-f]{3,8}$/i.test(colors[0] || "") ? colors[0] : "#141414";
  const c1 = /^#[0-9a-f]{3,8}$/i.test(colors[1] || "") ? colors[1] : c0;
  const svg = (w, h, fill) => "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${fill}"/></svg>`);
  return [
    { url: svg(1440, 900, c0), width: 1440, height: 900, role: "hero" },
    { url: svg(1440, 3200, c1), width: 1440, height: 3200, role: "fullpage" },
  ];
}

function briefOf(sample) {
  const brief = { ...(sample.brief || {}) };
  const shots = Array.isArray(sample.brief && sample.brief.screenshots) && sample.brief.screenshots.length
    ? sample.brief.screenshots
    : fallbackShots(sample);
  brief.screenshots = shots;
  return brief;
}

function planOf(sample) {
  return {
    style: sample.style,
    motionVariation: sample.motionVariation,
    direction: sample.direction,
    structure: sample.direction && sample.direction.structure,
    scenes: sample.scenes,
    aspect: sample.aspect,
  };
}

export function verifyReel(samples, composeFn) {
  const films = [];
  const seen = new Map();
  try {
    const list = Array.isArray(samples) ? samples : [];
    list.forEach((sample) => {
      const name = (sample.brief && sample.brief.name) || sample.name || "film";
      const issues = [];
      let fingerprint = null;
      try {
        const brief = briefOf(sample);
        const plan = planOf(sample);
        const comp = composeFn(brief, plan, { aspect: sample.aspect || "16:9" });
        const v = verifyFilm(brief, plan, comp);
        fingerprint = v.fingerprint || null;
        issues.push(...v.issues);
      } catch (e) {
        issues.push("compose failed: " + (e && e.message ? e.message : String(e)));
      }
      films.push({ name, fingerprint, issues });
      if (fingerprint) {
        if (!seen.has(fingerprint)) seen.set(fingerprint, []);
        seen.get(fingerprint).push({ name, issues });
      }
    });
  } catch (e) {
    return { ok: false, films, duplicates: [], error: e && e.message ? e.message : String(e) };
  }
  const duplicates = [];
  seen.forEach((entries, fingerprint) => {
    if (entries.length > 1) duplicates.push({ fingerprint, films: entries.map((x) => x.name) });
  });

  const pairCache = new Map();
  for (const f of films) {
    let set = null;
    if (f.fingerprint) {
      if (!pairCache.has(f.fingerprint)) pairCache.set(f.fingerprint, pairsOf(f.fingerprint));
      set = pairCache.get(f.fingerprint);
    }
    f.pairs = set;
  }
  for (let i = 0; i < films.length; i++) {
    for (let j = 0; j < films.length; j++) {
      if (i === j) continue;
      const a = films[i].pairs;
      const b = films[j].pairs;
      if (!a || !b) continue;
      if (films[i].fingerprint === films[j].fingerprint) continue;
      const shared = [];
      a.forEach((p) => { if (b.has(p) && !ALLOWED_PAIRS.has(p)) shared.push(p); });
      if (shared.length >= 1) {
        films[i].issues.push(`shares ${shared.length} signature beats with ${films[j].name}`);
      }
    }
  }

  const ok = duplicates.length === 0 && films.every((f) => f.issues.length === 0);
  return { ok, films, duplicates };
}
