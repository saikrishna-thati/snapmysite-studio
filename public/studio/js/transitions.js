// Snapmy.site transition library.
// Every transition is a hand-tuned generator with named variants (direction,
// ease, blur, depth). Each entry emits GSAP code for the cut at time T between
// the outgoing scene O and the incoming scene I (both CSS selectors).
//
// Timing contract with the composer:
//  - the incoming scene becomes visible `lead` seconds before T (max 0.3);
//  - the outgoing scene stays visible until about T + 0.3, so every outgoing
//    tween here finishes by T + 0.25;
//  - the incoming scene sits above the outgoing one (higher z-index), so
//    reveals clip or move the incoming scene rather than uncovering it.

const J = (v) => JSON.stringify(v);
const r3 = (n) => Math.round(n * 1000) / 1000;
const NI = "immediateRender:false";

// Easing vocabulary shared by all generators.
const EASE = {
  soft: { in: "power2.in", out: "power3.out", io: "power2.inOut" },
  hard: { in: "power4.in", out: "expo.out", io: "expo.inOut" },
  snap: { in: "power3.in", out: "back.out(1.6)", io: "power4.inOut" },
};

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};

/* ---------------- overlay layers ---------------- */
// Extra effect layers some transitions animate. The composer drops this markup
// into its #fx container and the CSS into its stylesheet.
export function transitionOverlayHtml() {
  const streaks = Array.from({ length: 14 }, (_, i) => `<i style="--i:${i}"></i>`).join("");
  const bars = Array.from({ length: 8 }, () => "<i></i>").join("");
  return `<div id="fx-dip"></div><div id="fx-sweep"></div><div id="fx-streak">${streaks}</div><div id="fx-hbars">${bars}</div><div id="fx-letterbox"><i></i><i></i></div>`;
}

export function transitionOverlayCss(P = {}) {
  const accent = P.accent || "#4f46e5";
  const second = P.second || accent;
  return `
#fx-dip{position:absolute;inset:0;background:#000;opacity:0;pointer-events:none}
#fx-sweep{position:absolute;inset:-10% -60%;opacity:0;pointer-events:none;background:linear-gradient(100deg,transparent 30%,${accent} 44%,${second} 56%,transparent 70%);filter:blur(6px)}
#fx-streak{position:absolute;inset:0;opacity:0;pointer-events:none;overflow:hidden}
#fx-streak i{position:absolute;left:50%;top:50%;width:160%;height:calc(2px + (var(--i) * 0.35px));margin-left:-80%;background:linear-gradient(90deg,transparent,${accent} 35%,#fff 50%,${second} 65%,transparent);transform:rotate(calc(var(--i) * 12.86deg)) scaleX(0);opacity:.85;filter:blur(1px)}
#fx-hbars{position:absolute;inset:0;display:flex;flex-direction:column;pointer-events:none}
#fx-hbars i{flex:1;background:var(--field,${accent});transform:scaleX(0)}
#fx-hbars i:nth-child(even){background:${second}}
#fx-letterbox{position:absolute;inset:0;pointer-events:none}
#fx-letterbox i{position:absolute;left:0;right:0;height:50%;background:#000;transform:scaleY(0)}
#fx-letterbox i:first-child{top:0;transform-origin:50% 0}
#fx-letterbox i:last-child{bottom:0;transform-origin:50% 100%}
`;
}

/* ---------------- generators ---------------- */
// Each generator: (O, I, T, ctx, v) => string[] of GSAP calls, where v is the
// variant's parameters.

const G = {
  // Straight cut, optionally with a punch-in or a short shake on the incoming shot.
  cut(O, I, T, ctx, v) {
    if (v.mode === "punch") return [`tl.fromTo(${J(I)},{scale:1.12},{scale:1,duration:.45,ease:"expo.out",${NI}},${r3(T)});`];
    if (v.mode === "shake") {
      const k = [[14, -8], [-10, 6], [6, -3], [0, 0]];
      return k.map(([x, y], i) => `tl.set(${J(I)},{x:${x},y:${y}},${r3(T + i * 0.035)});`);
    }
    return [`tl.fromTo(${J(I)},{scale:1.04},{scale:1,duration:.5,ease:"expo.out",${NI}},${r3(T)});`];
  },

  // Fast pan with motion blur, the classic whip.
  whip(O, I, T, { W, H }, v) {
    const d = DIRS[v.dir], b = v.blur;
    const ox = Math.round(-d.x * W * 0.45), oy = Math.round(-d.y * H * 0.45);
    return [
      `tl.fromTo(${J(O)},{x:0,y:0,filter:"blur(0px)"},{x:${ox},y:${oy},filter:"blur(${b}px)",duration:.18,ease:"power3.in",${NI}},${r3(T - 0.18)});`,
      `tl.fromTo(${J(I)},{x:${-ox},y:${-oy},filter:"blur(${b}px)"},{x:0,y:0,filter:"blur(0px)",duration:.34,ease:"expo.out",${NI}},${r3(T - 0.02)});`,
    ];
  },

  // Whip combined with a scale change: the camera snaps and pushes at once.
  whipZoom(O, I, T, { W, H }, v) {
    const d = DIRS[v.dir];
    const ox = Math.round(-d.x * W * 0.35), oy = Math.round(-d.y * H * 0.35);
    return [
      `tl.fromTo(${J(O)},{x:0,y:0,scale:1,filter:"blur(0px)"},{x:${ox},y:${oy},scale:1.25,filter:"blur(14px)",duration:.2,ease:"power3.in",${NI}},${r3(T - 0.2)});`,
      `tl.fromTo(${J(I)},{x:${-ox},y:${-oy},scale:.8,filter:"blur(14px)"},{x:0,y:0,scale:1,filter:"blur(0px)",duration:.4,ease:"expo.out",${NI}},${r3(T - 0.02)});`,
    ];
  },

  // Zoom through the outgoing shot (in) or pull back out of it (out).
  zoom(O, I, T, ctx, v) {
    const b = v.blur;
    if (v.mode === "out") {
      return [
        `tl.fromTo(${J(O)},{scale:1,opacity:1,filter:"blur(0px)"},{scale:.6,opacity:0,filter:"blur(${b}px)",duration:.26,ease:"power3.in",${NI}},${r3(T - 0.24)});`,
        `tl.fromTo(${J(I)},{scale:1.5,filter:"blur(${b}px)"},{scale:1,filter:"blur(0px)",duration:.46,ease:"expo.out",${NI}},${r3(T - 0.04)});`,
      ];
    }
    return [
      `tl.fromTo(${J(O)},{scale:1,opacity:1,filter:"blur(0px)"},{scale:1.8,opacity:0,filter:"blur(${b}px)",duration:.26,ease:"power3.in",${NI}},${r3(T - 0.24)});`,
      `tl.fromTo(${J(I)},{scale:.7,filter:"blur(${b}px)"},{scale:1,filter:"blur(0px)",duration:.46,ease:"expo.out",${NI}},${r3(T - 0.04)});`,
    ];
  },

  // Soft cross-dissolve, optionally through blur.
  dissolve(O, I, T, ctx, v) {
    const dur = v.speed;
    const blur = v.blur ? `filter:"blur(${v.blur}px)",` : "";
    const blurTo = v.blur ? `filter:"blur(0px)",` : "";
    return [
      `tl.fromTo(${J(I)},{opacity:0,${blur}scale:${v.scale || 1}},{opacity:1,${blurTo}scale:1,duration:${dur},ease:"sine.inOut",${NI}},${r3(T - Math.min(0.3, dur / 2))});`,
    ];
  },

  // Hard-edged or feathered linear wipe in one of four directions.
  wipe(O, I, T, { W }, v) {
    const from = { left: "inset(0% 0% 0% 100%)", right: "inset(0% 100% 0% 0%)", up: "inset(100% 0% 0% 0%)", down: "inset(0% 0% 100% 0%)" }[v.dir];
    const d = DIRS[v.dir];
    const L = [`tl.fromTo(${J(I)},{clipPath:"${from}"},{clipPath:"inset(0% 0% 0% 0%)",duration:.4,ease:"${EASE[v.ease].io}",${NI}},${r3(T - 0.2)});`];
    if (v.drift) L.push(`tl.fromTo(${J(O)},{x:0,y:0},{x:${Math.round(d.x * W * 0.12)},y:${Math.round(d.y * W * 0.07)},duration:.4,ease:"${EASE[v.ease].io}",${NI}},${r3(T - 0.2)});`);
    return L;
  },

  // Diagonal wipe from one corner.
  diagonal(O, I, T, ctx, v) {
    const polys = {
      tl: ["polygon(0% 0%,0% 0%,0% 0%)", "polygon(0% 0%,220% 0%,0% 220%)"],
      tr: ["polygon(100% 0%,100% 0%,100% 0%)", "polygon(100% 0%,100% 220%,-120% 0%)"],
      bl: ["polygon(0% 100%,0% 100%,0% 100%)", "polygon(0% 100%,0% -120%,220% 100%)"],
      br: ["polygon(100% 100%,100% 100%,100% 100%)", "polygon(100% 100%,-120% 100%,100% -120%)"],
    }[v.corner];
    return [`tl.fromTo(${J(I)},{clipPath:"${polys[0]}"},{clipPath:"${polys[1]}",duration:.46,ease:"expo.inOut",${NI}},${r3(T - 0.22)});`];
  },

  // Circular iris opening from a point, or closing on the outgoing shot.
  iris(O, I, T, ctx, v) {
    if (v.mode === "close") {
      return [
        `tl.fromTo(${J(I)},{opacity:0},{opacity:1,duration:.01,${NI}},${r3(T)});`,
        `tl.fromTo(${J(O)},{clipPath:"circle(75% at 50% 50%)"},{clipPath:"circle(0% at 50% 50%)",duration:.3,ease:"power3.in",${NI}},${r3(T - 0.3)});`,
        `tl.fromTo(${J(I)},{scale:1.15},{scale:1,duration:.5,ease:"expo.out",${NI}},${r3(T)});`,
      ];
    }
    return [
      `tl.fromTo(${J(I)},{clipPath:"circle(0% at ${v.at})"},{clipPath:"circle(150% at ${v.at})",duration:.55,ease:"expo.inOut",${NI}},${r3(T - 0.25)});`,
      `tl.fromTo(${J(O)},{scale:1},{scale:.92,duration:.5,ease:"power2.inOut",${NI}},${r3(T - 0.25)});`,
    ];
  },

  // Soft radial reveal with a feathered edge (liquid mask).
  liquid(O, I, T, ctx, v) {
    return [
      `tl.set(${J(I)},{"--lr":"0%",webkitMaskImage:"radial-gradient(circle at ${v.at}, #000 calc(var(--lr) - 18%), transparent var(--lr))",maskImage:"radial-gradient(circle at ${v.at}, #000 calc(var(--lr) - 18%), transparent var(--lr))"},${r3(T - 0.28)});`,
      `tl.to(${J(I)},{"--lr":"170%",duration:.6,ease:"power2.inOut"},${r3(T - 0.28)});`,
      `tl.set(${J(I)},{webkitMaskImage:"none",maskImage:"none"},${r3(T + 0.33)});`,
    ];
  },

  // Two halves opening like doors.
  doors(O, I, T, ctx, v) {
    const from = v.axis === "v" ? "inset(0% 50% 0% 50%)" : "inset(50% 0% 50% 0%)";
    return [
      `tl.fromTo(${J(I)},{clipPath:"${from}"},{clipPath:"inset(0% 0% 0% 0%)",duration:.46,ease:"expo.inOut",${NI}},${r3(T - 0.22)});`,
      `tl.fromTo(${J(O)},{scale:1},{scale:.94,duration:.46,ease:"power2.inOut",${NI}},${r3(T - 0.22)});`,
    ];
  },

  // Colored bars sweep over the cut (vertical columns or horizontal rows).
  bars(O, I, T, ctx, v) {
    const sel = v.axis === "h" ? "#fx-hbars i" : "#fx-blocks i";
    const prop = v.axis === "h" ? "scaleX" : "scaleY";
    const o1 = v.axis === "h" ? (v.order === "reverse" ? "100% 50%" : "0% 50%") : (v.order === "reverse" ? "50% 0%" : "50% 100%");
    const o2 = v.axis === "h" ? (v.order === "reverse" ? "0% 50%" : "100% 50%") : (v.order === "reverse" ? "50% 100%" : "50% 0%");
    const stagger = v.order === "center" ? `{each:.028,from:"center"}` : v.order === "reverse" ? `{each:.028,from:"end"}` : ".028";
    return [
      `tl.fromTo(${J(sel)},{${prop}:0,transformOrigin:"${o1}"},{${prop}:1,duration:.2,ease:"power3.in",stagger:${stagger},${NI}},${r3(T - 0.3)});`,
      `tl.fromTo(${J(sel)},{${prop}:1,transformOrigin:"${o2}"},{${prop}:0,duration:.28,ease:"power3.out",stagger:${stagger},${NI}},${r3(T + 0.02)});`,
    ];
  },

  // Flash to white, dip through black, or an accent-colored flash.
  flash(O, I, T, ctx, v) {
    const layer = v.tone === "white" ? "#fx-flash" : "#fx-dip";
    const L = [];
    if (v.tone === "accent") L.push(`tl.set("#fx-dip",{background:${J(ctx.P?.accent || "#4f46e5")}},${r3(T - 0.2)});`);
    if (v.tone === "black") L.push(`tl.set("#fx-dip",{background:"#000"},${r3(T - 0.2)});`);
    const up = v.tone === "black" ? 0.18 : 0.12, down = v.tone === "black" ? 0.3 : 0.4;
    L.push(`tl.fromTo(${J(layer)},{opacity:0},{opacity:1,duration:${up},ease:"power2.in",${NI}},${r3(T - up)});`);
    L.push(`tl.to(${J(layer)},{opacity:0,duration:${down},ease:"power2.out"},${r3(T)});`);
    L.push(`tl.fromTo(${J(I)},{scale:1.08},{scale:1,duration:.6,ease:"expo.out",${NI}},${r3(T)});`);
    return L;
  },

  // 3D camera swoop: the shot turns away while the next one swings in.
  swoop(O, I, T, { W, H }, v) {
    const d = DIRS[v.dir];
    const ry = d.x * 55, rx = -d.y * 45;
    const tx = Math.round(-d.x * W * 0.5), ty = Math.round(-d.y * H * 0.5);
    return [
      `tl.fromTo(${J(O)},{rotationY:0,rotationX:0,x:0,y:0,z:0,transformPerspective:1600,filter:"blur(0px)"},{rotationY:${-ry},rotationX:${-rx},x:${tx},y:${ty},z:-400,filter:"blur(6px)",duration:.3,ease:"power3.in",${NI}},${r3(T - 0.28)});`,
      `tl.fromTo(${J(I)},{rotationY:${ry},rotationX:${rx},x:${-tx},y:${-ty},z:-400,transformPerspective:1600,filter:"blur(6px)"},{rotationY:0,rotationX:0,x:0,y:0,z:0,filter:"blur(0px)",duration:.55,ease:"expo.out",${NI}},${r3(T - 0.04)});`,
    ];
  },

  // Card flip around the vertical or horizontal axis.
  flip(O, I, T, ctx, v) {
    const p = v.axis === "x" ? "rotationX" : "rotationY";
    return [
      `tl.fromTo(${J(O)},{${p}:0,transformPerspective:1800},{${p}:90,duration:.22,ease:"power2.in",${NI}},${r3(T - 0.22)});`,
      `tl.set(${J(I)},{opacity:0},${r3(T - 0.24)});`,
      `tl.fromTo(${J(I)},{${p}:-90,opacity:1,transformPerspective:1800},{${p}:0,duration:.42,ease:"back.out(1.4)",${NI}},${r3(T)});`,
    ];
  },

  // Rotating cube: both shots are faces of a box that turns.
  cube(O, I, T, { W, H }, v) {
    const d = DIRS[v.dir];
    const horizontal = d.x !== 0;
    const p = horizontal ? "rotationY" : "rotationX";
    const deg = horizontal ? -d.x * 90 : d.y * 90;
    const origO = horizontal ? (d.x > 0 ? "100% 50%" : "0% 50%") : (d.y > 0 ? "50% 100%" : "50% 0%");
    const origI = horizontal ? (d.x > 0 ? "0% 50%" : "100% 50%") : (d.y > 0 ? "50% 0%" : "50% 100%");
    const tx = Math.round(-d.x * W), ty = Math.round(-d.y * H);
    return [
      `tl.fromTo(${J(O)},{${p}:0,x:0,y:0,transformOrigin:"${origO}",transformPerspective:2200},{${p}:${deg},x:${tx},y:${ty},duration:.5,ease:"power3.inOut",${NI}},${r3(T - 0.25)});`,
      `tl.fromTo(${J(I)},{${p}:${-deg},x:${-tx},y:${-ty},transformOrigin:"${origI}",transformPerspective:2200},{${p}:0,x:0,y:0,duration:.5,ease:"power3.inOut",${NI}},${r3(T - 0.25)});`,
    ];
  },

  // Page roll: the shot tumbles away over its bottom or top edge.
  roll(O, I, T, { H }, v) {
    const sgn = v.dir === "down" ? 1 : -1;
    return [
      `tl.fromTo(${J(O)},{rotationX:0,y:0,transformOrigin:"50% ${sgn > 0 ? 100 : 0}%",transformPerspective:1400},{rotationX:${-sgn * 70},y:${Math.round(sgn * H * 0.3)},opacity:0,duration:.3,ease:"power3.in",${NI}},${r3(T - 0.28)});`,
      `tl.fromTo(${J(I)},{rotationX:${sgn * 30},y:${Math.round(-sgn * H * 0.15)},transformOrigin:"50% ${sgn > 0 ? 0 : 100}%",transformPerspective:1400},{rotationX:0,y:0,duration:.5,ease:"expo.out",${NI}},${r3(T - 0.04)});`,
    ];
  },

  // Rotation plus scale, spinning into the next shot.
  spin(O, I, T, ctx, v) {
    const s = v.dir === "cw" ? 1 : -1;
    return [
      `tl.fromTo(${J(O)},{rotation:0,scale:1,opacity:1},{rotation:${s * 25},scale:1.5,opacity:0,filter:"blur(8px)",duration:.26,ease:"power3.in",${NI}},${r3(T - 0.24)});`,
      `tl.fromTo(${J(I)},{rotation:${-s * 25},scale:.6,filter:"blur(8px)"},{rotation:0,scale:1,filter:"blur(0px)",duration:.5,ease:"expo.out",${NI}},${r3(T - 0.04)});`,
    ];
  },

  // Elastic slide: the incoming shot stretches along its travel then settles.
  stretch(O, I, T, { W, H }, v) {
    const d = DIRS[v.dir];
    const horiz = d.x !== 0;
    const k = horiz ? "scaleX" : "scaleY";
    const from = horiz ? `x:${Math.round(d.x * W)}` : `y:${Math.round(d.y * H)}`;
    const to = horiz ? "x:0" : "y:0";
    const origin = horiz ? (d.x > 0 ? "0% 50%" : "100% 50%") : (d.y > 0 ? "50% 0%" : "50% 100%");
    return [
      `tl.fromTo(${J(I)},{${from},${k}:1.6,transformOrigin:"${origin}"},{${to},${k}:1,duration:.55,ease:"elastic.out(1,0.75)",${NI}},${r3(T - 0.12)});`,
      `tl.fromTo(${J(O)},{${k}:1},{${k}:.7,opacity:.4,duration:.2,ease:"power3.in",${NI}},${r3(T - 0.12)});`,
    ];
  },

  // Glitch: RGB split jitter, or horizontal slice offsets.
  glitch(O, I, T, ctx, v) {
    const L = [];
    if (v.mode === "slice") {
      const cuts = ["inset(0% 0% 70% 0%)", "inset(30% 0% 40% 0%)", "inset(60% 0% 10% 0%)", "inset(0% 0% 0% 0%)"];
      cuts.forEach((c, k) => L.push(`tl.set(${J(I)},{clipPath:${J(c)},x:${k % 2 ? -40 : 40}},${r3(T - 0.1 + k * 0.04)});`));
      L.push(`tl.set(${J(I)},{x:0},${r3(T + 0.07)});`);
    } else {
      const offs = [[-38, 14], [52, -10], [-18, 26], [0, 0]];
      offs.forEach(([a, b], k) => L.push(`tl.set(${J(k < 2 ? O : I)},{x:${a},y:${b},filter:${J(k === 3 ? "none" : `hue-rotate(${60 + k * 70}deg) saturate(2.2)`)}},${r3(T - 0.12 + k * 0.045)});`));
    }
    L.push(`tl.fromTo("#fx-glitch",{opacity:0},{opacity:1,duration:.02,${NI}},${r3(T - 0.12)});`);
    L.push(`tl.set("#fx-glitch",{backgroundPosition:"0px 37px"},${r3(T - 0.07)});`);
    L.push(`tl.set("#fx-glitch",{opacity:0},${r3(T + 0.08)});`);
    return L;
  },

  // Light-streak fly-through: radial light burst while the camera punches in.
  streak(O, I, T, ctx, v) {
    const L = [
      `tl.fromTo("#fx-streak",{opacity:0},{opacity:1,duration:.1,${NI}},${r3(T - 0.2)});`,
      `tl.fromTo("#fx-streak i",{scaleX:0},{scaleX:1,duration:.3,ease:"power3.out",stagger:{each:.012,from:"random"},${NI}},${r3(T - 0.2)});`,
      `tl.to("#fx-streak",{opacity:0,duration:.3,ease:"power2.out"},${r3(T + 0.08)});`,
      `tl.fromTo(${J(O)},{scale:1,filter:"blur(0px) brightness(1)"},{scale:1.6,filter:"blur(10px) brightness(1.6)",duration:.22,ease:"power3.in",${NI}},${r3(T - 0.2)});`,
      `tl.fromTo(${J(I)},{scale:${v.mode === "out" ? 1.4 : 0.7},filter:"blur(10px) brightness(1.6)"},{scale:1,filter:"blur(0px) brightness(1)",duration:.5,ease:"expo.out",${NI}},${r3(T)});`,
    ];
    if (v.flash) L.splice(3, 0, `tl.fromTo("#fx-flash",{opacity:0},{opacity:.8,duration:.08,${NI}},${r3(T - 0.06)});`, `tl.to("#fx-flash",{opacity:0,duration:.3},${r3(T + 0.02)});`);
    return L;
  },

  // A brand-gradient band sweeps across and reveals the next shot behind it.
  sweep(O, I, T, { W, H }, v) {
    const d = DIRS[v.dir];
    const fromX = Math.round(-d.x * W * 1.4), toX = Math.round(d.x * W * 1.4);
    const fromY = Math.round(-d.y * H * 1.4), toY = Math.round(d.y * H * 1.4);
    const clip = { right: "inset(0% 100% 0% 0%)", left: "inset(0% 0% 0% 100%)", down: "inset(0% 0% 100% 0%)", up: "inset(100% 0% 0% 0%)" }[v.dir];
    return [
      `tl.fromTo("#fx-sweep",{opacity:1,x:${fromX},y:${fromY},rotation:${d.y ? 90 : 0}},{x:${toX},y:${toY},duration:.6,ease:"power2.inOut",${NI}},${r3(T - 0.3)});`,
      `tl.set("#fx-sweep",{opacity:0},${r3(T + 0.31)});`,
      `tl.fromTo(${J(I)},{clipPath:"${clip}"},{clipPath:"inset(0% 0% 0% 0%)",duration:.6,ease:"power2.inOut",${NI}},${r3(T - 0.3)});`,
    ];
  },

  // Gentle scale-and-fade used for calm, premium cuts.
  scaleFade(O, I, T, ctx, v) {
    const s = v.mode === "up" ? 0.94 : 1.06;
    return [
      `tl.fromTo(${J(O)},{scale:1,opacity:1},{scale:${v.mode === "up" ? 1.04 : 0.96},opacity:0,duration:.3,ease:"power2.in",${NI}},${r3(T - 0.28)});`,
      `tl.fromTo(${J(I)},{scale:${s},opacity:0},{scale:1,opacity:1,duration:.5,ease:"power3.out",${NI}},${r3(T - 0.12)});`,
    ];
  },

  // Rack focus: defocus out, then pull the next shot into focus.
  focus(O, I, T, ctx, v) {
    return [
      `tl.fromTo(${J(O)},{filter:"blur(0px)"},{filter:"blur(${v.blur}px)",duration:.26,ease:"power2.in",${NI}},${r3(T - 0.26)});`,
      `tl.fromTo(${J(I)},{opacity:0,filter:"blur(${v.blur}px)",scale:${v.scale}},{opacity:1,filter:"blur(0px)",scale:1,duration:.55,ease:"power3.out",${NI}},${r3(T - 0.14)});`,
    ];
  },

  // Dolly-zoom (vertigo): the frame compresses while the subject holds.
  vertigo(O, I, T) {
    return [
      `tl.fromTo(${J(O)},{scale:1,transformPerspective:900,z:0},{scale:1.35,z:-300,filter:"blur(4px)",duration:.3,ease:"power2.in",${NI}},${r3(T - 0.28)});`,
      `tl.fromTo(${J(I)},{scale:.8,z:200,transformPerspective:900,filter:"blur(4px)"},{scale:1,z:0,filter:"blur(0px)",duration:.5,ease:"expo.out",${NI}},${r3(T - 0.02)});`,
    ];
  },

  // Cinematic letterbox: bars close on the cut and open on the new shot.
  letterbox(O, I, T) {
    return [
      `tl.fromTo("#fx-letterbox i",{scaleY:0},{scaleY:1,duration:.22,ease:"power3.in",${NI}},${r3(T - 0.22)});`,
      `tl.to("#fx-letterbox i",{scaleY:0,duration:.36,ease:"expo.out"},${r3(T + 0.02)});`,
      `tl.fromTo(${J(I)},{scale:1.06},{scale:1,duration:.6,ease:"expo.out",${NI}},${r3(T)});`,
    ];
  },
};

// Both shots travel together; the incoming one pushes the outgoing one out.
G.slide = (O, I, T, { W, H }, v) => {
  const d = DIRS[v.dir], e = EASE[v.ease], dur = v.ease === "hard" ? 0.42 : 0.5;
  const s = T - dur / 2;
  const k = v.parallax ? 0.35 : 1;
  const outX = Math.round(-d.x * W * k), outY = Math.round(-d.y * H * k);
  const inX = Math.round(d.x * W), inY = Math.round(d.y * H);
  return [
    `tl.fromTo(${J(O)},{x:0,y:0${v.parallax ? ',filter:"brightness(1)"' : ""}},{x:${outX},y:${outY},${v.parallax ? 'filter:"brightness(.5)",' : ""}duration:${dur},ease:"${e.io}",${NI}},${r3(s)});`,
    `tl.fromTo(${J(I)},{x:${inX},y:${inY}},{x:0,y:0,duration:${dur},ease:"${e.io}",${NI}},${r3(s)});`,
  ];
};

/* ---------------- catalogue ---------------- */
// energy: 1 calm · 2 medium · 3 punchy. lead: seconds the incoming shot is
// visible before the cut. sfx: sample the score engine plays on the cut.

const CATALOG = [];
const add = (id, gen, v, meta) => CATALOG.push({ id, gen, v, family: gen, ...meta });
const dirs = ["left", "right", "up", "down"];

add("cut", "cut", { mode: "clean" }, { label: "Cut", energy: 1, lead: 0, sfx: null });
add("cut-punch", "cut", { mode: "punch" }, { label: "Punch cut", energy: 3, lead: 0, sfx: "kick_sub" });
add("cut-shake", "cut", { mode: "shake" }, { label: "Shake cut", energy: 3, lead: 0, sfx: "boom" });

for (const dir of dirs) for (const ease of ["soft", "hard"]) add(`slide-${dir}-${ease}`, "slide", { dir, ease }, { label: `Slide ${dir} (${ease})`, energy: ease === "hard" ? 2 : 1, lead: ease === "hard" ? 0.21 : 0.25, sfx: "swoosh_mid" });
for (const dir of dirs) add(`parallax-${dir}`, "slide", { dir, ease: "soft", parallax: true }, { label: `Parallax push ${dir}`, energy: 1, lead: 0.25, sfx: "swoosh_low" });
for (const dir of dirs) for (const blur of [10, 22]) add(`whip-${dir}${blur > 10 ? "-heavy" : ""}`, "whip", { dir, blur }, { label: `Whip ${dir}${blur > 10 ? " (heavy blur)" : ""}`, energy: 3, lead: 0.02, sfx: "swoosh_fast" });
for (const dir of dirs) add(`whipzoom-${dir}`, "whipZoom", { dir }, { label: `Whip zoom ${dir}`, energy: 3, lead: 0.02, sfx: "swoosh_fast" });
for (const [mode, blur] of [["in", 4], ["in", 10], ["in", 18], ["out", 4], ["out", 10], ["out", 18]]) add(`zoom-${mode}-${blur}`, "zoom", { mode, blur }, { label: `Zoom ${mode} (blur ${blur})`, energy: blur > 10 ? 3 : 2, lead: 0.04, sfx: mode === "in" ? "swoosh_air" : "swoosh_low" });
for (const [speed, blur, scale] of [[0.4, 0, 1], [0.6, 0, 1], [0.5, 8, 1.03], [0.7, 14, 1.05], [0.5, 6, 0.97]]) add(`dissolve-${Math.round(speed * 10)}${blur ? `-blur${blur}` : ""}${scale !== 1 ? `-s${Math.round(scale * 100)}` : ""}`, "dissolve", { speed, blur, scale }, { label: `Dissolve ${speed}s${blur ? ` with blur` : ""}`, energy: 1, lead: Math.min(0.3, speed / 2), sfx: blur ? "swoosh_low" : null });
for (const dir of dirs) for (const ease of ["soft", "hard"]) add(`wipe-${dir}-${ease}`, "wipe", { dir, ease, drift: ease === "soft" }, { label: `Wipe ${dir} (${ease})`, energy: 2, lead: 0.2, sfx: "swoosh_mid" });
for (const corner of ["tl", "tr", "bl", "br"]) add(`diagonal-${corner}`, "diagonal", { corner }, { label: `Diagonal wipe from ${corner}`, energy: 2, lead: 0.22, sfx: "swoosh_mid" });
for (const [name, at] of [["center", "50% 50%"], ["tl", "10% 12%"], ["tr", "90% 12%"], ["bl", "10% 88%"], ["br", "90% 88%"]]) add(`iris-${name}`, "iris", { at }, { label: `Iris open from ${name}`, energy: 2, lead: 0.25, sfx: "swoosh_low" });
add("iris-close", "iris", { mode: "close" }, { label: "Iris close", energy: 2, lead: 0, sfx: "swoosh_air" });
for (const [name, at] of [["center", "50% 50%"], ["left", "0% 50%"], ["right", "100% 50%"], ["bottom", "50% 100%"]]) add(`liquid-${name}`, "liquid", { at }, { label: `Liquid reveal from ${name}`, energy: 1, lead: 0.28, sfx: "swoosh_air" });
add("doors-vertical", "doors", { axis: "v" }, { label: "Doors open (vertical)", energy: 2, lead: 0.22, sfx: "swoosh_mid" });
add("doors-horizontal", "doors", { axis: "h" }, { label: "Doors open (horizontal)", energy: 2, lead: 0.22, sfx: "swoosh_mid" });
for (const axis of ["v", "h"]) for (const order of ["forward", "reverse", "center"]) add(`bars-${axis}-${order}`, "bars", { axis, order }, { label: `${axis === "v" ? "Column" : "Row"} bars (${order})`, energy: 3, lead: 0, sfx: "swoosh_fast", overlay: true });
for (const tone of ["white", "black", "accent"]) add(`flash-${tone}`, "flash", { tone }, { label: `${tone === "black" ? "Dip to black" : `Flash ${tone}`}`, energy: tone === "black" ? 1 : 3, lead: 0, sfx: tone === "black" ? null : "rev_glass" });
for (const dir of dirs) add(`swoop-${dir}`, "swoop", { dir }, { label: `3D swoop ${dir}`, energy: 3, lead: 0.04, sfx: "swoosh_air" });
add("flip-y", "flip", { axis: "y" }, { label: "Card flip (vertical axis)", energy: 2, lead: 0.24, sfx: "swoosh_fast" });
add("flip-x", "flip", { axis: "x" }, { label: "Card flip (horizontal axis)", energy: 2, lead: 0.24, sfx: "swoosh_fast" });
for (const dir of dirs) add(`cube-${dir}`, "cube", { dir }, { label: `Cube turn ${dir}`, energy: 2, lead: 0.25, sfx: "swoosh_mid" });
add("roll-down", "roll", { dir: "down" }, { label: "Roll away down", energy: 2, lead: 0.04, sfx: "swoosh_low" });
add("roll-up", "roll", { dir: "up" }, { label: "Roll away up", energy: 2, lead: 0.04, sfx: "swoosh_low" });
add("spin-cw", "spin", { dir: "cw" }, { label: "Spin zoom clockwise", energy: 3, lead: 0.04, sfx: "swoosh_fast" });
add("spin-ccw", "spin", { dir: "ccw" }, { label: "Spin zoom counter-clockwise", energy: 3, lead: 0.04, sfx: "swoosh_fast" });
for (const dir of dirs) add(`stretch-${dir}`, "stretch", { dir }, { label: `Elastic stretch ${dir}`, energy: 3, lead: 0.12, sfx: "swoosh_fast" });
add("glitch-rgb", "glitch", { mode: "rgb" }, { label: "Glitch RGB split", energy: 3, lead: 0.03, sfx: "glitch", overlay: true });
add("glitch-slice", "glitch", { mode: "slice" }, { label: "Glitch slices", energy: 3, lead: 0.1, sfx: "glitch", overlay: true });
for (const [mode, flash] of [["in", false], ["in", true], ["out", false]]) add(`streak-${mode}${flash ? "-flash" : ""}`, "streak", { mode, flash }, { label: `Light streak ${mode}${flash ? " with flash" : ""}`, energy: 3, lead: 0, sfx: "riser" });
for (const dir of dirs) add(`sweep-${dir}`, "sweep", { dir }, { label: `Brand sweep ${dir}`, energy: 2, lead: 0.3, sfx: "swoosh_mid" });
add("scalefade-up", "scaleFade", { mode: "up" }, { label: "Scale fade in", energy: 1, lead: 0.12, sfx: null });
add("scalefade-down", "scaleFade", { mode: "down" }, { label: "Scale fade out", energy: 1, lead: 0.12, sfx: null });
for (const [blur, scale] of [[12, 1.04], [24, 1.08]]) add(`focus-${blur}`, "focus", { blur, scale }, { label: `Rack focus (${blur}px)`, energy: 1, lead: 0.14, sfx: "swoosh_low" });
add("vertigo", "vertigo", {}, { label: "Dolly zoom", energy: 2, lead: 0.02, sfx: "swoosh_air" });
add("letterbox", "letterbox", {}, { label: "Letterbox close", energy: 2, lead: 0, sfx: "snap" });

// Names the older composer and saved plans used; each maps to a catalogue entry.
const ALIASES = { whip: "whip-left", zoom: "zoom-in-10", flash: "flash-white", wipe: "wipe-left-soft", iris: "iris-center", push: "slide-up-soft", glitch: "glitch-rgb", blocks: "bars-v-forward" };

export const TRANSITIONS = Object.fromEntries(CATALOG.map((t) => [t.id, t]));
export const TRANSITION_IDS = CATALOG.map((t) => t.id);

export function resolveTransition(id) {
  return TRANSITIONS[id] || TRANSITIONS[ALIASES[id]] || TRANSITIONS.cut;
}

export function transitionLead(id) {
  return Math.min(0.3, resolveTransition(id).lead || 0);
}

export function transitionSfx(id) {
  return resolveTransition(id).sfx || null;
}

export function transitionCodeFor(id, O, I, T, ctx) {
  const t = resolveTransition(id);
  return G[t.gen](O, I, T, ctx, t.v);
}

/* ---------------- selection ---------------- */
// Which families suit each motion character. The planner draws from these,
// weighted by the energy a cut needs, and never repeats a family back to back.
const FAMILY_SETS = {
  precision: ["slide", "zoom", "cut", "wipe", "scaleFade", "focus"],
  editorial: ["wipe", "iris", "slide", "dissolve", "liquid", "doors", "letterbox"],
  signal: ["glitch", "flash", "zoom", "whip", "bars", "streak"],
  glass: ["iris", "zoom", "liquid", "focus", "swoop", "dissolve", "sweep"],
  orbit: ["whip", "swoop", "cube", "spin", "zoom", "roll"],
  product: ["wipe", "slide", "cut", "sweep", "flip", "scaleFade"],
  kinetic: ["whip", "whipZoom", "flash", "bars", "stretch", "cut", "spin"],
  quiet: ["dissolve", "iris", "scaleFade", "focus", "liquid", "cut"],
  neon: ["glitch", "whip", "bars", "streak", "whipZoom", "flash"],
  launch: ["zoom", "flash", "whip", "streak", "swoop", "vertigo", "cube"],
};

const INTENT_ENERGY = { impact: 3, commit: 3, reveal: 2, glide: 1, focus: 2, match: 2, soar: 3, unveil: 2, scan: 1, compare: 2 };

/**
 * Picks a transition id for a cut.
 * opts: { family (motion character key), intent, curType, rand, recent: string[] of recent ids, allowOverlay, exclude: families to skip }
 */
export function pickTransition(opts = {}) {
  const { family = "product", intent, curType, rand = Math.random, recent = [], allowOverlay = true, exclude = [] } = opts;
  const r = typeof rand === "function" ? rand : () => rand.next();
  if (curType === "endcard" || curType === "logos") return r() < 0.5 ? "dissolve-6" : "scalefade-up";
  if (curType === "quote") return r() < 0.5 ? "dissolve-5-blur8-s103" : "focus-12";
  const want = INTENT_ENERGY[intent] || 2;
  const fams = (FAMILY_SETS[family] || FAMILY_SETS.product).filter((f) => !exclude.includes(f));
  const recentFams = recent.slice(-2).map((id) => resolveTransition(id).family);
  const pool = CATALOG.filter((t) => fams.includes(t.family) && !recentFams.includes(t.family) && !recent.includes(t.id) && (allowOverlay || !t.overlay));
  const candidates = pool.length ? pool : CATALOG.filter((t) => fams.includes(t.family));
  // Weight entries whose energy matches the cut; neighbours still get a chance.
  const weights = candidates.map((t) => (t.energy === want ? 4 : Math.abs(t.energy - want) === 1 ? 1.5 : 0.4));
  let x = r() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < candidates.length; i++) { x -= weights[i]; if (x <= 0) return candidates[i].id; }
  return candidates[candidates.length - 1].id;
}
