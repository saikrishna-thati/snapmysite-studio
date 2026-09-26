// Snapmy.site MP4 export — runs entirely in the visitor's browser.
// The composition is loaded in a hidden frame with the HyperFrames runtime and
// seeked frame by frame (the same deterministic renderSeek its own renderer
// uses). Each frame is rasterised through an SVG foreignObject onto a canvas,
// and WebCodecs encodes the frames plus the score into an MP4 via mediabunny.

const RUNTIME = "https://cdn.jsdelivr.net/npm/@hyperframes/core@0.8.62/dist/hyperframe.runtime.iife.js";
const MEDIABUNNY = "https://cdn.jsdelivr.net/npm/mediabunny@1.60.0/dist/bundles/mediabunny.min.mjs";

export function exportSupported() {
  return typeof VideoEncoder === "function" && typeof XMLSerializer === "function" && typeof Blob === "function";
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadComposition(html, width, height) {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  Object.assign(frame.style, { position: "fixed", left: "-20000px", top: "0", width: `${width}px`, height: `${height}px`, border: "0", opacity: "0", pointerEvents: "none" });
  const withRuntime = html.includes("</body>") ? html.replace("</body>", `<script src="${RUNTIME}"></script></body>`) : html + `<script src="${RUNTIME}"></script>`;
  const loaded = new Promise((resolve) => frame.addEventListener("load", resolve, { once: true }));
  frame.srcdoc = withRuntime;
  document.body.appendChild(frame);
  await loaded;
  const win = frame.contentWindow;
  for (let i = 0; i < 400; i++) {
    if (win.__player && typeof win.__player.renderSeek === "function" && win.__timelines) break;
    await wait(50);
  }
  if (!win.__player || typeof win.__player.renderSeek !== "function") {
    frame.remove();
    throw new Error("The film engine did not load. Check your connection and try again.");
  }
  try { await frame.contentDocument.fonts.ready; } catch {}
  return frame;
}

/* ---------------- resources ---------------- */
// SVG images can't load anything external, so every stylesheet, font and image
// the frame uses is fetched once and inlined as a data URL.

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(fr.result); fr.onerror = reject; fr.readAsDataURL(blob); });
}

// Large raster screenshots are re-encoded as JPEG so each frame decodes quickly.
async function compactImage(blob) {
  if (!/^image\/(png|jpeg|webp)/.test(blob.type) || typeof createImageBitmap !== "function") return blob;
  const bmp = await createImageBitmap(blob);
  try {
    if (bmp.width < 800) return blob;
    const scale = Math.min(1, 2400 / bmp.width);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    return await new Promise((resolve) => c.toBlob((b) => resolve(b || blob), "image/jpeg", 0.9));
  } finally { bmp.close?.(); }
}

function makeInliner(base) {
  const cache = new Map();
  const dataUrl = (url, kind) => {
    const key = `${kind}:${url}`;
    if (!cache.has(key)) {
      cache.set(key, (async () => {
        try {
          const res = await fetch(url, { mode: "cors", credentials: "omit" });
          if (!res.ok) return null;
          const blob = await res.blob();
          return await blobToDataUrl(kind === "image" ? await compactImage(blob) : blob);
        } catch { return null; }
      })());
    }
    return cache.get(key);
  };
  const absolute = (value, from) => { try { return new URL(value, from || base).href; } catch { return ""; } };
  // Replaces every url(...) in a CSS string with a data URL (fragment refs like url(#n) stay).
  const css = async (text, from, kind = "image") => {
    const refs = [...new Set([...String(text).matchAll(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g)].map((m) => m[2]))]
      .filter((u) => !u.startsWith("#") && !u.startsWith("data:"));
    let out = String(text);
    for (const ref of refs) {
      const abs = absolute(ref.replace(/&amp;/g, "&"), from);
      const data = abs && (await dataUrl(abs, /\.(woff2?|ttf|otf)(\?|$)/i.test(abs) ? "font" : kind));
      out = out.split(ref).join(data || "about:blank");
    }
    return out;
  };
  return { dataUrl, css, absolute };
}

async function inlineResources(doc) {
  const inline = makeInliner(doc.baseURI);
  // Linked stylesheets (e.g. Google Fonts) become <style> blocks with embedded fonts.
  for (const link of [...doc.querySelectorAll('link[rel~="stylesheet"][href]')]) {
    const href = inline.absolute(link.getAttribute("href"));
    let text = "";
    try { const res = await fetch(href, { mode: "cors", credentials: "omit" }); if (res.ok) text = await res.text(); } catch {}
    if (text) { const style = doc.createElement("style"); style.textContent = await inline.css(text, href, "font"); link.replaceWith(style); }
    else link.remove();
  }
  doc.querySelectorAll('link[rel="preconnect"], link[rel="preload"]').forEach((l) => l.remove());
  for (const style of doc.querySelectorAll("style")) {
    if (/url\(/.test(style.textContent || "")) style.textContent = await inline.css(style.textContent);
  }
  for (const el of doc.querySelectorAll("[style]")) {
    const value = el.getAttribute("style");
    if (value && /url\(/.test(value)) el.setAttribute("style", await inline.css(value));
  }
  for (const img of doc.querySelectorAll("img[src]")) {
    const src = img.getAttribute("src");
    if (!src || src.startsWith("data:")) continue;
    const data = await inline.dataUrl(inline.absolute(src), "image");
    if (data) img.setAttribute("src", data); else img.removeAttribute("src");
    img.removeAttribute("srcset");
  }
  // Scripts have done their work; they only add weight to every frame.
  doc.querySelectorAll("script, noscript, audio, video").forEach((el) => el.remove());
}

/* ---------------- frames ---------------- */

function frameSvg(doc, serializer, width, height) {
  const html = serializer.serializeToString(doc.documentElement);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><foreignObject x="0" y="0" width="${width}" height="${height}">${html}</foreignObject></svg>`;
}

// A data: URL (not blob:) keeps Chrome from tainting the canvas with foreignObject content.
async function drawFrame(ctx, svg, width, height) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
}

async function decodeAudio(blob, seconds) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  try {
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    const length = Math.min(decoded.length, Math.ceil(seconds * decoded.sampleRate));
    if (length === decoded.length) return decoded;
    const trimmed = new AudioBuffer({ length, numberOfChannels: decoded.numberOfChannels, sampleRate: decoded.sampleRate });
    for (let ch = 0; ch < decoded.numberOfChannels; ch++) trimmed.copyToChannel(decoded.getChannelData(ch).subarray(0, length), ch);
    return trimmed;
  } finally {
    ctx.close?.();
  }
}

/**
 * Renders a composition to an MP4 Blob, or null when cancelled.
 * `onProgress(fraction, label)` reports progress; `isCancelled()` is polled per frame.
 */
export async function renderMp4({ html, width, height, duration, audio = null, fps = 30, onProgress = () => {}, isCancelled = () => false }) {
  onProgress(0, "Loading the film engine");
  const mb = await import(MEDIABUNNY);
  const frame = await loadComposition(html, width, height);
  try {
    onProgress(0.01, "Embedding fonts and screenshots");
    const doc = frame.contentDocument;
    const win = frame.contentWindow;
    await inlineResources(doc);
    if (isCancelled()) return null;

    const videoCodec = await mb.getFirstEncodableVideoCodec(["avc", "vp9", "av1"], { width, height });
    if (!videoCodec) throw new Error("This browser can't encode video. Try Chrome or Edge.");
    const output = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: "in-memory" }), target: new mb.BufferTarget() });
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext("2d");
    const video = new mb.CanvasSource(canvas, { codec: videoCodec, bitrate: mb.QUALITY_HIGH, keyFrameInterval: 2 });
    output.addVideoTrack(video, { frameRate: fps });

    let audioSource = null;
    let audioBuffer = null;
    if (audio && typeof AudioEncoder === "function") {
      audioBuffer = await decodeAudio(audio, duration).catch(() => null);
      if (audioBuffer) {
        const audioCodec = await mb.getFirstEncodableAudioCodec(["aac", "opus"], { numberOfChannels: audioBuffer.numberOfChannels, sampleRate: audioBuffer.sampleRate });
        if (audioCodec) { audioSource = new mb.AudioBufferSource({ codec: audioCodec, bitrate: mb.QUALITY_HIGH }); output.addAudioTrack(audioSource); }
      }
    }

    await output.start();
    if (audioSource) { await audioSource.add(audioBuffer); audioSource.close(); }

    const serializer = new XMLSerializer();
    const total = Math.max(1, Math.round(duration * fps));
    for (let i = 0; i < total; i++) {
      if (isCancelled()) { await output.cancel(); return null; }
      win.__player.renderSeek(i / fps);
      await drawFrame(ctx, frameSvg(doc, serializer, width, height), width, height);
      await video.add(i / fps, 1 / fps);
      onProgress(0.02 + 0.96 * ((i + 1) / total), "Rendering frames");
    }
    video.close();
    onProgress(0.99, "Finishing the file");
    await output.finalize();
    onProgress(1, "Done");
    return new Blob([output.target.buffer], { type: "video/mp4" });
  } finally {
    frame.remove();
  }
}
