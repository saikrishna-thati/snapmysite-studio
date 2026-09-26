// Direction layer: read a site into evidence, then turn that evidence into a
// grounded story plan. Provider keys remain optional browser configuration;
// only an explicit, non-secret brief is sent to a direction provider.
import { API } from "./config.js";
import { SCENE_TYPES, STYLES, resolveMotionVariation } from "./composer.js";
import { TRANSITION_IDS } from "./transitions.js";

// Legacy names plus every id in the transition library are accepted from a plan.
const TRANSITIONS = ["whip", "zoom", "flash", "wipe", "iris", "push", "glitch", "blocks", "cut", ...TRANSITION_IDS];
const INTERACTIONS = ["hover", "click", "scroll", "tab", "toggle", "modal", "none"];
const MEDIA_TYPES = new Set(["screen", "scroll", "split"]);
const GENERIC_CTA = /^(get started|try it(?: free| today)?|learn more|sign up|join now|click here|submit|continue)$/i;

const ROLE_RULES = [
  ["pricing", /\b(pricing|plans|packages|cost|buy|checkout)\b/i],
  ["proof", /\b(customers?|case studies|testimonials?|trusted|reviews?|stories|results?)\b/i],
  ["result", /\b(results?|report|output|insights?|analytics?|dashboard|summary)\b/i],
  ["workflow", /\b(workflow|how it works|demo|editor|workspace|upload|builder|create|automate|integrat|platform|product|features?)\b/i],
  ["docs", /\b(docs?|documentation|guides?|api|developers?|changelog|reference)\b/i],
  ["about", /\b(about|company|team|mission|careers?|contact)\b/i],
  ["editorial", /\b(journal|blog|news|stories|insights?|magazine)\b/i],
];

const ACTION_WORDS = /\b(start|try|book|request|join|sign|learn|explore|discover|watch|see|view|buy|shop|download|create|build|launch|find|meet|contact|talk|subscribe|listen|tune|make|open|use)\b/i;

const text = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const clean = (value, max = 240) => text(value).replace(/^[—–-]\s*/, "").slice(0, max).trim();
const unique = (values) => [...new Set(values.filter(Boolean).map(text))];
const arrayOf = (value) => Array.isArray(value) ? value : value == null ? [] : [value];
const lower = (value) => text(value).toLowerCase();
const slug = (value) => lower(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "page";

function publicUrl(value) {
  try {
    const u = new URL(String(value));
    if (!/^https?:$/.test(u.protocol)) return "";
    ["key", "token", "secret", "password", "signature", "auth", "api_key", "access_token"].forEach((key) => u.searchParams.delete(key));
    return u.href;
  } catch { return ""; }
}

function pageRoleFor(value, hint = "") {
  const raw = `${value || ""} ${hint || ""}`.toLowerCase();
  try { if (new URL(String(value)).pathname === "/") return "home"; } catch {}
  if (!raw || /\bhome(?:page)?\b/.test(String(hint).toLowerCase())) return "home";
  for (const [role, rule] of ROLE_RULES) if (rule.test(raw)) return role;
  return "page";
}

function assetRoleFor(pageRole, state = "default") {
  if (pageRole === "pricing") return "pricing";
  if (pageRole === "proof") return "proof";
  if (pageRole === "result") return "result";
  if (["workflow", "docs"].includes(pageRole)) return "workflow";
  if (["about", "editorial"].includes(pageRole)) return "brand";
  return state === "fullpage" ? "overview" : "hero";
}

function screenshotUrl(pageUrl, width, height, fullPage = false) {
  const q = new URLSearchParams({
    url: pageUrl,
    screenshot: "true",
    meta: "false",
    embed: "screenshot.url",
    "viewport.width": String(width),
    "viewport.height": String(height),
  });
  if (fullPage) q.set("screenshot.fullPage", "true");
  return `https://api.microlink.io/?${q.toString()}`;
}

function stripMarkdown(value) {
  return clean(String(value || "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#|]/g, "")
    .replace(/\s+/g, " "));
}

function markdownLines(md) {
  return String(md || "").split("\n").map(stripMarkdown).filter(Boolean);
}

function markdownHeadings(md) {
  return String(md || "").split("\n").map((line) => {
    const m = line.match(/^(#{1,6})\s+(.+)$/);
    return m ? { level: m[1].length, text: stripMarkdown(m[2]) } : null;
  }).filter((h) => h && h.text.length > 2 && h.text.length < 140);
}

function extractLinks(md, base) {
  const found = [];
  const add = (label, href) => {
    try {
      const u = new URL(href, base);
      if (u.origin !== new URL(base).origin || !/^https?:$/.test(u.protocol)) return;
      u.hash = "";
      const path = u.pathname.toLowerCase();
      if (/\.(?:png|jpe?g|gif|svg|webp|avif|mp4|webm|pdf|zip)$/i.test(path)) return;
      found.push({ url: u.href, label: clean(label, 100) });
    } catch {}
  };
  for (const m of String(md || "").matchAll(/\[([^\]]{1,100})\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) add(m[1], m[2]);
  for (const m of String(md || "").matchAll(/https?:\/\/[^\s)>]+/g)) add("", m[0].replace(/[.,;]+$/, ""));
  return [...new Map(found.map((x) => [x.url, x])).values()];
}

function selectRouteLinks(links, homeUrl) {
  const home = new URL(homeUrl);
  const scored = links.filter((x) => x.url !== home.href && x.url !== `${home.origin}/`).map((x) => {
    const role = pageRoleFor(x.url, x.label);
    const score = (role === "page" ? 1 : 5) + (x.label ? 1 : 0) + (["workflow", "result", "proof", "pricing"].includes(role) ? 3 : 0);
    return { ...x, role, score };
  }).sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const selected = [];
  const roles = new Set();
  for (const link of scored) {
    if (selected.length >= 5) break;
    if (roles.has(link.role) && link.role !== "page") continue;
    selected.push(link); roles.add(link.role);
  }
  return selected;
}

async function fetchMarkdown(url, timeout = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(`https://r.jina.ai/${url}`, { headers: { Accept: "text/plain" }, signal: ctrl.signal });
    if (!r.ok) return "";
    const body = await r.text();
    return /AuthenticationRequired|error/i.test(body.slice(0, 220)) && body.length < 700 ? "" : body;
  } catch { return ""; }
  finally { clearTimeout(timer); }
}

function extractStats(md) {
  const results = [];
  for (const line of markdownLines(md)) {
    if (!/(%|\b(?:x|k|m|b|ms|s|h|days?|weeks?|users?|teams?|customers?)\b|faster|saved|accuracy|rate|time)/i.test(line)) continue;
    const m = line.match(/([$€£]?\d[\d,.]*(?:\.\d+)?\s*(?:%|x|k|m|b|ms|s|h)?)/i);
    if (!m || !m[1]) continue;
    const value = clean(m[1], 18);
    const label = clean(line.replace(m[1], "").replace(/^[-:|]+|[-:|]+$/g, ""), 64);
    if (label.length > 2) results.push({ value, label });
  }
  return [...new Map(results.map((x) => [x.value.toLowerCase(), x])).values()].slice(0, 6);
}

function extractQuotes(md) {
  return [...new Set(String(md || "").split("\n").filter((line) => /^\s*>/.test(line)).map((line) => clean(line.replace(/^\s*>+\s*/, ""), 180)).filter((line) => line.length > 10))]
    .slice(0, 4).map((quote) => ({ text: quote, author: "" }));
}

function extractImages(md, pageUrl, pageRole) {
  const images = [];
  const add = (alt, src) => {
    const url = publicUrl(src);
    if (!url || images.some((x) => x.url === url)) return;
    images.push({ id: `${slug(pageRole)}-asset-${images.length + 1}`, url, alt: clean(alt, 120), page: pageUrl, role: assetRoleFor(pageRole, "image"), kind: "image", source: "markdown" });
  };
  for (const m of String(md || "").matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) add(m[1], m[2]);
  for (const m of String(md || "").matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)) add("", m[1]);
  return images.slice(0, 24);
}

function extractCtas(lines) {
  return unique(lines.filter((line) => line.length >= 3 && line.length <= 90 && ACTION_WORDS.test(line) && !/^https?:/i.test(line)).map((line) => stripMarkdown(line))).slice(0, 8);
}

function extractLogos(lines) {
  const line = lines.find((x) => /\b(trusted by|used by|customers? include|teams at|backed by)\b/i.test(x));
  if (!line) return [];
  const tail = line.split(/trusted by|used by|customers? include|teams at|backed by/i)[1] || "";
  return unique(tail.split(/[,•·|]|\s{2,}/).map((x) => stripMarkdown(x)).filter((x) => x.length > 1 && x.length < 32)).slice(0, 8);
}

function detectInteractions(md) {
  const source = lower(md);
  const rules = [
    ["upload", /\b(upload|drop files?|drag and drop|import)\b/],
    ["search", /\b(search|find anything|query)\b/],
    ["filter", /\b(filter|sort by|segment)\b/],
    ["editor", /\b(editor|edit|compose|design|canvas|builder)\b/],
    ["toggle", /\b(toggle|switch|enable|disable)\b/],
    ["tab", /\b(tabs?|navigate between|compare views?)\b/],
    ["modal", /\b(modal|dialog|drawer|panel opens?)\b/],
    ["scroll", /\b(scroll|timeline|longform|explore below)\b/],
    ["click", /\b(click|select|choose|start|create|launch)\b/],
  ];
  const hits = rules.filter(([, rule]) => rule.test(source)).map(([interaction]) => interaction);
  return hits.slice(0, 4).map((interaction, i) => ({ interaction, target: "visible product control", order: i + 1, source: "text-inference", confidence: "inferred" }));
}

function parsePage(md, pageUrl, hint = "") {
  const role = pageRoleFor(pageUrl, hint);
  const lines = markdownLines(md);
  const headings = markdownHeadings(md);
  const title = clean((md.match(/^Title:\s*(.+)$/im) || [])[1] || headings[0]?.text || hint || new URL(pageUrl).hostname, 120);
  const headline = clean(headings[0]?.text || title, 120);
  const paragraphs = lines.filter((line) => line.length >= 45 && line.length < 320 && !/^https?:/i.test(line)).slice(0, 10);
  const featureHeads = headings.slice(1, 10).filter((h) => !/^(menu|navigation|footer|contact|subscribe|faq)$/i.test(h.text));
  const features = featureHeads.slice(0, 8).map((h, i) => ({ title: h.text, desc: paragraphs[i + 1] || "", evidence: { page: pageUrl, pageRole: role } }));
  const colors = unique([...String(md || "").matchAll(/#[0-9a-f]{3,8}\b/gi)].map((m) => m[0])).slice(0, 8);
  const images = extractImages(md, pageUrl, role);
  const ctas = extractCtas(lines);
  return {
    url: pageUrl,
    role,
    title,
    headline,
    description: paragraphs[0] || "",
    headings: headings.slice(0, 12).map((h) => h.text),
    features,
    stats: extractStats(md),
    quotes: extractQuotes(md),
    logos: extractLogos(lines),
    colors,
    ctaCandidates: ctas,
    images,
    interactions: detectInteractions(md),
    links: extractLinks(md, pageUrl),
  };
}

function pageAsset(page, kind, viewport, width, height, priority, state = "default") {
  const fullPage = kind === "fullpage";
  const role = assetRoleFor(page.role, state);
  return {
    id: `${slug(page.role)}-${slug(new URL(page.url).pathname)}-${viewport || "page"}-${kind}`,
    url: screenshotUrl(page.url, width, height, fullPage),
    page: page.url,
    pageRole: page.role,
    role,
    kind,
    fullPage,
    viewport,
    width,
    height,
    state,
    priority,
    crop: "full",
    focalPoint: "center",
    safeTextRegions: ["top", "bottom"],
    source: "microlink",
  };
}

function mergePageFacts(pages) {
  const home = pages[0] || {};
  const allFeatures = pages.flatMap((page) => page.features || []);
  const allStats = pages.flatMap((page) => page.stats || []);
  const allQuotes = pages.flatMap((page) => page.quotes || []);
  const allLogos = pages.flatMap((page) => page.logos || []);
  const allCtas = pages.flatMap((page) => page.ctaCandidates || []);
  const allInteractions = pages.flatMap((page) => page.interactions || []);
  const images = pages.flatMap((page) => page.images || []);
  return {
    name: clean((home.title || home.headline || "").split(/[|–—:·]/)[0], 48),
    headline: home.headline || home.title || "",
    description: home.description || "",
    features: [...new Map(allFeatures.filter((x) => x.title).map((x) => [lower(x.title), x])).values()].slice(0, 10),
    stats: [...new Map(allStats.map((x) => [lower(`${x.value}:${x.label}`), x])).values()].slice(0, 8),
    quotes: [...new Map(allQuotes.map((x) => [lower(x.text), x])).values()].slice(0, 4),
    logos: unique(allLogos).slice(0, 8),
    colors: unique(pages.flatMap((page) => page.colors || [])).slice(0, 8),
    ctaCandidates: unique(allCtas).slice(0, 8),
    interactionTrace: allInteractions.slice(0, 4),
    sourceAssets: images.slice(0, 24),
  };
}

function evidenceAssetsFor(pages) {
  const assets = [];
  pages.forEach((page, index) => {
    assets.push(pageAsset(page, "screenshot", "desktop", 1440, 900, index === 0 ? 1 : 0.78));
    if (index === 0) {
      assets.push(pageAsset(page, "screenshot", "mobile", 720, 1280, 0.74, "responsive"));
      assets.push(pageAsset(page, "fullpage", "desktop", 1440, 900, 0.92, "fullpage"));
    } else if (["workflow", "result", "proof", "pricing"].includes(page.role)) {
      assets.push(pageAsset(page, "fullpage", "desktop", 1440, 900, 0.7, "fullpage"));
    }
  });
  return assets;
}

/* ---------- backend transport ---------- */
function evidenceFromBrief(brief = {}) {
  const raw = [...arrayOf(brief.evidenceAssets), ...arrayOf(brief.evidence), ...arrayOf(brief.assets)]
    .filter((asset) => asset && typeof asset === "object");
  const fromScreenshots = arrayOf(brief.screenshots).map((url, i) => ({ id: `screenshot-${i + 1}`, url, kind: "screenshot", role: "hero", pageRole: "home", priority: 0.5 }));
  const all = [...raw, ...fromScreenshots].map((asset, i) => {
    const url = publicUrl(asset.url || asset.src);
    if (!url) return null;
    return {
      id: clean(asset.id || `evidence-${i + 1}`, 80),
      url,
      page: publicUrl(asset.page) || clean(asset.page, 300),
      pageRole: clean(asset.pageRole || asset.page_role || "page", 32),
      role: clean(asset.role || asset.assetRole || "overview", 32),
      kind: clean(asset.kind || "screenshot", 24),
      fullPage: Boolean(asset.fullPage || asset.fullpage || asset.isFullPage || asset.kind === "fullpage"),
      viewport: clean(asset.viewport || "desktop", 20),
      width: Number(asset.width) || 0,
      height: Number(asset.height) || 0,
      state: clean(asset.state || "default", 32),
      crop: clean(asset.crop || "full", 32),
      focalPoint: clean(asset.focalPoint || asset.focal_point || "center", 40),
      safeTextRegions: arrayOf(asset.safeTextRegions || asset.safe_text_regions).map((x) => clean(x, 24)).filter(Boolean).slice(0, 4),
      priority: Number(asset.priority) || 0,
      source: clean(asset.source || "reader", 24),
      alt: clean(asset.alt, 120),
    };
  }).filter(Boolean);
  return [...new Map(all.map((asset) => [asset.url, asset])).values()];
}

function publicBrief(brief = {}) {
  const evidenceAssets = evidenceFromBrief(brief);
  const screenshots = unique([...arrayOf(brief.screenshots).map(publicUrl), ...evidenceAssets.map((asset) => asset.url)]);
  const fullpages = unique([...arrayOf(brief.fullpages).map(publicUrl), ...evidenceAssets.filter((asset) => asset.kind === "fullpage").map((asset) => asset.url)]);
  const pages = arrayOf(brief.pages).filter((page) => page && typeof page === "object").slice(0, 8).map((page) => ({
    url: publicUrl(page.url), role: clean(page.role, 32), title: clean(page.title, 120), headline: clean(page.headline, 120),
    description: clean(page.description, 300), headings: arrayOf(page.headings).map((x) => clean(x, 120)).slice(0, 12),
  })).filter((page) => page.url || page.title);
  return {
    name: clean(brief.name, 80),
    domain: clean(brief.domain, 120),
    url: publicUrl(brief.url) || clean(brief.url, 300),
    headline: clean(brief.headline, 160),
    tagline: clean(brief.tagline, 160),
    description: clean(brief.description, 360),
    category: clean(brief.category, 60),
    cta: clean(typeof brief.cta === "string" ? brief.cta : brief.cta?.text, 90),
    ctaCandidates: arrayOf(brief.ctaCandidates).map((x) => clean(x, 90)).filter(Boolean).slice(0, 8),
    hookCandidates: arrayOf(brief.hookCandidates || brief.hook).map((x) => clean(x, 100)).filter(Boolean).slice(0, 8),
    features: arrayOf(brief.features).map((feature) => typeof feature === "string" ? { title: clean(feature, 80), desc: "" } : { title: clean(feature?.title, 80), desc: clean(feature?.desc || feature?.description, 220), evidence: feature?.evidence || undefined }).filter((feature) => feature.title).slice(0, 12),
    stats: arrayOf(brief.stats).map((stat) => ({ value: clean(stat?.value, 24), label: clean(stat?.label, 80) })).filter((stat) => stat.value).slice(0, 8),
    quotes: arrayOf(brief.quotes).map((quote) => ({ text: clean(quote?.text, 180), author: clean(quote?.author, 80) })).filter((quote) => quote.text).slice(0, 4),
    logos: arrayOf(brief.logos).map((x) => clean(x, 40)).filter(Boolean).slice(0, 10),
    colors: arrayOf(brief.colors).map((x) => clean(x, 16)).filter((x) => /^#[0-9a-f]{3,8}$/i.test(x)).slice(0, 10),
    screenshots,
    fullpage: publicUrl(brief.fullpage) || fullpages[0] || "",
    fullpages,
    pages,
    pageRoles: arrayOf(brief.pageRoles).map((x) => typeof x === "string" ? clean(x, 32) : { url: publicUrl(x?.url), role: clean(x?.role, 32) }).slice(0, 8),
    evidenceAssets: evidenceAssets.slice(0, 32),
    sourceAssets: arrayOf(brief.sourceAssets).map((asset) => ({ id: clean(asset?.id, 80), url: publicUrl(asset?.url), page: publicUrl(asset?.page), role: clean(asset?.role, 32), kind: clean(asset?.kind || "image", 24), alt: clean(asset?.alt, 120) })).filter((asset) => asset.url).slice(0, 24),
    interactionTrace: arrayOf(brief.interactionTrace).map((event) => ({ interaction: clean(event?.interaction, 24), target: clean(event?.target, 100), source: clean(event?.source, 32), confidence: clean(event?.confidence, 24) })).filter((event) => INTERACTIONS.includes(event.interaction)).slice(0, 6),
    visualTokens: brief.visualTokens && typeof brief.visualTokens === "object" ? { mode: clean(brief.visualTokens.mode, 24), density: clean(brief.visualTokens.density, 24), radius: clean(brief.visualTokens.radius, 24), typography: clean(brief.visualTokens.typography, 80) } : {},
  };
}

function requestBody(path, body) {
  if (path !== "/direct" || !body || typeof body !== "object") return body;
  return { ...body, brief: publicBrief(body.brief || {}) };
}

export async function api(path, body, { timeout = 60000 } = {}) {
  const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const payload = requestBody(path, body);
    const r = await fetch(API + path, payload ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal } : { signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
    return j;
  } finally { clearTimeout(timer); }
}

export async function backendAlive() {
  return (await backendStatus()).ok;
}

export async function backendStatus() {
  try {
    const result = await api("/health", null, { timeout: 3500 });
    return { ok: !!result.ok, render: result.render || { available: false }, providers: result.providers || {} };
  } catch {
    return { ok: false, render: { available: false }, providers: {} };
  }
}

/* ---------- evidence-aware browser reader ---------- */
export async function readInBrowser(url) {
  const target = new URL(/^https?:/i.test(url) ? url : `https://${url}`);
  ["key", "token", "secret", "password", "signature", "auth", "api_key", "access_token"].forEach((key) => target.searchParams.delete(key));
  target.hash = "";
  const homeUrl = target.href;
  const markdown = await fetchMarkdown(homeUrl);
  const home = parsePage(markdown, homeUrl, "home");
  const routeLinks = selectRouteLinks(extractLinks(markdown, homeUrl), homeUrl);
  const routePages = await Promise.all(routeLinks.map(async (link) => parsePage(await fetchMarkdown(link.url, 7000), link.url, link.label)));
  const pages = [home, ...routePages];
  const assets = evidenceAssetsFor(pages);
  const facts = mergePageFacts(pages);
  const domain = target.host.replace(/^www\./, "");
  const name = facts.name || domain.split(".")[0] || domain;
  const evidence = assets.map((asset) => ({ ...asset, page: asset.page || homeUrl }));
  const visualTokens = {
    mode: facts.colors.some((color) => parseInt(color.slice(1, 3), 16) < 60) ? "dark-signal" : "light-signal",
    density: pages.some((page) => (page.features || []).length > 5) ? "dense" : "open",
    radius: "unknown",
    typography: "reader-inferred",
  };
  return {
    name,
    domain,
    url: homeUrl,
    headline: facts.headline || name,
    tagline: facts.headline || "",
    description: facts.description,
    features: facts.features,
    stats: facts.stats,
    quotes: facts.quotes,
    logos: facts.logos,
    colors: facts.colors,
    category: pages.find((page) => page.role !== "home")?.role || "product",
    cta: facts.ctaCandidates[0] || "",
    ctaCandidates: facts.ctaCandidates,
    hookCandidates: unique([facts.headline, ...pages.flatMap((page) => page.headings || []).slice(0, 7)]).slice(0, 8),
    pages: pages.map((page) => ({ url: page.url, role: page.role, title: page.title, headline: page.headline, description: page.description, headings: page.headings })),
    pageRoles: pages.map((page) => ({ url: page.url, role: page.role })),
    evidenceAssets: evidence,
    assets: evidence,
    screenshots: evidence.map((asset) => asset.url),
    fullpages: evidence.filter((asset) => asset.kind === "fullpage").map((asset) => asset.url),
    fullpage: evidence.find((asset) => asset.kind === "fullpage")?.url || "",
    sourceAssets: facts.sourceAssets,
    interactionTrace: facts.interactionTrace,
    visualTokens,
    logo: facts.sourceAssets.find((asset) => /logo|brand|wordmark/i.test(asset.alt || ""))?.url || "",
    paras: [facts.description, ...pages.flatMap((page) => page.description ? [page.description] : [])].filter(Boolean).slice(0, 8),
  };
}

/* ---------- Kimi from the browser (CORS-enabled) ---------- */
// Creative direction prompt removed — direction is now handled server-side or via localPlan.

function directionPayload(brief, decisions = {}) {
  const b = publicBrief(brief);
  const motion = resolveMotionVariation(decisions.motionVariation || decisions.motion_variation || decisions.motion?.variation, b, decisions.style).id;
  return {
    name: b.name,
    domain: b.domain,
    url: b.url,
    headline: b.headline,
    tagline: b.tagline,
    description: b.description,
    category: b.category,
    cta: b.cta,
    cta_candidates: b.ctaCandidates,
    hook_candidates: b.hookCandidates,
    features: b.features,
    stats: b.stats,
    quotes: b.quotes,
    logos: b.logos,
    colors: b.colors,
    pages: b.pages,
    page_roles: b.pageRoles,
    screenshots: b.screenshots,
    fullpages: b.fullpages,
    evidence_assets: b.evidenceAssets,
    source_assets: b.sourceAssets,
    interaction_trace: b.interactionTrace,
    visual_tokens: b.visualTokens,
    direction: {
      style: decisions.style,
      energy: decisions.energy,
      hook_pick: decisions.hook,
      story_grammar: decisions.grammar || chooseGrammar(b, decisions),
      motion_variation: motion,
      motion_direction: decisions.motionDirective || decisions.motion || null,
    },
  };
}

export async function kimiInBrowser(brief, decisions = {}) {
  // Provider credentials are server-only. This remains the offline creative pass.
  return localPlan(brief, decisions);
}

/* ---------- evidence-led decisions and local story grammars ---------- */
function briefText(brief) {
  return [brief.name, brief.domain, brief.headline, brief.description, brief.category, ...arrayOf(brief.features).flatMap((x) => [x?.title, x?.desc]), ...arrayOf(brief.pages).flatMap((x) => [x?.role, x?.title, x?.description])].filter(Boolean).join(" ");
}

function chooseGrammar(brief, decisions = {}) {
  const roles = new Set(arrayOf(brief.pages).map((page) => typeof page === "string" ? page : page?.role).filter(Boolean));
  const assets = new Set(evidenceFromBrief(brief).map((asset) => asset.role));
  const interaction = arrayOf(brief.interactionTrace).length > 0;
  if ((roles.has("workflow") || assets.has("workflow")) && (roles.has("result") || assets.has("result"))) return "demo";
  if (roles.has("pricing") || assets.has("pricing")) return "conversion";
  if ((roles.has("result") || assets.has("result")) && (brief.stats || []).length) return "signal";
  if (roles.has("workflow") || roles.has("result") || assets.has("workflow") || assets.has("result")) return "product";
  if (decisions.style === "editorial" && !interaction) return "brand";
  if (decisions.style === "pop" && interaction) return "consumer";
  if (/(developer|api|docs|cli|sdk|terminal|code)/i.test(briefText(brief)) && interaction) return "developer";
  return interaction ? "product" : "brand";
}

function inferStyle(brief) {
  const scores = Object.fromEntries(Object.keys(STYLES).map((key) => [key, 0]));
  const b = publicBrief(brief);
  const roles = new Set(b.pages.map((page) => page.role));
  const assets = new Set(b.evidenceAssets.map((asset) => asset.role));
  const source = lower(briefText(b));
  if (roles.has("docs") || source.includes("developer") || source.includes("api")) { scores.mono += 3; scores.neon += 2; }
  if (roles.has("workflow") || assets.has("workflow")) { scores.kinetic += 2; scores.mono += 1; }
  if (roles.has("pricing") || roles.has("proof")) { scores.editorial += 2; scores.mono += 1; }
  if (roles.has("editorial") || roles.has("about")) scores.editorial += 3;
  if (b.interactionTrace.some((x) => ["toggle", "modal", "filter"].includes(x.interaction))) scores.neon += 2;
  if (b.colors.some((color) => { const r = parseInt(color.slice(1, 3), 16), g = parseInt(color.slice(3, 5), 16), bl = parseInt(color.slice(5, 7), 16); return Math.max(r, g, bl) - Math.min(r, g, bl) > 130; })) { scores.pop += 2; scores.neon += 1; }
  if (/(finance|legal|health|wellness|journal|luxury|research)/i.test(source)) scores.editorial += 2;
  if (/(gaming|social|creator|fashion|food|kids|shop)/i.test(source)) scores.pop += 2;
  if (/(security|analytics|signal|data|infrastructure)/i.test(source)) scores.neon += 2;
  const [style] = Object.entries(scores).sort((a, b2) => b2[1] - a[1])[0];
  return style || "kinetic";
}

export function guessDecisions(brief) {
  const publicData = publicBrief(brief);
  const style = inferStyle(publicData);
  const grammar = chooseGrammar(publicData, { style });
  const hook = publicData.hookCandidates?.[0] || publicData.headline || publicData.name;
  const evidenceCount = publicData.evidenceAssets.length;
  const energy = Math.min(2.8, Math.max(0.9, 1.15 + (publicData.interactionTrace.length * 0.24) + (publicData.stats.length * 0.12) + (evidenceCount > 3 ? 0.25 : 0)));
  return {
    style,
    energy,
    hook,
    grammar,
    motionVariation: resolveMotionVariation(null, publicData, style).id,
    source: "heuristic",
    evidence: { assets: evidenceCount, pages: publicData.pages.length, interactions: publicData.interactionTrace.length },
  };
}

function ctaFor(brief) {
  const b = publicBrief(brief);
  const candidates = unique([b.cta, ...b.ctaCandidates]).filter((candidate) => candidate && candidate.length < 90);
  const actual = candidates.find((candidate) => !GENERIC_CTA.test(candidate));
  const name = b.name || b.domain || "this product";
  return {
    text: b.headline || b.description || `See ${name} in action`,
    button: actual || candidates[0] || `See ${name} in action`,
  };
}

function evidencePool(brief) {
  const b = publicBrief(brief);
  const screenshots = b.screenshots;
  return evidenceFromBrief(b).map((asset) => ({ ...asset, index: Math.max(0, screenshots.indexOf(asset.url)) })).filter((asset) => asset.url);
}

function pickEvidence(brief, desiredRole, kind, state) {
  const pool = evidencePool(brief).filter((asset) => kind === "fullpage" ? asset.kind === "fullpage" : asset.kind !== "fullpage");
  if (!pool.length) return null;
  const used = state.used || new Set();
  const roleMatches = pool.filter((asset) => asset.role === desiredRole || asset.pageRole === desiredRole);
  const candidates = [...roleMatches, ...pool.filter((asset) => !roleMatches.includes(asset))].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  const next = candidates.find((asset) => !used.has(asset.id) && asset.id !== state.last) || candidates.find((asset) => asset.id !== state.last) || candidates[0];
  if (next) { used.add(next.id); state.last = next.id; }
  return next || null;
}

function mediaScene(brief, desiredRole, type, state, caption = "") {
  const wantedKind = type === "scroll" ? "fullpage" : "screenshot";
  let asset = pickEvidence(brief, desiredRole, wantedKind, state);
  let actualType = type;
  if (!asset && type === "scroll") { actualType = "screen"; asset = pickEvidence(brief, desiredRole, "screenshot", state); }
  if (!asset) return null;
  const interaction = arrayOf(brief.interactionTrace).find((event) => INTERACTIONS.includes(event?.interaction))?.interaction || "none";
  return {
    type: actualType,
    shot: asset.index,
    src: asset.url,
    asset,
    asset_id: asset.id,
    assetRole: asset.role,
    visualReason: `${asset.role} evidence from the ${asset.pageRole} page`,
    caption: caption || undefined,
    interaction: actualType === "scroll" ? "scroll" : interaction,
    beats: actualType === "scroll" ? 2 : 1,
  };
}

function featureScene(feature, index) {
  return feature ? { type: "feature", title: feature.title, sub: feature.desc, index, beats: 1 } : null;
}

function proofScene(brief, index = 0) {
  const stats = arrayOf(brief.stats).filter((stat) => stat?.value);
  const quotes = arrayOf(brief.quotes).filter((quote) => quote?.text);
  const logos = arrayOf(brief.logos).filter(Boolean);
  if (stats[index]) return { type: "stat", value: stats[index].value, label: stats[index].label, beats: 1 };
  if (quotes[0]) return { type: "quote", text: quotes[0].text, author: quotes[0].author, beats: 2 };
  if (logos.length >= 3) return { type: "logos", names: logos.slice(0, 6), beats: 2 };
  return null;
}

function localPlan(brief, decisions = {}) {
  const b = publicBrief(brief);
  const style = STYLES[decisions.style] ? decisions.style : inferStyle(b);
  const grammar = decisions.grammar || chooseGrammar(b, { ...decisions, style });
  const features = b.features.filter((feature) => feature.title);
  const state = { used: new Set(), last: "" };
  const hook = String(decisions.hook || b.hookCandidates?.[0] || b.headline || b.name).split(/\s+/).filter(Boolean).slice(0, 4);
  const cta = ctaFor(b);
  const scenes = [
    { type: "coldopen", word: b.name, beats: 1 },
    { type: "hook", words: hook, beats: 1 },
  ];
  const add = (scene) => { if (scene) scenes.push(scene); };
  const statement = (value, kicker) => value ? { type: "statement", text: value, kicker: kicker || b.category || "", beats: 2 } : null;
  const addFeature = (index) => add(featureScene(features[index], index));
  const addMedia = (role, type, caption) => add(mediaScene(b, role, type, state, caption));

  if (grammar === "demo") {
    add(statement(b.description || b.headline, b.category));
    addMedia("workflow", "screen", features[0]?.title || b.headline);
    addFeature(0);
    addMedia("result", "screen", features[1]?.title || b.headline);
    addFeature(1);
    add(proofScene(b));
    addMedia("proof", "split", b.headline);
  } else if (grammar === "conversion") {
    addMedia("hero", "screen", b.headline);
    add(statement(b.headline || b.description, b.category));
    addMedia("pricing", "screen", "");
    addFeature(0);
    add(proofScene(b));
    if (features.length >= 3) add({ type: "featureStack", items: features.slice(0, 3).map((feature) => feature.title), beats: 2 });
  } else if (grammar === "signal") {
    add(statement(b.headline || b.description, ""));
    addMedia("workflow", "screen", features[0]?.title || b.headline);
    add(proofScene(b));
    addMedia("result", "split", features[1]?.title || b.headline);
    addFeature(0);
    if (b.quotes.length) add(proofScene(b, 1));
  } else if (grammar === "brand") {
    add(statement(b.description || b.headline, b.category));
    addMedia("hero", "split", b.headline);
    addFeature(0);
    add(proofScene(b));
    if (b.logos.length >= 3) add({ type: "logos", names: b.logos.slice(0, 6), beats: 2 });
    add(proofScene(b, b.stats.length ? 1 : 0));
  } else if (grammar === "consumer") {
    add(statement(b.headline || b.description, b.category));
    addMedia("hero", "screen", b.headline);
    addFeature(0);
    addMedia("workflow", "scroll", features[1]?.title || b.headline);
    addFeature(1);
    if (features.length >= 3) add({ type: "featureStack", items: features.slice(0, 3).map((feature) => feature.title), beats: 2 });
    add(proofScene(b));
  } else if (grammar === "developer") {
    add(statement(b.description || b.headline, b.category));
    addMedia("workflow", "screen", features[0]?.title || b.headline);
    addFeature(0);
    add(proofScene(b));
    addMedia("result", "scroll", features[1]?.title || b.headline);
    addFeature(1);
  } else {
    add(statement(b.description || b.headline, b.category));
    addMedia("hero", "screen", b.headline);
    addFeature(0);
    addMedia("workflow", "screen", features[1]?.title || b.headline);
    addFeature(1);
    add(proofScene(b));
  }

  if (!scenes.some((scene) => MEDIA_TYPES.has(scene.type)) && b.evidenceAssets.length) addMedia("hero", "screen", b.headline);
  if (features.length >= 3 && !scenes.some((scene) => scene.type === "feature" && scene.index === 2)) addFeature(2);
  if (scenes.length < 9 && b.description && !scenes.some((scene) => scene.type === "statement")) add(statement(b.description, b.category));
  scenes.push({ type: "cta", text: cta.text, button: cta.button, beats: 1 });
  scenes.push({ type: "endcard", text: b.tagline || b.headline || b.description || b.name, beats: 2 });
  const final = scenes.filter(Boolean).slice(0, 22).map((scene) => ({
    ...scene,
    duration: scene.duration || durationFor(scene.type, scene.beats),
    motionIntent: scene.motionIntent || motionIntentFor(scene.type),
  }));
  let media = final.filter((scene) => MEDIA_TYPES.has(scene.type));
  if (media.length < 2) {
    const promote = (index) => {
      const scene = final[index];
      if (scene) { scene.type = "screen"; scene.motionIntent = "focus"; }
    };
    const featureIndexes = final.map((scene, index) => (scene.type === "feature" ? index : -1)).filter((index) => index >= 0);
    promote(featureIndexes[0]);
    promote(featureIndexes[1] !== undefined ? featureIndexes[1] : final.findIndex((scene) => scene.type === "statement"));
    media = final.filter((scene) => MEDIA_TYPES.has(scene.type));
  }
  if (!MEDIA_TYPES.has(final[0]?.type) && final[0]?.type === "coldopen") {
    const swap = final.findIndex((scene, index) => index > 0 && (MEDIA_TYPES.has(scene.type) || scene.type === "hook" || scene.type === "statement"));
    if (swap > 0) { const [moved] = final.splice(swap, 1); final.unshift(moved); }
  }
  final.length = Math.min(final.length, 20);
  if (final[final.length - 1]?.type !== "endcard") final.push({ type: "endcard", text: b.tagline || b.headline || b.name, duration: durationFor("endcard", 2), motionIntent: "land" });
  const deduped = [];
  const seenTypes = new Set();
  for (const scene of final) {
    if (scene.type === "endcard") { continue; }
    if (seenTypes.has(scene.type)) continue;
    seenTypes.add(scene.type);
    deduped.push(scene);
  }
  deduped.push({ type: "endcard", text: b.tagline || b.headline || b.name, duration: durationFor("endcard", 2), motionIntent: "land" });
  const structure = deduped.map((scene) => scene.type);
  const mediaBeats = structure.filter((type) => MEDIA_TYPES.has(type));
  const seed = hashOf(`${b.domain}|${b.name}|${b.headline}`);
  const cameras = ["push", "track", "orbit", "match", "reveal", "static"];
  const holds = [mediaBeats[0] || structure[0]].concat(structure.includes("quote") ? ["quote"] : []).slice(0, 2);
  return {
    style,
    motionVariation: decisions.motionVariation || decisions.motion_variation || resolveMotionVariation(null, b, style).id,
    grammar,
    title: b.name,
    tagline: b.tagline || b.headline || b.description,
    direction: {
      concept: clean(b.headline || b.description || b.name, 160),
      structure,
      camera: cameras[seed % cameras.length],
      opening: structure[0],
      hero: false,
      beat: 18 + (seed % 7),
      holds,
    },
    structure,
    panel: [{ role: "Evidence reader", note: `${b.evidenceAssets.length} visual states across ${b.pages.length || 1} page${(b.pages.length || 1) === 1 ? "" : "s"}; story grammar: ${grammar}.` }],
    scenes: deduped,
  };
}

/* ---------- sanitize provider output while retaining evidence ---------- */
function matchingFeature(brief, scene, index) {
  const features = publicBrief(brief).features;
  const wanted = lower(scene.title || scene.text);
  return features.find((feature) => wanted && (lower(feature.title) === wanted || lower(feature.title).includes(wanted) || wanted.includes(lower(feature.title)))) || features[index] || null;
}

function matchingAsset(brief, scene, type) {
  const b = publicBrief(brief);
  const pool = evidenceFromBrief(b);
  const id = scene.asset_id || scene.assetId || scene.evidence_id || scene.evidenceId;
  const byId = id ? pool.find((asset) => asset.id === id) : null;
  const explicitUrl = publicUrl(scene.asset?.url || scene.asset?.src || scene.asset?.image);
  const byObject = explicitUrl ? pool.find((asset) => asset.url === explicitUrl) : null;
  const shot = Number.isInteger(Number(scene.shot)) ? pool.filter((asset) => asset.kind !== "image")[Number(scene.shot)] : null;
  const desiredRole = lower(scene.assetRole || scene.asset_role || "");
  const byRole = desiredRole ? pool.find((asset) => lower(asset.role) === desiredRole || lower(asset.pageRole) === desiredRole) : null;
  const selected = byId || byObject || shot || byRole || pool.find((asset) => type === "scroll" ? asset.kind === "fullpage" : asset.kind !== "fullpage");
  if (!selected || (type === "scroll" && selected.kind !== "fullpage")) return null;
  return { ...selected, index: Math.max(0, b.screenshots.indexOf(selected.url)) };
}

function safeMotion(motion) {
  if (!motion || typeof motion !== "object") return undefined;
  const out = {};
  ["entrance", "exit", "velocity", "sound"].forEach((key) => { if (typeof motion[key] === "string") out[key] = clean(motion[key], 32); });
  ["anticipation", "overshoot", "settle", "hold"].forEach((key) => { if (Number.isFinite(Number(motion[key]))) out[key] = Math.max(0, Math.min(4, Number(motion[key]))); });
  return Object.keys(out).length ? out : undefined;
}

function defaultBeats(type) {
  return ["statement", "quote", "logos", "featureStack", "endcard"].includes(type) ? 2 : MEDIA_TYPES.has(type) ? 1 : 1;
}

function durationFor(type, beats) {
  const bars = Number(beats);
  if (Number.isFinite(bars) && bars > 0) return Math.round(Math.max(0.75, Math.min(5.25, bars * 1.5)) * 1000) / 1000;
  return { screen: 2.25, scroll: 2.625, split: 2.25, quote: 2.25, endcard: 2.625, cta: 2.25 }[type] || 1.5;
}

function motionIntentFor(type) {
  return { coldopen: "reveal", hook: "staccato", statement: "clarify", flashword: "impact", screen: "focus", scroll: "scan", feature: "reveal", featureStack: "cascade", stat: "count", quote: "settle", logos: "assemble", marquee: "glide", split: "compare", cta: "commit", endcard: "land" }[type] || "reveal";
}

const PRODUCT_TYPES = ["screen", "scroll", "split", "flyin", "depthReveal", "matchcut", "track"];
const CONTENT_OPENERS = ["flashword", "hook", "screen", "flyin", "depthReveal", "matchcut", "track"];
const CAMERA_CHOICES = ["push", "track", "orbit", "match", "reveal", "static"];
const STRUCTURE_LIMIT = 22;
const PROMOTABLE_TYPES = ["feature", "statement", "featureStack"];

function hashOf(value) {
  let h = 2166136261;
  const source = String(value ?? "");
  for (let i = 0; i < source.length; i++) { h ^= source.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function canonicalType(type) {
  return type === "marquee" ? "statement" : type;
}

function retypeScene(scene, type, b) {
  const next = { ...scene, type };
  if (type === "marquee") return { ...next, type: "statement" };
  const shot = Number.isInteger(Number(scene.shot)) ? Number(scene.shot) : 0;
  if (PRODUCT_TYPES.includes(type)) {
    next.shot = shot;
    next.motionIntent = motionIntentFor(type);
    next.duration = durationFor(type, next.beats);
    if (type === "split" && !next.text) next.text = clean(b.headline || b.name, 48);
    if (type === "depthReveal" && !next.text) next.text = clean(b.headline || b.name, 48);
    if (type === "matchcut") { next.from = shot; next.to = shot; if (!next.text) next.text = clean(b.headline || b.name, 48); }
    if ((type === "screen" || type === "flyin" || type === "track") && !next.caption) next.caption = clean(b.headline || b.name, 34);
  } else if (type === "statement") {
    if (!next.text) { next.text = clean(b.description || b.headline || b.name, 70); next.accent = ""; }
  } else if (type === "feature") {
    if (!next.title) next.title = clean(b.features[0]?.title || b.name, 40);
  }
  return next;
}

function enforceProductBeats(scenes, b) {
  const productCount = () => scenes.filter((scene) => PRODUCT_TYPES.includes(scene.type)).length;
  if (productCount() >= 2) return scenes;
  for (let i = 0; i < scenes.length && productCount() < 2; i++) {
    if (!PROMOTABLE_TYPES.includes(scenes[i].type)) continue;
    const target = i % 2 ? "screen" : "scroll";
    scenes[i] = retypeScene(scenes[i], target, b);
  }
  for (let i = 0; i < scenes.length && productCount() < 2; i++) {
    if (scenes[i].type === "hook" || scenes[i].type === "flashword" || scenes[i].type === "quote") scenes[i] = retypeScene(scenes[i], "scroll", b);
  }
  return scenes;
}

function normalizeDirection(scenes, b, decisions) {
  let cleaned = scenes.filter((scene) => scene.type !== "marquee").map((scene) => scene.type === "marquee" ? { ...scene, type: "statement" } : scene);
  let statSeen = false;
  cleaned = cleaned.filter((scene) => {
    if (scene.type !== "stat") return true;
    if (statSeen) return false;
    statSeen = true;
    return true;
  });
  if (cleaned[0]?.type === "coldopen") {
    const shift = cleaned.findIndex((scene) => scene.type !== "coldopen");
    if (shift > 0) {
      const [opener] = cleaned.splice(shift, 1);
      cleaned.unshift(opener);
    } else if (cleaned[0]?.type === "coldopen") {
      cleaned[0] = { type: "flashword", word: clean(cleaned[0]?.word || b.name, 16), beats: cleaned[0]?.beats || 1, duration: durationFor("flashword", cleaned[0]?.beats || 1), motionIntent: motionIntentFor("flashword") };
    }
  }
  cleaned = cleaned.filter((scene, index) => scene && (index === 0 || scene.type !== cleaned[index - 1].type));
  cleaned = enforceProductBeats(cleaned, b);
  const structure = cleaned.map((scene) => scene.type);
  const seed = hashOf(`${b.domain || b.name || "product"}|${b.headline || ""}|${decisions.style || ""}`);
  const holds = PRODUCT_TYPES.filter((type) => structure.includes(type)).slice(0, 2);
  const opening = CONTENT_OPENERS.includes(structure[0]) ? structure[0] : (structure.find((type) => CONTENT_OPENERS.includes(type)) || structure[0] || "screen");
  const camera = CAMERA_CHOICES[seed % CAMERA_CHOICES.length];
  const concept = clean(rawConcept(decisions) || b.headline || b.description || b.name, 160);
  return { concept, structure, camera, opening, hero: false, beat: 16 + (seed % 19), holds };
}

function rawConcept(decisions) {
  return clean(decisions.concept, 160);
}

function normalizeProviderScene(scene, index, brief, decisions) {
  if (!scene || !SCENE_TYPES.includes(scene.type)) return null;
  let type = scene.type;
  const b = publicBrief(brief);
  const out = { type };
  if (TRANSITIONS.includes(scene.transition)) out.transition = scene.transition;
  if (INTERACTIONS.includes(scene.interaction)) out.interaction = scene.interaction;
  const beats = Number(scene.beats || scene.holdBeats || scene.hold_beats);
  out.beats = Number.isFinite(beats) ? Math.max(0.5, Math.min(4, beats)) : defaultBeats(type);
  const duration = Number(scene.duration ?? scene.durationSeconds);
  out.duration = Number.isFinite(duration) && duration > 0 ? Math.max(0.75, Math.min(5.25, duration)) : durationFor(type, out.beats);
  out.motionIntent = clean(scene.motionIntent || scene.motion_intent || scene.motion?.intent || motionIntentFor(type), 24);
  out.motion = safeMotion(scene.motion);
  if (!out.motion) delete out.motion;
  switch (type) {
    case "coldopen": out.word = clean(scene.word || b.name, 24); break;
    case "hook": {
      const words = Array.isArray(scene.words) ? scene.words : String(scene.words || scene.text || "").split(/\s+/);
      out.words = words.map((word) => clean(word, 22)).filter(Boolean).slice(0, 4);
      if (!out.words.length) out.words = String(decisions.hook || b.headline || b.name).split(/\s+/).slice(0, 4).map((word) => clean(word, 22));
      break;
    }
    case "statement": out.text = clean(scene.text || b.description || b.headline, 70); out.accent = clean(scene.accent, 20); if (scene.kicker) out.kicker = clean(scene.kicker, 24); break;
    case "flashword": out.word = clean(String(scene.word || scene.text || b.name).split(/\s+/)[0], 16); break;
    case "screen": case "scroll": case "split": {
      const asset = matchingAsset(b, scene, type);
      if (!asset) return null;
      if (type === "scroll" && asset.kind !== "fullpage") type = "screen";
      out.type = type;
      out.shot = asset.index;
      out.src = asset.url;
      out.asset = asset;
      out.asset_id = asset.id;
      out.assetRole = asset.role;
      out.visualReason = clean(scene.visual_reason || scene.visualReason || `${asset.role} evidence from the ${asset.pageRole} page`, 140);
      if (scene.caption) out.caption = clean(scene.caption, 34);
      if (type === "split" && scene.text) out.text = clean(scene.text, 48);
      if (type === "scroll") out.interaction = "scroll";
      break;
    }
    case "feature": {
      const feature = matchingFeature(b, scene, index);
      if (!feature) return null;
      out.title = clean(feature.title, 40); if (feature.desc) out.sub = clean(scene.sub || feature.desc, 70); if (scene.kicker) out.kicker = clean(scene.kicker, 24); out.index = b.features.indexOf(feature); break;
    }
    case "featureStack": {
      const actual = b.features.map((feature) => feature.title);
      const items = arrayOf(scene.items).map((item) => clean(typeof item === "string" ? item : item?.title, 26)).filter((item) => actual.some((fact) => lower(fact) === lower(item) || lower(fact).includes(lower(item))));
      out.items = [...new Set(items)].slice(0, 3);
      if (out.items.length !== 3 && actual.length >= 3) out.items = actual.slice(0, 3);
      break;
    }
    case "stat": {
      const stat = b.stats.find((item) => String(item.value) === String(scene.value)) || b.stats[index % Math.max(1, b.stats.length)];
      if (!stat) return null;
      out.value = clean(stat.value, 10); out.label = clean(scene.label || stat.label, 48); break;
    }
    case "quote": {
      const quote = b.quotes.find((item) => lower(item.text) === lower(scene.text) || lower(item.text).includes(lower(scene.text || "")));
      if (!quote) return null;
      out.text = clean(quote.text, 120); out.author = clean(scene.author || quote.author, 40); break;
    }
    case "logos": {
      const logos = b.logos;
      out.names = arrayOf(scene.names).map((name) => clean(name, 18)).filter((name) => logos.some((logo) => lower(logo) === lower(name))).slice(0, 6);
      if (out.names.length < 3 && logos.length >= 3) out.names = logos.slice(0, 6);
      break;
    }
    case "marquee": out.text = clean(scene.text || b.name, 26); break;
    case "cta": {
      const cta = ctaFor(b);
      out.text = clean(scene.text, 30) && !GENERIC_CTA.test(clean(scene.text, 30)) ? clean(scene.text, 30) : cta.text.slice(0, 30);
      out.button = clean(scene.button, 22) && !GENERIC_CTA.test(clean(scene.button, 22)) ? clean(scene.button, 22) : cta.button.slice(0, 22);
      break;
    }
    case "endcard": out.text = clean(scene.text || b.tagline || b.headline || b.name, 60); break;
  }
  if (out.interaction && !b.interactionTrace.some((event) => event.interaction === out.interaction) && out.interaction !== "none") out.interaction = "none";
  if (out.type === "hook" && !out.words.length) return null;
  if (out.type === "featureStack" && out.items.length !== 3) return null;
  if (out.type === "logos" && out.names.length < 3) return null;
  return out;
}

export function normalizePlan(raw, brief, decisions = {}) {
  const b = publicBrief(brief);
  const motionVariation = raw?.motion_variation || raw?.motionVariation || raw?.motion?.variation || decisions.motionVariation || resolveMotionVariation(null, b, decisions.style).id;
  const incoming = arrayOf(raw?.scenes).map((scene, index) => normalizeProviderScene(scene, index, b, decisions)).filter(Boolean);
  let scenes = incoming;
  if (scenes.length < 8) return localPlan(b, { ...decisions, motionVariation });
  if (scenes[0]?.type !== "coldopen") scenes.unshift({ type: "coldopen", word: b.name, beats: 1 });
  scenes = scenes.filter((scene) => scene.type !== "endcard");
  const ctaIndex = scenes.findIndex((scene) => scene.type === "cta");
  const cta = ctaFor(b);
  if (ctaIndex >= 0) { const scene = scenes.splice(ctaIndex, 1)[0]; scenes.push({ ...scene, type: "cta", text: scene.text || cta.text, button: scene.button || cta.button }); }
  else scenes.push({ type: "cta", text: cta.text, button: cta.button, beats: 1 });
  scenes.push({ type: "endcard", text: clean(raw?.tagline || b.tagline || b.headline || b.name, 60), beats: 2 });
  scenes = scenes.slice(0, STRUCTURE_LIMIT);
  const direction = normalizeDirection(scenes, b, decisions);
  return {
    style: STYLES[decisions.style] ? decisions.style : inferStyle(b),
    motionVariation,
    grammar: raw?.story_grammar || raw?.storyGrammar || decisions.grammar || chooseGrammar(b, decisions),
    scenes,
    direction,
    structure: direction.structure,
    panel: arrayOf(raw?.panel).slice(0, 4).map((panel) => ({ role: clean(panel?.role, 30), note: clean(panel?.note, 260) })).filter((panel) => panel.role || panel.note),
    tagline: clean(raw?.tagline || b.tagline || b.headline, 60),
    title: clean(raw?.title || b.name, 60),
  };
}
