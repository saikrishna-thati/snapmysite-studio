
window.__SNAPMY_METRICS = {
  reels: {},
  recordFrame: function (reelId, frameDurationMs) {
    if (!this.reels[reelId]) {
      this.reels[reelId] = { frames: 0, totalMs: 0, maxMs: 0, droppedFrames: 0 };
    }
    const r = this.reels[reelId];
    r.frames++;
    r.totalMs += frameDurationMs;
    if (frameDurationMs > r.maxMs) r.maxMs = frameDurationMs;
    if (frameDurationMs > 33.3) r.droppedFrames++;
  },
  getSummary: function () {
    const summary = {};
    for (const [id, data] of Object.entries(this.reels)) {
      summary[id] = {
        avgFps: data.frames ? Math.round((data.frames / (data.totalMs / 1000)) * 10) / 10 : 0,
        droppedFrames: data.droppedFrames,
        maxFrameMs: Math.round(data.maxMs * 10) / 10,
      };
    }
    return summary;
  },
};

// Snapmy.site studio — URL → read → direction → motion panel → launch film + original score.
import { compose, fallbackPlan, STYLES, CUT, BEAT, palette, ASPECTS } from "./composer.js";
import { exportSupported, renderMp4 } from "./export.js";
import { renderScore } from "./score.js";
import { api, backendStatus, readInBrowser, kimiInBrowser, guessDecisions, normalizePlan } from "./direction.js";
import { API } from "./config.js";
import { SAMPLES } from "./samples.js";

const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const st = { brief: null, decisions: null, plan: null, raw: null, aspect: "16:9", style: "auto", seed: 0, comp: null, score: null, backend: null, render: null, token: 0 };

/* ---------------- theme + small UI ---------------- */
const root = document.documentElement;
try { const t = localStorage.getItem("cue.theme"); if (t) root.dataset.theme = t; } catch {}
$("themeToggle")?.addEventListener("click", () => { const n = root.dataset.theme === "dark" ? "light" : "dark"; root.dataset.theme = n; try { localStorage.setItem("cue.theme", n); } catch {} });
let toastT = 0;
function toast(msg) { let e = $("toast"); if (!e) { e = document.createElement("div"); e.id = "toast"; e.className = "toast"; e.setAttribute("role", "status"); document.body.appendChild(e); } e.textContent = msg; e.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove("show"), 3800); }
document.querySelectorAll("#billingSeg button").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll("#billingSeg button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
  const annual = b.dataset.billing === "annual";
  document.querySelectorAll(".plan .amt[data-monthly]").forEach((a) => (a.textContent = annual ? a.dataset.annual : a.dataset.monthly));
  document.querySelectorAll(".plan .per[data-period]").forEach((p) => (p.textContent = annual ? p.dataset.periodAnnual : p.dataset.period));
}));
document.querySelectorAll("[data-plan]").forEach((b) => b.addEventListener("click", () => { toast(b.dataset.plan === "free" ? "You're in. Paste a URL to make your launch film." : "Checkout is off in the test build. Every film renders at 1080p for now."); $("urlInput").focus(); }));

/* ---------------- sample films (hero + reel) ---------------- */
function samplePlan(s) {
  const b = s.brief;
  if (Array.isArray(s.scenes) && s.scenes.length) {
    return { style: s.style, motionVariation: s.motionVariation, direction: s.direction, structure: s.direction?.structure, scenes: s.scenes };
  }
  const f = b.features || []; const st2 = b.stats || [];
  const hookWords = (b.hook && b.hook.length ? b.hook : b.headline.split(/\s+/)).slice(0, 4);
  const scenes = [
    { type: "coldopen", word: b.name },
    { type: "hook", words: hookWords },
    { type: "statement", text: b.description, kicker: b.category || "Launch" },
    ...f.slice(0, 3).map((x, i) => ({ type: "feature", title: x.title, sub: x.desc, index: i, transition: i === 0 ? (STYLES[s.style].accents.includes("flash") ? "flash" : "zoom") : undefined })),
    ...st2.slice(0, 2).map((x) => ({ type: "stat", value: x.value, label: x.label })),
    { type: "cta", text: b.cta || "Get started", button: b.cta || "Get started" },
    { type: "endcard", text: b.description },
  ];
  return { style: s.style, motionVariation: s.motionVariation, scenes };
}
/* ---------------- real capture evidence ---------------- */
// Every product shot is a real capture of the sample's own domain. Records keep
// page origin, viewport, page role and capture type so direction stays intentional.
const PRODUCT_TYPES = new Set(["screen", "scroll", "split", "flyin", "depthReveal", "matchcut", "track"]);
function captureUrl(page, w, h, full = false) {
  const u = new URL("https://api.microlink.io/");
  u.searchParams.set("url", page); u.searchParams.set("screenshot", "true"); u.searchParams.set("meta", "false"); u.searchParams.set("embed", "screenshot.url");
  u.searchParams.set("viewport.width", String(w)); u.searchParams.set("viewport.height", String(h));
  if (full) u.searchParams.set("screenshot.fullPage", "true");
  return u.href;
}
function captureRecords(brief) {
  const page = /^https?:/i.test(brief.url || "") ? brief.url : `https://${String(brief.domain || "").replace(/^https?:\/\//, "")}/`;
  return [
    { id: "home-desktop", url: captureUrl(page, 1440, 900), page, pageRole: "home", role: "home", viewport: "1440x900", kind: "screenshot", fullPage: false, width: 1440, height: 900 },
    { id: "home-fullpage", url: captureUrl(page, 1440, 900, true), page, pageRole: "overview", role: "fullpage", viewport: "1440x900", kind: "fullpage", fullPage: true },
    { id: "home-mobile", url: captureUrl(page, 390, 844), page, pageRole: "home", role: "responsive", viewport: "390x844", kind: "screenshot", fullPage: false, width: 390, height: 844 },
  ];
}
const captureCheck = new Map();
function loadCapture(url, ms = 2000) {
  if (captureCheck.has(url)) return captureCheck.get(url);
  const p = new Promise((res) => {
    const img = new Image(); const timer = setTimeout(() => res(null), ms);
    img.onload = () => { clearTimeout(timer); res(img.naturalWidth > 40 && img.naturalHeight > 40 ? { width: img.naturalWidth, height: img.naturalHeight } : null); };
    img.onerror = () => { clearTimeout(timer); res(null); };
    img.src = url;
  });
  captureCheck.set(url, p);
  return p;
}
// Loads every screenshot a brief points at (the capture service can take a few
// seconds per page), records real dimensions, and drops the ones that failed so
// the film never shows a broken frame.
async function warmEvidence(brief) {
  const urlOf = (v) => (typeof v === "string" ? v : v && v.url) || "";
  const urls = [...new Set([
    ...(brief.screenshots || []).map(urlOf),
    ...(brief.evidenceAssets || []).map(urlOf),
    ...(brief.screenshotCandidates || []).map(urlOf),
    ...(brief.fullpages || []).map(urlOf),
    urlOf(brief.fullpage),
  ].filter((u) => /^https?:/i.test(u)))];
  if (!urls.length) return brief;
  const sizes = new Map(await Promise.all(urls.map(async (u) => [u, await loadCapture(u, 30000)])));
  const ok = (v) => { const u = urlOf(v); return !sizes.has(u) || !!sizes.get(u); };
  const sized = (a) => { const s = sizes.get(urlOf(a)); return s && a && typeof a === "object" ? { ...a, width: s.width, height: s.height } : a; };
  const kept = urls.filter((u) => sizes.get(u)).length;
  log(`Captured ${kept} of ${urls.length} screenshots`, kept ? "ok" : "warn");
  return {
    ...brief,
    screenshots: (brief.screenshots || []).filter(ok),
    evidenceAssets: (brief.evidenceAssets || []).filter(ok).map(sized),
    screenshotCandidates: (brief.screenshotCandidates || []).filter(ok).map(sized),
    fullpages: (brief.fullpages || []).filter(ok),
    fullpage: ok(brief.fullpage) ? brief.fullpage : "",
  };
}
// Validate captures, then drop product scenes whose capture is unavailable and
// remap shot indices onto the surviving evidence. Never invents a panel.
async function validateEvidence(brief, plan) {
  const shots = (brief.screenshots || []).map((s, i) => (typeof s === "string" ? { id: `capture-${i + 1}`, url: s } : s)).filter((s) => s && s.url && !String(s.url).startsWith("data:"));
  const checks = await Promise.all(shots.map((s) => loadCapture(s.url)));
  const map = new Map(); const kept = [];
  shots.forEach((s, i) => { if (checks[i]) { map.set(i, kept.length); kept.push({ ...s, width: checks[i].width, height: checks[i].height, fullPage: s.fullPage || checks[i].height > checks[i].width * 1.4 }); } });
  const remap = (v) => (Number.isInteger(v) ? map.get(v) : v);
  const scenes = (plan.scenes || []).map((sc) => {
    if (!PRODUCT_TYPES.has(sc.type)) return sc;
    if (!kept.length) return null;
    if (sc.type === "matchcut") { const from = remap(sc.from), to = remap(sc.to); return from == null && to == null ? null : { ...sc, from: from ?? to, to: to ?? from }; }
    if (Number.isInteger(sc.shot)) { const shot = remap(sc.shot); return shot == null ? null : { ...sc, shot }; }
    return sc;
  }).filter(Boolean);
  const structure = scenes.map((s) => s.type);
  const nextPlan = { ...plan, scenes, structure, direction: plan.direction ? { ...plan.direction, structure, opening: structure[0] } : plan.direction };
  return { brief: { ...brief, screenshots: kept, evidenceAssets: kept, fullpages: [], fullpage: null, sourceAssets: [], assets: [] }, plan: nextPlan, dropped: shots.length - kept.length };
}
const sampleCache = new Map();
function prepareSample(s) {
  const key = s.brief.domain || s.brief.name;
  if (!sampleCache.has(key)) sampleCache.set(key, validateEvidence({ ...s.brief, screenshots: captureRecords(s.brief) }, samplePlan(s)));
  return sampleCache.get(key);
}

async function heroInit() {
  const hp = $("heroPlayer"); if (!hp) return;
  const s = SAMPLES.find((x) => x.direction?.hero) || SAMPLES[0];
  const aspect = s.aspect || "16:9";
  const { brief, plan } = await prepareSample(s);
  const base = compose(brief, plan, { aspect });
  hp.setAttribute("srcdoc", base.html);
  hp.setAttribute("width", String(base.width));
  hp.setAttribute("height", String(base.height));
  const flagship = Boolean(s.direction?.hero);
  const beat = s.direction?.beat ? ` · ${s.direction.beat}s` : "";
  $("heroMeta").textContent = `${flagship ? "Flagship" : "Sample"} · ${brief.name} · ${STYLES[s.style].label}${beat}`;
  paintMini(base);
  hp.addEventListener("timeupdate", () => { const t = hp.currentTime || 0; $("heroTc").textContent = tc(t, true); $("heroHead").style.left = (100 * t) / base.duration + "%"; });
  let scored = false;
  $("heroSound").addEventListener("click", async () => {
    const on = $("heroSound").getAttribute("aria-pressed") !== "true";
    $("heroSound").setAttribute("aria-pressed", String(on)); $("heroSound").querySelector("span").textContent = on ? "Sound on" : "Sound off";
    $("soundWave")?.setAttribute("opacity", on ? "1" : ".3");
    if (on && !scored) {
      scored = true;
      const sc = await renderScore({ scenes: base.scenes, cues: base.cues, duration: base.duration, style: s.style, energy: 2, soundProfile: base.soundProfile });
      const withAudio = compose(brief, plan, { aspect, audioSrc: sc.url });
      hp.setAttribute("srcdoc", withAudio.html);
      await once(hp, "ready", 8000); hp.muted = false; hp.play();
    } else hp.muted = !on;
  });
}
function paintMini(c) {
  const box = $("heroScenes"); if (!box) return; box.innerHTML = "";
  c.scenes.forEach((s) => { const d = document.createElement("div"); d.style.flex = "1"; d.style.setProperty("--c", c.palette.accent); d.textContent = s.type; box.appendChild(d); });
}
function reelInit() {
  const reel = $("reel"); if (!reel) return;

  const reelObserver = new IntersectionObserver((entries) => {
    entries.forEach(async (entry) => {
      const frame = entry.target;
      const player = frame.querySelector("hyperframes-player");
      if (entry.isIntersecting) {
        if (!player) {
          if (frame.dataset.loading === "true") return;
          frame.dataset.loading = "true";
          const idx = Number(frame.dataset.index);
          const s = SAMPLES[idx];
          if (!s) return;
          try {
            const { brief, plan } = await prepareSample(s);
            if (frame.querySelector("hyperframes-player")) return;
            const comp = compose(brief, plan, { aspect: "16:9" });
            const p = document.createElement("hyperframes-player");
            p.className = "hfp";
            p.setAttribute("muted", "");
            p.setAttribute("loop", "");
            p.setAttribute("autoplay", "");
            if (comp.width) p.setAttribute("width", String(comp.width));
            if (comp.height) p.setAttribute("height", String(comp.height));
            p.setAttribute("srcdoc", comp.html);
            frame.prepend(p);
            p.addEventListener("ready", () => {
              frame.classList.add("playing");
              p.play?.();
            }, { once: true });
          } catch (err) {
            console.warn("[reel] autoplay mount failed for", s?.brief?.name, err);
          } finally {
            frame.dataset.loading = "false";
          }
        } else {
          frame.classList.add("playing");
          player.play?.();
        }
      } else {
        if (player) {
          player.pause?.();
        }
      }
    });
  }, { threshold: 0.1, rootMargin: "150px 0px" });

  SAMPLES.forEach((s, i) => {
    const P = palette({ colors: s.brief.colors }, STYLES[s.style]);
    const aspect = "16:9";
    const flagship = Boolean(s.direction?.hero);
    const fig = document.createElement("figure");
    fig.className = "fig fig--16-9";
    fig.innerHTML = `<div class="frame" data-index="${i}" tabindex="0" role="button" aria-label="Play ${s.brief.name} sample" style="aspect-ratio:16 / 9"><div class="poster" style="--pbg:${P.bg};--pc:${P.field};--pfg:${P.fg}"><i></i><span class="poster-tag mono small">${STYLES[s.style].label} · ${s.note}</span><b>${s.brief.headline}</b></div><span class="play-hint mono small">Play</span></div><figcaption><b>${s.brief.name}</b><span class="muted">${s.brief.domain}</span></figcaption>`;
    const frame = fig.querySelector(".frame");
    if (flagship) frame.setAttribute("data-hero", "1");
    frame.addEventListener("click", () => openSample(s));
    reel.appendChild(fig);
    reelObserver.observe(frame);
  });
}
function reelSelfCheck() {
  try {
    const run = () => import("./verify.js").then((m) => {
      if (typeof m.verifyReel !== "function") return;
      const out = m.verifyReel(SAMPLES, (brief, plan, opts) => compose(brief, plan, opts || { aspect: "16:9" }));
      const films = out?.films || [];
      const uniq = new Set(films.map((f) => f.fingerprint || "").filter(Boolean)).size;
      const issues = films.reduce((n, f) => n + (f.issues?.length || 0), 0);
      const bad = films.filter((f) => (f.issues?.length || 0) > 0);
      const dupNames = new Set((out?.duplicates || []).flatMap((d) => d.films || []));
      if (out?.ok) {
        console.info(`[reel] verified ${uniq}/${SAMPLES.length} unique, ${issues} issues`);
        return;
      }
      bad.forEach((f) => {
        const frames = SAMPLES.filter((s) => s.brief?.name === f.name);
        frames.forEach((s) => {
          const idx = SAMPLES.indexOf(s);
          const frame = document.querySelectorAll("#reel .frame")[idx];
          if (frame) frame.setAttribute("data-verify", "fail");
        });
      });
      const dupOnly = [...dupNames].filter((n) => !bad.some((f) => f.name === n));
      dupOnly.forEach((n) => {
        const idx = SAMPLES.findIndex((s) => s.brief?.name === n);
        const frame = document.querySelectorAll("#reel .frame")[idx];
        if (frame) frame.setAttribute("data-verify", "fail");
      });
      const lines = [
        ...bad.map((f) => `${f.name}: ${f.issues.join(" / ")}`),
        ...(out?.duplicates || []).length ? [`duplicates: ${out.duplicates.map((d) => d.films.join("=")).join(" | ")}`] : [],
      ];
      console.error(`[reel] verifyReel FAILED (${uniq}/${SAMPLES.length} unique, ${issues} issues)\n` + lines.join("\n"));
    }).catch(() => {});
    if (typeof requestIdleCallback === "function") requestIdleCallback(run, { timeout: 3000 }); else setTimeout(run, 800);
  } catch (e) { console.warn("[reel] self-check skipped", e?.message); }
}
async function openSample(s) {
  const tok = ++st.token;
  showStudio(); resetScan();
  log("Checking real captures of " + s.brief.domain);
  const prepared = await prepareSample(s);
  if (tok !== st.token) return;
  if (prepared.dropped) log(`${prepared.dropped} capture(s) unavailable; those product shots were skipped`, "warn");
  st.brief = prepared.brief; st.decisions = { style: s.style, energy: 2, source: "sample" }; st.raw = null;
  st.plan = prepared.plan; st.style = "auto"; $("packSelect").value = "auto";
  $("studioTitle").textContent = s.brief.name; $("studioStatus").textContent = "Sample film";
  fillFacts(); fillPanel();
  log("Loaded sample brief · " + s.brief.domain, "ok"); stage("done");
  await build(tok);
}

/* ---------------- studio flow ---------------- */
function showStudio() { const sec = $("studio"); sec.hidden = false; sec.scrollIntoView({ behavior: "smooth", block: "start" }); }
function resetScan() { $("scanOverlay").classList.remove("done"); $("scanLog").innerHTML = ""; document.querySelectorAll("#scanSteps span").forEach((s) => s.classList.remove("active", "done")); $("exportBtn").disabled = true; $("remixBtn").disabled = true; $("projectBtn").disabled = true; $("downloadLink").hidden = true; }
const t0 = { v: 0 };
function log(msg, cls = "") { const li = document.createElement("li"); if (cls) li.className = cls; li.innerHTML = `<span class="ts">${((performance.now() - t0.v) / 1000).toFixed(1).padStart(5, "0")}s</span>${escapeHtml(msg)}`; $("scanLog").appendChild(li); while ($("scanLog").children.length > 14) $("scanLog").firstChild.remove(); }
function stage(name) { const order = ["home", "sitemap", "pages", "assets", "direct", "panel", "score"]; const k = name === "done" ? order.length : order.indexOf(name); document.querySelectorAll("#scanSteps span").forEach((s) => { const i = order.indexOf(s.dataset.stage); s.classList.toggle("done", i < k); s.classList.toggle("active", i === k); }); }
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function run(url) {
  const tok = ++st.token; t0.v = performance.now();
  showStudio(); resetScan();
  $("studioTitle").textContent = url.replace(/^https?:\/\//, ""); $("studioStatus").textContent = "Reading";
  stage("home"); log("Opening " + url);
  if (st.backend === null) await refreshBackend();
  let brief;
  try {
    if (st.backend) { log("Finding the pages that make your product matter"); stage("pages"); brief = (await api("/read", { url }, { timeout: 45000 })).brief; }
    else throw new Error("backend offline");
  } catch (e) {
    log("Studio server unreachable, reading in the browser instead", "warn");
    brief = await readInBrowser(url);
  }
  if (tok !== st.token) return;
  stage("assets");
  log("Capturing page screenshots");
  brief = await warmEvidence(brief);
  if (tok !== st.token) return;
  st.brief = brief;
  log(`Found ${brief.features.length} features · ${brief.stats.length} numbers · ${brief.quotes.length} quotes · ${brief.screenshots.length} screenshots`, "ok");
  if (brief.colors.length) log("Brand colors " + brief.colors.slice(0, 4).join(" "), "ok");
  $("studioTitle").textContent = brief.name; fillFacts();
  stage("direct"); $("studioStatus").textContent = "Directing";
  // Direction runs in the browser.
  log("Finding the strongest story angle");
  const decisions = guessDecisions(brief);
  let raw = null;
  log(`Direction set → ${STYLES[decisions.style]?.label || decisions.style}`, "ok");
  try { log("Adding the final creative pass"); raw = await kimiInBrowser(brief, decisions); } catch (e) { log("Creative pass unavailable, using the built-in direction", "warn"); }
  if (tok !== st.token) return;
  stage("panel");
  st.decisions = decisions; st.raw = raw;
  st.plan = raw ? normalizePlan(raw, brief, decisions) : fallbackPlan(brief, decisions);
  (st.plan.panel || []).forEach((p) => log(`${p.role}: ${p.note}`.slice(0, 140), "ok"));
  fillPanel();
  await build(tok);
}
async function build(tok = st.token, keepTime = false) {
  const brief = st.brief; if (!brief) return;
  const style = st.style !== "auto" ? st.style : st.plan.style || st.decisions?.style || "kinetic";
  const plan = { ...st.plan, style, motionVariation: st.plan.motionVariation || st.decisions?.motionVariation };
  stage("score"); $("studioStatus").textContent = "Scoring";
  const base = compose(brief, plan, { aspect: st.aspect, seed: st.seed });
   log(`Story shaped · ${STYLES[style].label}`, "ok");
  let score = null;
  try { score = await renderScore({ scenes: base.scenes, cues: base.cues, duration: base.duration, style, energy: energyOf(), soundProfile: base.soundProfile }); log("Soundtrack and sound design are ready", "ok"); } catch (e) { log("Score failed: " + e.message, "err"); }
  if (tok !== st.token) return;
  st.comp = compose(brief, plan, { aspect: st.aspect, seed: st.seed, audioSrc: score?.url });
  st.score = score;
  const p = $("studioPlayer");
  const at = keepTime ? p.currentTime || 0 : 0;
  $("stage").dataset.aspect = st.aspect;
  p.setAttribute("srcdoc", st.comp.html);
  await once(p, "ready", 12000);
  if (tok !== st.token) return;
  if (at) p.seek?.(at);
  stage("done"); $("scanOverlay").classList.add("done");
  $("studioStatus").textContent = `Ready · ${STYLES[style].label} · ${st.aspect}`;
  $("dirReadout").textContent = `${STYLES[style].label} · ${base.scenes.length} shots · ${tc(base.duration)}`;
  $("exportBtn").disabled = false; // Enable export with Film Engine v2
  $("remixBtn").disabled = false; $("projectBtn").disabled = false;
  paintTimeline(); fillScript();
  if (!keepTime) { try { p.muted = false; await p.play(); } catch { p.muted = true; p.play?.(); } setTimeout(() => { if (p.paused && (p.currentTime || 0) < 0.1) p.seek?.(0.9); }, 600); }
}
function energyOf() { const e = Number(st.decisions?.energy); return isFinite(e) ? 0.8 + e * 0.6 : 1.8; }
function once(el, ev, ms) { return new Promise((res) => { const t = setTimeout(res, ms); el.addEventListener(ev, () => { clearTimeout(t); res(); }, { once: true }); }); }

/* ---------------- panel ---------------- */
function fillFacts() {
  const b = st.brief;
  $("fPages").textContent = (b.screenshots || []).length ? `${b.screenshots.length} shots` : "—";
  $("fCat").textContent = st.decisions?.category || b.category || "—";
  $("fClaims").textContent = String((b.features || []).length + (b.stats || []).length);
  $("fColors").innerHTML = (b.colors || []).filter((c) => /^#[0-9a-f]{3,8}$/i.test(c)).slice(0, 5).map((c) => `<i style="background:${c}" title="${c}"></i>`).join("") || "—";
}
function fillPanel() {
  const d = st.decisions || {};
  const probs = d.styleProbs ? Object.entries(d.styleProbs).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([k, v]) => `${STYLES[k]?.label || k} ${Math.round(v * 100)}%`).join(", ") : "";
   const layerNote = d.layers ? ` <span class="muted small">Decisions: ${d.layers.decisions === "jev" ? "JEV" : "built-in rules"} → creative: ${d.layers.creative === "groq" ? "Groq" : "built-in rules"}.</span>` : "";
   const jevNote = d.jev ? ` ${escapeHtml(d.jev.story_angle.value.replace(/_/g, " "))} story, ${escapeHtml(d.jev.motion.camera)} camera, ${d.jev.selected_evidence.length} real captures.` : "";
   $("jevReadout").innerHTML = (d.source === "sample" ? "Sample film, directed in-house from real captures." : d.source === "heuristic" ? "Snapmy.site chose a direction from the product story." : `Snapmy.site picked <b>${escapeHtml(STYLES[d.style]?.label || d.style || "—")}</b>${probs ? ` (${escapeHtml(probs)})` : ""}.${jevNote}`) + layerNote;
  const notes = st.plan?.panel || [];
   $("panelNotes").innerHTML = notes.length ? notes.map((n) => `<li><b>${escapeHtml(n.role)}</b>${escapeHtml(n.note)}</li>`).join("") : `<li><b>Direction</b>Signed off on a clear hook, a product reveal, proof, and a confident final moment.</li>`;
  fillFacts();
}
const FIELD = { coldopen: "word", hook: "words", statement: "text", flashword: "word", screen: "caption", scroll: null, feature: "title", featureStack: "items", stat: "value", quote: "text", logos: "names", marquee: "text", split: "text", cta: "text", endcard: "text" };
function fillScript() {
  const box = $("script"); box.innerHTML = "";
  st.comp.scenes.forEach((s, i) => {
    const sc = st.plan.scenes[i] || { type: "endcard" };
    const f = FIELD[sc.type];
    const val = f ? (Array.isArray(sc[f]) ? sc[f].join(" / ") : sc[f] ?? "") : "(scrolls the site)";
    const row = document.createElement("label"); row.className = "shot"; row.dataset.i = i;
    row.innerHTML = `<span>${String(i + 1).padStart(2, "0")} · ${tc(s.t)}<em>${sc.type}</em></span><input type="text" value="${escapeHtml(val)}" ${f ? "" : "disabled"} aria-label="Shot ${i + 1} ${sc.type}">`;
    const inp = row.querySelector("input");
    inp.addEventListener("focus", () => $("studioPlayer").seek?.(s.t + 0.9));
    let tmr = 0;
    inp.addEventListener("input", () => { clearTimeout(tmr); tmr = setTimeout(() => { const v = inp.value.trim(); sc[f] = Array.isArray(sc[f]) ? v.split("/").map((x) => x.trim()).filter(Boolean) : v; build(st.token, true); }, 700); });
    box.appendChild(row);
  });
}
function paintTimeline() {
  const c = st.comp; const box = $("tlScenes"); box.innerHTML = "";
  const total = c.duration;
  c.scenes.forEach((s, i) => { const d = document.createElement("div"); d.style.width = (100 * CUT) / total + "%"; d.style.setProperty("--c", i % 2 ? c.palette.accent : c.palette.second); if (st.score && i === st.score.drop) d.className = "drop"; d.textContent = s.type; d.title = `${i + 1}. ${s.type} · ${s.label}`; box.appendChild(d); });
  $("tlBeats").style.setProperty("--beat", ((100 * BEAT) / total).toFixed(4));
}
function tc(t, frames = false) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return frames ? `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}:${String(Math.floor((t % 1) * 30)).padStart(2, "0")}` : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`; }

/* ---------------- transport ---------------- */
const sp = $("studioPlayer");
sp.addEventListener("timeupdate", () => {
  if (!st.comp) return; const t = sp.currentTime || 0, d = st.comp.duration;
  $("tc").textContent = `${tc(t)} / ${tc(d)}`; $("tlHead").style.left = (100 * t) / d + "%"; $("timeline").setAttribute("aria-valuenow", String(Math.round((100 * t) / d)));
  const i = Math.min(st.comp.scenes.length - 1, Math.floor(t / CUT));
  document.querySelectorAll("#script .shot").forEach((r) => r.classList.toggle("active", +r.dataset.i === i));
});
const setPlayIcon = () => { $("playIcon").innerHTML = sp.paused ? '<path d="M7 5v14l12-7z"/>' : '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>'; $("playBtn").setAttribute("aria-label", sp.paused ? "Play" : "Pause"); };
sp.addEventListener("play", setPlayIcon); sp.addEventListener("pause", setPlayIcon); sp.addEventListener("ended", setPlayIcon);
$("playBtn").addEventListener("click", () => (sp.paused ? sp.play() : sp.pause()));
$("muteBtn").addEventListener("click", () => { sp.muted = !sp.muted; $("muteBtn").setAttribute("aria-pressed", String(sp.muted)); });
const scrub = (e) => { if (!st.comp) return; const r = $("timeline").getBoundingClientRect(); const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)); sp.seek?.(x * st.comp.duration); };
$("timeline").addEventListener("pointerdown", (e) => { scrub(e); const mv = (ev) => scrub(ev); window.addEventListener("pointermove", mv); window.addEventListener("pointerup", () => window.removeEventListener("pointermove", mv), { once: true }); });
$("timeline").addEventListener("keydown", (e) => { if (!st.comp) return; const t = sp.currentTime || 0; if (e.key === "ArrowRight") sp.seek(Math.min(st.comp.duration, t + CUT)); if (e.key === "ArrowLeft") sp.seek(Math.max(0, t - CUT)); });
document.addEventListener("keydown", (e) => { if (e.code === "Space" && st.comp && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); sp.paused ? sp.play() : sp.pause(); } });

/* ---------------- direction controls ---------------- */
$("packSelect").addEventListener("change", (e) => { st.style = e.target.value; if (st.brief) build(st.token, true); });
document.querySelectorAll("#aspectSeg button").forEach((b) => b.addEventListener("click", () => { document.querySelectorAll("#aspectSeg button").forEach((x) => x.setAttribute("aria-checked", String(x === b))); st.aspect = b.dataset.aspect; if (st.brief) build(st.token, true); }));
$("remixBtn").addEventListener("click", async () => {
  if (!st.brief) return; st.seed++;
  $("remixBtn").disabled = true;
  if (st.decisions?.source !== "sample" && st.decisions?.source !== "heuristic" && st.backend) {
    toast("Motion panel is re-cutting the board");
     try { const d = await api("/direct", { brief: st.brief }, { timeout: 70000 }); if (d.plan) { st.raw = d.plan; st.plan = normalizePlan(d.plan, st.brief, st.decisions); fillPanel(); } } catch {}
  }
  await build(st.token);
});
$("newUrlBtn").addEventListener("click", () => { $("urlInput").value = ""; window.scrollTo({ top: 0, behavior: "smooth" }); $("urlInput").focus(); });

/* ---------------- export ---------------- */
// Rendered in the browser: frame-exact seek → canvas → WebCodecs → MP4 (see export.js).
let exportJob = null;
$("exportBtn").addEventListener("click", async () => {
  if (!st.comp || exportJob) return;
  if (!exportSupported()) { toast("MP4 export needs a recent Chrome, Edge or Safari. Download the project instead."); return; }
  const style = st.style !== "auto" ? st.style : st.plan.style || "kinetic";
  const [width, height] = ASPECTS[st.aspect] || ASPECTS["16:9"];
  const comp = compose(st.brief, { ...st.plan, style, motionVariation: st.plan.motionVariation || st.decisions?.motionVariation }, { aspect: st.aspect, seed: st.seed });
  const job = { cancelled: false }; exportJob = job;
  const player = $("studioPlayer"); try { player.pause?.(); } catch {}
  $("exportOverlay").hidden = false; $("exportMeter").style.width = "0%"; $("exportPct").textContent = "Preparing"; $("exportLabel").textContent = "Rendering your launch film";
  try {
    const blob = await renderMp4({
      html: comp.html, width, height, duration: comp.duration, audio: st.score?.blob || null, fps: 30,
      isCancelled: () => job.cancelled,
      onProgress: (f, label) => { if (exportJob !== job) return; $("exportMeter").style.width = (f * 100).toFixed(1) + "%"; $("exportPct").textContent = f > 0.02 && f < 0.99 ? Math.round(f * 100) + "%" : label; },
    });
    if (blob && !job.cancelled) {
      const a = $("downloadLink");
      if (a.href && a.href.startsWith("blob:")) URL.revokeObjectURL(a.href);
      a.href = URL.createObjectURL(blob);
      a.download = `${(st.brief.name || "snapmy-site").toLowerCase().replace(/\W+/g, "-")}-snapmy-${st.aspect.replace(":", "x")}.mp4`;
      a.textContent = `Download MP4 (${st.aspect}, ${(blob.size / 1048576).toFixed(1)} MB)`;
      a.hidden = false;
      a.click();
      toast("Your launch film is ready.");
    }
  } catch (e) { console.warn(e); if (!job.cancelled) toast("Render failed: " + e.message); }
  if (exportJob === job) { exportJob = null; $("exportOverlay").hidden = true; }
});
$("cancelExport").addEventListener("click", () => { if (exportJob) exportJob.cancelled = true; exportJob = null; $("exportOverlay").hidden = true; });
async function refreshBackend() {
  const status = await backendStatus();
  st.backend = status.ok;
  st.render = status.render?.available === true;
  return status;
}
function blobToDataUrl(b) { return new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); }); }
$("projectBtn").addEventListener("click", async () => {
  if (!st.comp) return;
  const style = st.style !== "auto" ? st.style : st.plan.style || "kinetic";
  const audio = st.score ? await blobToDataUrl(st.score.blob) : undefined;
   const html = compose(st.brief, { ...st.plan, style, motionVariation: st.plan.motionVariation || st.decisions?.motionVariation }, { aspect: st.aspect, seed: st.seed, audioSrc: audio }).html;
   const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([html], { type: "text/html" })); a.download = `${(st.brief.name || "snapmy-site").toLowerCase().replace(/\W+/g, "-")}-index.html`; a.click();
   toast("Project saved. Keep it with your launch assets.");
});

/* ---------------- form ---------------- */
function normalizeUrl(v) { v = v.trim().replace(/^https?:\/\//i, ""); if (!v || !/^[a-z0-9-]+(\.[a-z0-9-]+)+(\/.*)?$/i.test(v)) return null; return "https://" + v; }
$("urlForm").addEventListener("submit", (e) => { e.preventDefault(); const u = normalizeUrl($("urlInput").value); if (!u) { $("formError").textContent = "Enter a website like yourproduct.com"; $("formError").hidden = false; return; } $("formError").hidden = true; run(u); });
document.querySelectorAll(".try .chip").forEach((c) => c.addEventListener("click", () => { $("urlInput").value = c.dataset.url; run("https://" + c.dataset.url); }));

customElements.whenDefined("hyperframes-player").then(() => { heroInit(); reelInit(); reelSelfCheck(); });
refreshBackend();

/* ---------------- headline: only "launch" changes ---------------- */
(function launchCycle() {
  const el = document.getElementById("launchWord"); if (!el) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return; // static accessible fallback
  const fx = ["clip", "flip", "track", "outline", "smear"]; let k = 0;
  const step = () => { el.classList.remove("run"); el.dataset.fx = fx[k++ % fx.length]; void el.offsetWidth; el.classList.add("run"); };
  step(); setInterval(() => { if (!document.hidden) step(); }, 3200);
})();
