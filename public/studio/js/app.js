/**
 * SnapMySite Studio Showcase Reel Runner
 * Autoplay on scroll with viewport intersection observer, RAF leak prevention,
 * and lightweight performance metrics monitoring.
 */

// Lightweight performance monitor
window.__SNAPMY_METRICS = {
  reels: {},
  audio: {},
  recordFrame: function (reelId, frameDurationMs) {
    if (!this.reels[reelId]) {
      this.reels[reelId] = { frames: 0, totalMs: 0, maxMs: 0, droppedFrames: 0 };
    }
    const r = this.reels[reelId];
    r.frames++;
    r.totalMs += frameDurationMs;
    if (frameDurationMs > r.maxMs) r.maxMs = frameDurationMs;
    if (frameDurationMs > 33.3) r.droppedFrames++; // >33.3ms implies drop below 30fps
  },
  getSummary: function () {
    const summary = {};
    for (const [id, data] of Object.entries(this.reels)) {
      summary[id] = {
        avgFps: data.frames > 0 ? Math.round((data.frames / (data.totalMs / 1000)) * 10) / 10 : 0,
        maxFrameMs: Math.round(data.maxMs * 10) / 10,
        droppedFrames: data.droppedFrames,
      };
    }
    return summary;
  },
};

document.addEventListener("DOMContentLoaded", () => {
  const showcaseContainer = document.getElementById("showcase-grid");
  const activeAnimationHandles = new Map();

  const showcaseIdentities = [
    { id: "saas-velocity", name: "SaaS Velocity", palette: ["#6366f1", "#06b6d4", "#3b82f6"] },
    { id: "fintech-trust", name: "Fintech Trust", palette: ["#10b981", "#059669", "#047857"] },
    { id: "ai-synth", name: "AI Synth", palette: ["#ec4899", "#8b5cf6", "#d946ef"] },
    { id: "crypto-frontier", name: "Crypto Frontier", palette: ["#f59e0b", "#d97706", "#b45309"] },
    { id: "minimal-mono", name: "Minimal Mono", palette: ["#f8fafc", "#94a3b8", "#0f172a"] },
    { id: "editorial-lux", name: "Editorial Lux", palette: ["#e2d9cc", "#c5a880", "#1c1917"] },
    { id: "cyber-punk", name: "Cyber Punk", palette: ["#00ff66", "#00f0ff", "#ff003c"] },
    { id: "dev-terminal", name: "Dev Terminal", palette: ["#22c55e", "#15803d", "#052e16"] },
    { id: "flow-motion", name: "Flow Motion", palette: ["#38bdf8", "#818cf8", "#c084fc"] },
    { id: "neo-brutal", name: "Neo Brutal", palette: ["#ffdf00", "#ff007f", "#000000"] },
    { id: "zenith-clean", name: "Zenith Clean", palette: ["#ffffff", "#cbd5e1", "#475569"] },
    { id: "hyper-kinetic", name: "Hyper Kinetic", palette: ["#ff3366", "#33ccff", "#ffff33"] },
  ];

  if (!showcaseContainer) return;

  function startCanvasLoop(canvas, identity) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let startTime = performance.now();
    let lastFrameTime = performance.now();

    function render(now) {
      const delta = now - lastFrameTime;
      lastFrameTime = now;
      window.__SNAPMY_METRICS.recordFrame(identity.id, delta);

      const elapsed = (now - startTime) / 1000;
      const w = canvas.width;
      const h = canvas.height;

      ctx.clearRect(0, 0, w, h);

      // Background gradient
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, identity.palette[0]);
      grad.addColorStop(1, identity.palette[1] || identity.palette[0]);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle dynamic plane animation
      const offsetX = Math.sin(elapsed * 1.5) * (w * 0.1);
      const offsetY = Math.cos(elapsed * 1.2) * (h * 0.08);

      ctx.save();
      ctx.translate(w / 2 + offsetX, h / 2 + offsetY);
      ctx.rotate(Math.sin(elapsed * 0.5) * 0.1);
      ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
      ctx.fillRect(-w * 0.35, -h * 0.3, w * 0.7, h * 0.6);
      ctx.restore();

      const handle = requestAnimationFrame(render);
      activeAnimationHandles.set(canvas, handle);
    }

    const handle = requestAnimationFrame(render);
    activeAnimationHandles.set(canvas, handle);
  }

  function stopCanvasLoop(canvas) {
    const handle = activeAnimationHandles.get(canvas);
    if (handle) {
      cancelAnimationFrame(handle);
      activeAnimationHandles.delete(canvas);
    }
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const canvas = entry.target.querySelector("canvas");
        if (!canvas) return;

        if (entry.isIntersecting) {
          const identity = showcaseIdentities.find((i) => i.id === canvas.dataset.identityId);
          if (identity && !activeAnimationHandles.has(canvas)) {
            startCanvasLoop(canvas, identity);
          }
        } else {
          stopCanvasLoop(canvas);
        }
      });
    },
    { threshold: 0.15 },
  );

  showcaseIdentities.forEach((id) => {
    const card = document.createElement("div");
    card.className =
      "showcase-card rounded-xl overflow-hidden border border-slate-800 bg-slate-900";
    card.innerHTML = `
      <div class="aspect-[9/16] relative bg-black">
        <canvas width="360" height="640" class="w-full h-full" data-identity-id="${id.id}"></canvas>
        <div class="absolute bottom-3 left-3 text-white text-xs font-medium tracking-wide bg-black/60 px-2 py-1 rounded backdrop-blur">
          ${id.name}
        </div>
      </div>
    `;
    showcaseContainer.appendChild(card);
    observer.observe(card);
  });
});
