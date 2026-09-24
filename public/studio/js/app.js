// SnapMySite Studio App Entry Point
import { SHOWCASE_SAMPLES } from "./samples.js";
import { CursorRig } from "./cursor-rig.js";
import { ALL_100_TRANSITIONS, generateRemixVariation } from "./composer.js";
import { AudioEngine } from "./score.js";

document.addEventListener("DOMContentLoaded", () => {
  const showcaseGrid = document.getElementById("showcase-grid");
  const audioEngine = new AudioEngine();
  const cursorRig = new CursorRig(document.body);
  const activeAnimationHandles = new Map();

  // Initialize Showcase Grid with 12 Distinct Identities
  if (showcaseGrid) {
    showcaseGrid.innerHTML = "";
    SHOWCASE_SAMPLES.forEach((sample, index) => {
      const card = document.createElement("div");
      card.className =
        "showcase-card rounded-2xl overflow-hidden border border-white/10 bg-slate-900/60 p-5 hover:border-blue-500/40 transition-all duration-300";
      card.innerHTML = `
        <div class="aspect-video relative rounded-xl overflow-hidden bg-slate-950 border border-white/5 mb-4 group">
          <canvas id="canvas-reel-${index}" class="w-full h-full object-cover" width="640" height="360"></canvas>
          <div class="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-4">
            <span class="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
              ${sample.duration} • ${sample.aesthetic}
            </span>
          </div>
        </div>
        <h3 class="text-lg font-bold text-white mb-1">${sample.title}</h3>
        <p class="text-xs text-slate-400 line-clamp-2">${sample.description}</p>
      `;
      showcaseGrid.appendChild(card);
    });

    // Zero-Lag IntersectionObserver with active RAF teardown
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const canvas = entry.target.querySelector("canvas");
          if (!canvas) return;
          const canvasId = canvas.id;

          if (entry.isIntersecting) {
            canvas.dataset.playing = "true";
            if (!activeAnimationHandles.has(canvasId)) {
              startCanvasLoop(canvas, canvasId, activeAnimationHandles);
            }
          } else {
            canvas.dataset.playing = "false";
            const handle = activeAnimationHandles.get(canvasId);
            if (handle) {
              cancelAnimationFrame(handle);
              activeAnimationHandles.delete(canvasId);
            }
          }
        });
      },
      { threshold: 0.15 },
    );

    document.querySelectorAll(".showcase-card").forEach((el) => observer.observe(el));
  }

  // Interactive URL Generation Form
  const launchForm = document.getElementById("launch-form");
  if (launchForm) {
    launchForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const input = document.getElementById("target-url");
      const url = input?.value || "https://linear.app";

      audioEngine.playFoley("ui_tick");
      cursorRig.click("#generate-btn");

      console.log(`[SnapMySite] Launching autonomous direction for ${url}...`);
    });
  }
});

function startCanvasLoop(canvas, id, handlesMap) {
  const ctx = canvas.getContext("2d");
  let frame = 0;

  const loop = () => {
    if (canvas.dataset.playing !== "true") {
      handlesMap.delete(id);
      return;
    }
    frame++;

    // High performance procedural motion demo preview
    ctx.fillStyle = "#090d16";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Glowing motion grid
    ctx.strokeStyle = "rgba(59, 130, 246, 0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }

    // Dynamic wave
    ctx.beginPath();
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 3;
    for (let x = 0; x < canvas.width; x += 5) {
      const y = canvas.height / 2 + Math.sin((x + frame * 3) * 0.02) * 40;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    const handle = requestAnimationFrame(loop);
    handlesMap.set(id, handle);
  };

  const initialHandle = requestAnimationFrame(loop);
  handlesMap.set(id, initialHandle);
}
