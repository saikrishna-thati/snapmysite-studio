// @ts-nocheck
const MAX_HTML = 1_200_000;
const USER_AGENT = "SnapmySiteReader/1.0 (+https://snapmy-site.vercel.app/)";

function normalizeUrl(value) {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    const err = new Error("Enter a valid website URL.");
    err.code = "invalid_url";
    throw err;
  }
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || !url.hostname) {
    const err = new Error("Only public http and https websites are supported.");
    err.code = "invalid_url";
    throw err;
  }
  if (isBlockedHostname(url.hostname)) {
    const err = new Error("Private and local network addresses are not supported.");
    err.code = "blocked_url";
    throw err;
  }
  url.hash = "";
  return url;
}

function isBlockedHostname(hostname) {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host === "0.0.0.0" || host === "::1" || host === "[::1]") return true;
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 || a === 192 && b === 168;
}

async function fetchText(url, { timeout = 10000, headers = {}, maxBytes = MAX_HTML } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "user-agent": USER_AGENT, ...headers },
    });
    const text = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      contentType: response.headers.get("content-type") || "",
      url: response.url || url,
      text: text.slice(0, maxBytes),
    };
  } catch (cause) {
    return { ok: false, status: 0, contentType: "", url, text: "", reason: cause?.name === "AbortError" ? "timeout" : "fetch_failed" };
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&#x([\da-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/gi, (_, name) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }[name.toLowerCase()]))
    .replace(/[ \t\r\f]+/g, " ");
}

function cleanText(value) {
  return decodeEntities(String(value || "").replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function unique(values) {
  const seen = new Set();
  return values.filter((value) => {
    const key = String(value || "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function clipped(value, length) {
  const text = cleanText(value);
  return text.length > length ? `${text.slice(0, length - 1).trim()}…` : text;
}

function attr(fragment, name) {
  const match = String(fragment || "").match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match ? decodeEntities(match[1]).trim() : "";
}

function tagTexts(html, tag) {
  const values = [];
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  for (const match of String(html || "").matchAll(re)) {
    const text = clipped(match[1], 240);
    if (text) values.push(text);
  }
  return unique(values);
}

function metaValue(html, wanted) {
  const re = /<meta\b[^>]*>/gi;
  for (const match of String(html || "").matchAll(re)) {
    const tag = match[0];
    if (attr(tag, "name").toLowerCase() === wanted || attr(tag, "property").toLowerCase() === wanted) return clipped(attr(tag, "content"), 320);
  }
  return "";
}

function absoluteUrl(value, base) {
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol)) return "";
    url.hash = "";
    return url.href;
  } catch {
    return "";
  }
}

function linksFrom(html, base) {
  const links = [];
  for (const match of String(html || "").matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/gi)) {
    const href = absoluteUrl(attr(match[0], "href"), base);
    if (!href) continue;
    links.push({ url: href, text: clipped(match[1], 100) });
  }
  return links;
}

function roleFor(url, text = "") {
  const value = `${new URL(url).pathname} ${text}`.toLowerCase();
  if (/pricing|plans|料金/.test(value)) return "pricing";
  if (/docs?|developers?|api|reference|changelog/.test(value)) return "workflow";
  if (/dashboard|app|editor|workspace|product|platform|features?/.test(value)) return "product";
  if (/customers?|case-stud|stories|testimonials?|reviews?/.test(value)) return "proof";
  if (/about|company|team|mission/.test(value)) return "brand";
  if (/security|compliance|trust/.test(value)) return "proof";
  return new URL(url).pathname === "/" ? "home" : "supporting";
}

function toRgbHex(value) {
  const match = value.match(/rgba?\(\s*([\d.]+)[, ]+\s*([\d.]+)[, ]+\s*([\d.]+)/i);
  if (!match) return "";
  return `#${[match[1], match[2], match[3]].map((part) => Math.max(0, Math.min(255, Math.round(Number(part)))).toString(16).padStart(2, "0")).join("")}`;
}

function normalizeHex(value) {
  const raw = String(value || "").trim().toLowerCase();
  const short = raw.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const long = raw.match(/^#([0-9a-f]{6})$/);
  return long ? `#${long[1]}` : "";
}

function colorParts(value) {
  const hex = normalizeHex(value);
  if (!hex) return null;
  return [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
}

function luminance(value) {
  const rgb = colorParts(value);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function saturation(value) {
  const rgb = colorParts(value);
  if (!rgb) return 0;
  const [r, g, b] = rgb.map((channel) => channel / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === min) return 0;
  const lightness = (max + min) / 2;
  return lightness > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

function hexDistance(a, b) {
  const ra = colorParts(a);
  const rb = colorParts(b);
  if (!ra || !rb) return 999;
  return Math.sqrt((ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2 + (ra[2] - rb[2]) ** 2);
}

const NAV_WORDS = /^(?:skip (?:to|navigation)|menu|close|search|log ?in|sign ?in|sign ?up|sign out|get started(?: for free)?|start (?:free|for free|building|now|today)?|try (?:it |for )?free|book (?:a )?(?:demo|briefing|call)|learn more|read more|see more|contact(?: us)?|talk to (?:us|sales)|request (?:a )?demo|explore|overview|product|products|solutions|features?|platform|resources|company|about(?: us)?|pricing|plans|customers?|case studies|stories|docs?|documentation|developers?|api(?: reference)?|blog|careers?|jobs|support|help(?: center)?|faq|community|partners?|integrations?|security|trust|compliance|enterprise|changelog|status|news|events|webinars?|guides?|templates?|tools?|use cases?|why us|next|previous|back|home|language|english|privacy|terms|cookies?|legal|newsletter|subscribe|follow(?: us)?|download|install|get the app|open (?:the )?app|dashboard|settings|account|profile|logout|toggle|expand|collapse|show more|load more|view all|view more)$/i;

function isNavigational(value) {
  const text = cleanText(value);
  if (!text || text.length < 2) return true;
  if (NAV_WORDS.test(text)) return true;
  if (text.length > 90) return true;
  if (/[|›»←→]/.test(text)) return true;
  if (/^(?:©|\(c\))/i.test(text)) return true;
  return false;
}

function isRealColor(value) {
  const hex = normalizeHex(value);
  if (!hex) return false;
  const lum = luminance(hex);
  if (lum === null) return false;
  if (lum > 0.94 || lum < 0.035) return false;
  return saturation(hex) >= 0.12;
}

const STAT_LABEL_HINT = /(?:user|team|customer|company|business|developer|engineer|builder|creator|site|page|app|request|build|deploy|query|test|review|hour|minute|second|day|week|month|year|time|faster|faster|more|less|fewer|saved|growth|uptime|accuracy|reliability|conversion|revenue|retention|satisfaction|nps|rating|star|trusted|used|serving|processed|handled|monitored|tracked|managed|supported|available|free|off|discount|cost|price|saving)/i;

function extractStats(text) {
  const source = cleanText(text);
  const found = [];
  const re = /([$€£]\s?\d[\d,]*(?:\.\d+)?\s?(?:[BMKk])?|\b\d[\d,]*(?:\.\d+)?\s?(?:%|x|×|\+|k|K|M|B)\b|\b\d[\d,]*(?:\.\d+)?\s?(?:billion|million|thousand|users?|teams?|companies|customers?|developers?|hours?|minutes?|seconds?|days?|weeks?|months?|years?)\b)/g;
  for (const match of source.matchAll(re)) {
    const value = match[1].replace(/\s+/g, " ").trim();
    const at = match.index || 0;
    const before = source.slice(Math.max(0, at - 70), at);
    const after = source.slice(at + value.length, at + value.length + 80);
    const label = pickStatLabel(before, after);
    if (!label) continue;
    found.push({ value, label });
  }
  const seen = new Set();
  return found.filter((stat) => {
    const key = `${stat.value}|${stat.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

function pickStatLabel(before, after) {
  const tail = (before.match(/([A-Za-z][A-Za-z0-9%,'’&/+\-. ]{2,60})[.!?;:—–-]?\s*$/) || [])[1] || "";
  const lead = (after.match(/^\s*(?:[A-Za-z][A-Za-z0-9%,'’&/+\-. ]{2,60})/) || [])[0] || "";
  const candidates = [tail, lead].map((value) => cleanText(value).replace(/^[\s\-–—:]+/, "").replace(/[\s.,;:]+$/, "").trim());
  for (const candidate of candidates) {
    if (!candidate) continue;
    const words = candidate.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 7) continue;
    if (words.length === 1 && !STAT_LABEL_HINT.test(candidate)) continue;
    if (/^(?:the|a|an|and|or|of|to|in|on|for|with|by|at|from|is|are|was|were|we|you|it|this|that|our|your|their)$/i.test(candidate)) continue;
    if (isNavigational(candidate)) continue;
    if (/^(?:skip to|main content|toggle|open menu)/i.test(candidate)) continue;
    if (/(?:\.(?:com|io|dev|ai|co|app|net|org)\b|\/|@|https?:)/i.test(candidate)) continue;
    if (NAV_SEQUENCE.test(candidate)) continue;
    if (/\b(?:MTok|per MTok|tokens? per|input|output|cache)\b/i.test(candidate)) continue;
    if (/\b(?:K|M|B)\s+(?:K|M|B)\b/.test(candidate)) continue;
    if (words.filter((word) => /^[A-Z]/.test(word)).length >= 3 && words.length >= 3) continue;
    if (/\b(?:keyboard|billed|monthly|yearly|annually|per month|save|discount|coupon|shipping|buy now|add to cart|sold out|in stock)\b/i.test(candidate)) continue;
    if (/\b(?:available at|billed|save)\b/i.test(candidate)) continue;
    const clean = candidate
      .replace(/\s*[-–—]\s*(?:annually|monthly|yearly)?\s*$/i, "")
      .replace(/\s+\$?\d[\d,.]*\s*(?:K|M|B|%|x)?\s+[A-Z][A-Za-z]*\s*$/, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    if (!clean || clean.length < 3) continue;
    return clean.length > 60 ? `${clean.slice(0, 59).trim()}…` : clean;
  }
  return "";
}

const NAV_SEQUENCE = /\b(?:products?|resources?|pricing|docs?|blog|playground|customers?|solutions?|enterprise|login|signup|demo|careers?|about|contact|support|trust|status)\b.*\b(?:products?|resources?|pricing|docs?|blog|playground|customers?|solutions?|enterprise|login|signup|demo|careers?|about|contact|support|trust|status)\b/i;

function scoreFeature(title, desc, index) {
  const text = cleanText(title);
  if (!text) return -1;
  let score = 12 - index * 0.6;
  const words = text.split(/\s+/).length;
  if (words >= 2 && words <= 7) score += 5;
  else if (words <= 10) score += 2;
  else score -= 3;
  if (/[.!?]$/.test(text)) score += 1;
  if (desc && cleanText(desc).length > 18) score += 4;
  if (/\b(?:pricing|plans?|about|careers?|blog|support|contact|terms|privacy|cookies?|legal|login|sign ?in|sign ?up)\b/i.test(text)) score -= 9;
  if (isNavigational(text)) score -= 12;
  if (/^(?:why|what|how)\b/i.test(text)) score -= 2;
  return score;
}

const FEATURE_STOP = /^(?:help|help and security|security|capabilities|features?|products?|solutions?|resources|platform|pricing|plans?|docs?|blog|faq|about|company|careers?|contact|support|integrations?|customers?|enterprise|overview|why \w+|how it works|use cases?|testimonials?|reviews?|more|learn more|get started|try (?:it )?free|book (?:a )?demo|request (?:a )?demo|sign (?:up|in)|log ?in)$/i;

function pairFeatures(headings, paragraphs) {
  const seen = new Set();
  const candidates = [];
  headings.forEach((heading, index) => {
    const title = cleanText(heading);
    if (!title || title.length > 90 || seen.has(title.toLowerCase())) return;
    if (FEATURE_STOP.test(title)) return;
    if (title.split(/\s+/).length === 1 && !/^(?:ai|api|sdk)$/i.test(title)) return;
    seen.add(title.toLowerCase());
    candidates.push({ title, desc: "", index });
  });
  const body = paragraphs.map((value) => cleanText(value)).filter((value) => value.length > 45);
  for (const candidate of candidates) {
    const needle = candidate.title.toLowerCase();
    const direct = body.find((value) => value.toLowerCase().includes(needle));
    if (direct) {
      const after = direct.slice(direct.toLowerCase().indexOf(needle) + candidate.title.length).replace(/^[\s:—–-]+/, "").trim();
      const firstSentence = (after.match(/^[^.!?]{25,180}[.!?]?/) || [])[0] || "";
      if (firstSentence.length > 25) { candidate.desc = firstSentence.trim(); continue; }
    }
    const stem = needle.split(/\s+/).filter((word) => word.length > 4).slice(0, 2);
    if (stem.length) {
      const related = body.find((value) => {
        const lower = value.toLowerCase();
        return stem.some((word) => lower.includes(word)) && !lower.includes(needle);
      });
      if (related) {
        const sentence = (cleanText(related).match(/^[^.!?]{30,170}[.!?]?/) || [])[0] || "";
        if (sentence.length > 30) candidate.desc = sentence.trim();
      }
    }
  }
  const scored = candidates.map((candidate) => ({ ...candidate, score: scoreFeature(candidate.title, candidate.desc, candidate.index) }))
    .filter((candidate) => candidate.score > 4)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 24).map(({ title, desc, score }) => ({ title, desc: desc || "", weight: Number(score.toFixed(2)) }));
}

function brandColors(rawColors) {
  const usable = [];
  for (const value of rawColors) {
    const hex = normalizeHex(value);
    if (!hex || !isRealColor(hex)) continue;
    if (usable.some((existing) => hexDistance(existing, hex) < 42)) continue;
    usable.push(hex);
  }
  return usable
    .map((hex) => ({ hex, sat: saturation(hex), lum: luminance(hex) }))
    .sort((a, b) => b.sat - a.sat || Math.abs(0.5 - a.lum) - Math.abs(0.5 - b.lum))
    .map((entry) => entry.hex)
    .slice(0, 4);
}

function extractAssets(html, base) {
  const assets = [];
  for (const match of String(html || "").matchAll(/<img\b[^>]*>/gi)) {
    const url = absoluteUrl(attr(match[0], "src") || attr(match[0], "data-src"), base);
    if (url) assets.push({ type: "image", url, alt: clipped(attr(match[0], "alt"), 120) });
  }
  for (const match of String(html || "").matchAll(/<(?:video|source)\b[^>]*>/gi)) {
    const url = absoluteUrl(attr(match[0], "src") || attr(match[0], "data-src"), base);
    if (url) assets.push({ type: "video", url, alt: "" });
  }
  return uniqueAssets(assets).slice(0, 40);
}

function uniqueAssets(assets) {
  const seen = new Set();
  return assets.filter((asset) => {
    if (seen.has(asset.url)) return false;
    seen.add(asset.url);
    return true;
  });
}

function detectInteractions(source, isMarkdown = false) {
  const found = [];
  if (isMarkdown) {
    const lower = String(source || "").toLowerCase();
    if (/\b(?:search|find anything|query)\b/i.test(lower)) found.push({ interaction: "search", target: "search input", source: "text-inference", confidence: "medium" });
    if (/\b(?:filter|sort by|segment)\b/i.test(lower)) found.push({ interaction: "filter", target: "filter control", source: "text-inference", confidence: "medium" });
    if (/\b(?:upload|drag and drop|drop files?|import)\b/i.test(lower)) found.push({ interaction: "upload", target: "file upload", source: "text-inference", confidence: "medium" });
    if (/\b(?:video|player|watch demo|watch video)\b/i.test(lower)) found.push({ interaction: "media", target: "embedded media", source: "text-inference", confidence: "medium" });
    if (/\b(?:tabs?|tabbed)\b/i.test(lower)) found.push({ interaction: "tab", target: "tab navigation", source: "text-inference", confidence: "medium" });
    return found;
  }
  const text = String(source || "");
  if (/<(?:input\b[^>]*(?:type=["']search["']|name=["'][^"']*(?:search|query|\bq\b)|placeholder=["'][^"']*search|id=["'][^"']*search|aria-label=["'][^"']*search)|form\b[^>]*(?:role=["']search["']|action=[^"'>]*search|class=[^"'>]*search|id=[^"'>]*search))/i.test(text)) {
    found.push({ interaction: "search", target: "search input", source: "html-structure", confidence: "high" });
  }
  if (/<(?:select\b|input\b[^>]*(?:name|placeholder|aria-label|id|class)=["'][^"']*(?:filter|sort)[^"']*|[^>]*role=["'](?:listbox|combobox)["']|[^>]+(?:data-filter\b|class=["'][^"']*\b(?:filter-btn|filters?|facet)\b[^"']*))/i.test(text)) {
    found.push({ interaction: "filter", target: "filter control", source: "html-structure", confidence: "high" });
  }
  if (/<(?:input\b[^>]*type=["']file["']|form\b[^>]*enctype=["']multipart\/form-data["']|[^>]+(?:class=["'][^"']*\b(?:dropzone|file-upload|upload-dropzone)\b|data-upload\b))/i.test(text)) {
    found.push({ interaction: "upload", target: "file upload", source: "html-structure", confidence: "high" });
  }
  if (/<(?:video|iframe)\b[^>]*>/i.test(text)) {
    found.push({ interaction: "media", target: "embedded media", source: "html-structure", confidence: "high" });
  }
  if (/<[^>]+(?:role=["']tab(?:list|panel)?["']|data-tabs?|data-toggle=["']tab["']|class=["'][^"']*\b(?:tabs?|tab-list|tab-bar|tab-nav|nav-tabs)\b[^"']*)/i.test(text)) {
    found.push({ interaction: "tab", target: "tab navigation", source: "html-structure", confidence: "high" });
  }
  if (/<[^>]+(?:role=["']switch["']|type=["']checkbox["']|class=["'][^"']*\b(?:toggle|switch|slider)\b[^"']*|data-toggle\b)/i.test(text)) {
    found.push({ interaction: "toggle", target: "toggle switch", source: "html-structure", confidence: "high" });
  }
  if (/<(?:dialog\b|[^>]+(?:role=["']dialog["']|class=["'][^"']*\b(?:modal|drawer|dialog|popup|overlay)\b[^"']*|data-modal\b|aria-modal=["']true["']))/i.test(text)) {
    found.push({ interaction: "modal", target: "modal dialog", source: "html-structure", confidence: "high" });
  }
  if (/<[^>]+(?:class=["'][^"']*\b(?:scroll-container|overflow-scroll|carousel|swiper|slider)\b|data-scroll\b)/i.test(text)) {
    found.push({ interaction: "scroll", target: "scroll container", source: "html-structure", confidence: "medium" });
  }
  if (/<(?:form\b[^>]*>[^]*?<input\b|input\b[^>]*type=["'](?:text|email|tel|url|number)["'])/i.test(text) && !found.some((f) => f.interaction === "search")) {
    found.push({ interaction: "click", target: "form input", source: "html-structure", confidence: "medium" });
  }
  return found;
}

function parsePage(url, html, { isMarkdown = false } = {}) {
  const source = String(html || "");
  const visible = isMarkdown ? source.replace(/```[\s\S]*?```/g, " ") : source.replace(/<(script|style|noscript|svg)\b[\s\S]*?<\/\1>/gi, " ");
  const title = isMarkdown ? clipped((source.match(/^Title:\s*(.+)$/im) || [])[1], 160) : clipped((source.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 160);
  const headings = isMarkdown ? unique([...source.matchAll(/^#{1,3}\s+(.+)$/gm)].map((match) => clipped(match[1], 120))) : unique(["h1", "h2", "h3"].flatMap((tag) => tagTexts(visible, tag)));
  const paragraphs = isMarkdown ? unique(source.split(/\n+/).map((line) => clipped(line.replace(/^[-*>\s]+/, ""), 320)).filter((line) => line.length > 45)) : tagTexts(visible, "p");
  const plain = cleanText(visible).slice(0, 18000);
  const anchors = isMarkdown ? [] : linksFrom(source, url);
  const images = isMarkdown ? [] : extractAssets(source, url);
  const rawColors = brandColors(unique([
    ...source.match(/#[0-9a-f]{3,8}\b/gi) || [],
    ...source.match(/rgba?\([^)]*\)/gi) || [],
  ].map((value) => value.startsWith("rgb") ? toRgbHex(value) : value).filter(Boolean)));
  const colors = rawColors;
  const fonts = unique([
    ...[...source.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map((match) => clipped(match[1], 80)),
    ...[...source.matchAll(/family=([^&"']+)/gi)].map((match) => decodeURIComponent(match[1]).replace(/\+/g, " ")),
  ]).slice(0, 8);
  const ctaTexts = isMarkdown ? [] : unique([...source.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)].map((match) => clipped(match[1], 80)).filter((text) => text.length > 1 && !isNavigational(text))).slice(0, 12);
  const stats = isMarkdown ? [] : extractStats(plain);
  const quotes = isMarkdown ? [] : tagTexts(visible, "blockquote").filter((text) => !isNavigational(text)).slice(0, 4).map((text) => ({ text, author: "" }));
  const icon = !isMarkdown && (source.match(/<link\b[^>]*(?:rel\s*=\s*["'][^"']*icon|rel\s*=\s*["']apple-touch-icon)[^>]*>/i) || [])[0];
  const logoTag = !isMarkdown && (source.match(/<(?:img|svg)\b[^>]*(?:logo|brand|wordmark)[^>]*>/i) || [])[0];
  const logo = absoluteUrl(icon ? attr(icon, "href") : logoTag ? attr(logoTag, "src") : metaValue(source, "og:image"), url);
  const landmarkText = `${source} ${plain}`.toLowerCase();
  const interactions = detectInteractions(source, isMarkdown);
  return {
    url,
    role: roleFor(url, `${title} ${headings.join(" ")}`),
    title: title || new URL(url).hostname,
    description: metaValue(source, "description") || metaValue(source, "og:description") || paragraphs[0] || "",
    headings: headings.slice(0, 16),
    paragraphs: paragraphs.slice(0, 10),
    anchors: anchors.filter((link) => link.url).slice(0, 40),
    assets: images,
    colors,
    fonts,
    ctaTexts,
    stats,
    quotes,
    logo,
    interactions,
    landmarks: {
      navigation: /<nav\b|\bnav\b/.test(landmarkText),
      hero: /<main\b|hero|headline|<h1\b/.test(landmarkText),
      cta: ctaTexts.length > 0 || /get started|sign up|try free|book a demo|learn more/.test(landmarkText),
      pricing: /pricing|plans|per month|\$\d+/.test(landmarkText),
      proof: /customer|trusted|testimonial|case stud|reviews?/.test(landmarkText),
      footer: /<footer\b|\bfooter\b/.test(landmarkText),
    },
  };
}

function pageCandidates(home, origin, limit) {
  const candidates = home.anchors
    .filter((link) => {
      try { return new URL(link.url).origin === origin && new URL(link.url).pathname !== "/"; } catch { return false; }
    })
    .map((link) => ({ ...link, score: candidateScore(link.url, link.text) }))
    .filter((link) => link.score > 0)
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));
  const seen = new Set();
  return candidates.filter((link) => {
    const key = new URL(link.url).pathname;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, limit);
}

function candidateScore(url, text) {
  const value = `${url} ${text}`.toLowerCase();
  return [
    [/product|platform|features?|demo|workflow|editor/, 8],
    [/customers?|case-stud|testimonials?|reviews?/, 7],
    [/pricing|plans/, 6],
    [/docs?|developers?|api|reference/, 5],
    [/about|company|security|use-cases?/, 3],
  ].reduce((score, [re, points]) => score + (re.test(value) ? points : 0), 0);
}

function screenshotUrl(pageUrl, width, height, fullPage = false) {
  const target = new URL("https://api.microlink.io/");
  target.searchParams.set("url", pageUrl);
  target.searchParams.set("screenshot", "true");
  target.searchParams.set("meta", "false");
  target.searchParams.set("embed", "screenshot.url");
  target.searchParams.set("viewport.width", String(width));
  target.searchParams.set("viewport.height", String(height));
  if (fullPage) target.searchParams.set("screenshot.fullPage", "true");
  return target.href;
}

function screenshotCandidates(page, index) {
  const prefix = `page-${index + 1}`;
  const meta = { page: page.url, pageRole: page.role, source: "server-reader" };
  const candidates = [
    { ...meta, id: `${prefix}-desktop`, url: screenshotUrl(page.url, 1440, 900), viewport: { width: 1440, height: 900 }, kind: "screenshot", role: page.role, priority: index === 0 ? 1 : 0.78 },
  ];
  if (index === 0) {
    candidates.push({ ...meta, id: `${prefix}-tablet`, url: screenshotUrl(page.url, 1024, 768), viewport: { width: 1024, height: 768 }, kind: "screenshot", role: page.role, state: "tablet", priority: 0.82 });
    candidates.push({ ...meta, id: `${prefix}-mobile`, url: screenshotUrl(page.url, 390, 844), viewport: { width: 390, height: 844 }, kind: "screenshot", role: page.role, state: "responsive", priority: 0.74 });
    candidates.push({ ...meta, id: `${prefix}-fullpage`, url: screenshotUrl(page.url, 1440, 900, true), viewport: { width: 1440, height: 900 }, kind: "fullpage", role: "overview", state: "fullpage", priority: 0.92 });
  } else if (["workflow", "result", "pricing"].includes(page.role)) {
    candidates.push({ ...meta, id: `${prefix}-mobile`, url: screenshotUrl(page.url, 390, 844), viewport: { width: 390, height: 844 }, kind: "screenshot", role: page.role, state: "responsive", priority: 0.74 });
  }
  return candidates;
}

function inferCategory(text) {
  const value = text.toLowerCase();
  if (/api|developer|sdk|terminal|deploy|repository|code/.test(value)) return "developer tool";
  if (/finance|bank|wealth|insurance|legal|health|wellness/.test(value)) return "professional service";
  if (/shop|store|fashion|food|creator|social|play/.test(value)) return "consumer product";
  if (/analytics|metrics|report|dashboard|data/.test(value)) return "data product";
  return "software product";
}

function cleanBrandTitle(value, hostname) {
  const text = clipped(value, 64);
  if (!text) return "";
  const parts = text.split(/\s[|–—·]\s|\s[-:]\s/).map((part) => part.trim()).filter(Boolean);
  const brand = parts[0] || text;
  if (brand.length >= 2 && brand.length <= 32 && !isNavigational(brand)) return brand;
  return clipped(hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " "), 32);
}

function pickHeadline(home) {
  const candidates = unique(home.headings.slice(0, 8))
    .map((value) => cleanText(value))
    .filter((value) => value.length >= 12 && value.length <= 130 && !isNavigational(value));
  if (!candidates.length) return home.title || "";
  const titleStem = cleanText(home.title || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").split(/\s+/).filter((word) => word.length > 3);
  const scored = candidates.map((value, index) => {
    let score = 14 - index * 1.6;
    const words = value.split(/\s+/).length;
    if (words >= 4 && words <= 12) score += 6;
    else if (words <= 3) score -= 4;
    else if (words > 16) score -= 5;
    if (/[.!?]$/.test(value)) score -= 2;
    if (/^(?:why|how|what|meet|introducing|welcome|welcome to)\b/i.test(value)) score -= 4;
    if (/\b(?:with|without|for|that|your|every|more|less|faster|better|simpler|from|into|the|when|so)\b/i.test(value)) score += 2;
    if (/\d/.test(value)) score += 1;
    if (isNavigational(value)) score -= 14;
    const stem = cleanText(value).toLowerCase().replace(/[^a-z0-9 ]/g, " ");
    if (titleStem.length) {
      const overlap = titleStem.filter((word) => stem.includes(word)).length / titleStem.length;
      score += overlap * 3;
    }
    return { value, score };
  }).sort((a, b) => b.score - a.score);
  return scored[0].value;
}

function collectLogos(pages) {
  const names = [];
  for (const page of pages) {
    for (const text of page.ctaTexts) {
      const value = cleanText(text);
      if (value.length < 2 || value.length > 24) continue;
      if (isNavigational(value)) continue;
      if (FEATURE_STOP.test(value)) continue;
      if (/\b(?:free|annually|monthly|billed|save|demo|trial|plans?|pricing|integrations?|playground|setup|open source)\b/i.test(value)) continue;
      if (/\d/.test(value)) continue;
      if (!/^[A-Z][A-Za-z0-9&'’.\-]*(?: [A-Z][A-Za-z0-9&'’.\-]*){0,2}$/.test(value)) continue;
      names.push(value);
    }
  }
  return unique(names).slice(0, 5);
}

function buildBrief(normalized, pages, candidates, diagnostics, providerConfigured) {
  const home = pages[0];
  const allHeadings = unique(pages.flatMap((page) => page.headings));
  const allParagraphs = unique(pages.flatMap((page) => page.paragraphs));
  const headline = pickHeadline(home) || home.title || normalized.hostname;
  const name = cleanBrandTitle(home.title || normalized.hostname, normalized.hostname);
  const headlineKey = cleanText(headline).toLowerCase();
  const allFeatures = pairFeatures(allHeadings, allParagraphs)
    .filter((feature) => cleanText(feature.title).toLowerCase() !== headlineKey);
  const features = allFeatures.slice(0, 4);
  const featureCatalog = allFeatures.slice(0, 16);
  const allStats = [];
  for (const page of pages) {
    for (const stat of page.stats) {
      if (allStats.length >= 12) break;
      const key = stat.value.toLowerCase();
      if (allStats.some((existing) => existing.value.toLowerCase() === key)) continue;
      if (/(?:^| )\$(?:0|100|17|20|200)(?:\b|$)/.test(stat.value) && /(?:more usage|than pro|from\b)/i.test(stat.label)) continue;
      if (stat.label.length < 3) continue;
      allStats.push(stat);
    }
  }
  const stats = allStats.slice(0, 6);
  const allQuotes = pages.flatMap((page) => page.quotes).filter((quote) => quote.text && quote.text.length > 20).slice(0, 4);
  const homeUrl = normalized.href;
  const facts = { stats, quotes: allQuotes, features };
  const claims = [];
  if (facts.stats.length) facts.stats.forEach((s, i) => claims.push({ id: `stat-${i+1}`, claim: `${s.value} ${s.label}`, source_url: homeUrl, type: 'stat' }));
  if (facts.quotes.length) facts.quotes.forEach((q, i) => claims.push({ id: `quote-${i+1}`, claim: q.text, source_url: homeUrl, type: 'quote' }));
  facts.features.forEach((f, i) => claims.push({ id: `feature-${i+1}`, claim: f.title, source_url: f.evidence?.page || homeUrl, type: 'feature' }));

  const seenInteractions = new Set();
  const interactionTrace = [];
  for (const page of pages) {
    for (const item of (page.interactions || [])) {
      if (!seenInteractions.has(item.interaction)) {
        seenInteractions.add(item.interaction);
        interactionTrace.push({ ...item, order: interactionTrace.length + 1 });
      }
    }
  }

  const allLogos = collectLogos(pages);
  const logo = home.logo || "";
  const colors = unique(pages.flatMap((page) => page.colors)).slice(0, 4);
  const fonts = unique(pages.flatMap((page) => page.fonts)).slice(0, 8);
  const primary = candidates.filter((candidate) => candidate.kind !== "fullpage").filter((candidate) => candidate.viewport.width === 1440);
  const fullpage = candidates.find((candidate) => candidate.kind === "fullpage")?.url || "";
  const pageRecords = pages.map((page) => ({ url: page.url, role: page.role, title: page.title, headline: page.headings[0] || page.title, description: page.description, headings: page.headings.slice(0, 12) }));
  const evidenceAssets = candidates.map((candidate) => ({
    id: candidate.id,
    url: candidate.url,
    page: candidate.page,
    pageRole: candidate.pageRole,
    role: candidate.role,
    kind: candidate.kind,
    fullPage: candidate.kind === "fullpage",
    viewport: candidate.viewport?.width === 390 ? "mobile" : candidate.viewport?.width === 1024 ? "tablet" : "desktop",
    width: candidate.viewport?.width || 0,
    height: candidate.viewport?.height || 0,
    state: candidate.state || "default",
    priority: candidate.priority || 0,
    crop: "full",
    focalPoint: "center",
    safeTextRegions: ["top", "bottom"],
    source: candidate.source || "server-reader",
  }));
  const sourceAssets = pages.flatMap((page) => page.assets.map((asset, index) => ({ id: `${page.role}-asset-${index + 1}`, url: asset.url, page: page.url, role: page.role, kind: asset.type, alt: asset.alt || "" }))).slice(0, 24);
  return {
    name,
    domain: normalized.hostname.replace(/^www\./, ""),
    url: normalized.href,
    headline: clipped(headline, 140),
    description: clipped(home.description || allParagraphs[0] || "", 360),
    category: inferCategory(`${name} ${headline} ${home.description} ${features.map((feature) => feature.title).join(" ")}`),
    features,
    featureCatalog,
    stats,
    quotes: allQuotes,
    claims,
    logos: allLogos,
    colors,
    logo,
    logoAspect: 0,
    screenshots: primary.map((candidate) => candidate.url).slice(0, 8),
    fullpage,
    hookCandidates: unique([headline, ...home.headings, ...features.map((feature) => feature.title)].map((value) => cleanText(value)).filter((value) => value.length >= 6 && !isNavigational(value))).slice(0, 8),
    pages: pageRecords,
    pageRoles: pageRecords.map((page) => ({ url: page.url, role: page.role })),
    screenshotCandidates: candidates,
    evidenceAssets,
    fullpages: fullpage ? [fullpage] : [],
    sourceAssets,
    interactionTrace: interactionTrace.slice(0, 8),
    visualTokens: { mode: colors.length && luminance(colors[0]) !== null && luminance(colors[0]) < 0.42 ? "dark-signal" : "light-signal", typography: fonts[0] || "reader-inferred" },
    evidence: {
      pages: pages.map((page, index) => ({
        url: page.url,
        role: page.role,
        title: page.title,
        headings: page.headings.slice(0, 8),
        landmarks: page.landmarks,
        screenshotIds: screenshotCandidates(page, index).map((candidate) => candidate.id),
      })),
      assets: uniqueAssets(pages.flatMap((page) => page.assets)).slice(0, 40),
      brand: { colors, fonts, logo },
      flows: pages.filter((page) => page.role === "workflow" || page.role === "product").map((page) => ({ page: page.url, cues: page.ctaTexts.slice(0, 4) })).slice(0, 6),
    },
    diagnostics: {
      reader: providerConfigured ? "jev-assisted-or-direct" : "direct-html",
      pagesAttempted: diagnostics.pagesAttempted,
      pagesRead: pages.length,
      pageErrors: diagnostics.pageErrors,
      screenshotCandidates: candidates.length,
      visualEvidence: candidates.length >= 3 ? "multiple-candidates" : "limited",
    },
  };
}

async function readWebsite(value, { maxPages = 4 } = {}) {
  const normalized = normalizeUrl(value);
  const pageLimit = Number.isFinite(Number(maxPages)) ? Math.max(1, Math.min(6, Number(maxPages))) : 4;
  const jevKey = typeof process.env.JEV_KEY === "string" ? process.env.JEV_KEY.trim() : "";
  const direct = await fetchText(normalized.href, { timeout: 12000 });
  let homeResponse = direct;
  let isMarkdown = false;
  const directPage = direct.ok ? parsePage(normalized.href, direct.text) : null;
  const needsProviderFallback = !direct.ok || !directPage?.headings.length && !directPage?.paragraphs.length;
  if (jevKey && needsProviderFallback) {
    const provider = await fetchText(`https://r.jina.ai/${normalized.href}`, { timeout: 12000, headers: { Authorization: `Bearer ${jevKey}`, Accept: "text/plain" } });
    if (provider.ok) { homeResponse = provider; isMarkdown = true; }
  }
  if (!homeResponse.ok) {
    const err = new Error("The website could not be read from the server.");
    err.code = homeResponse.reason === "timeout" ? "read_timeout" : "site_unreachable";
    err.status = homeResponse.status;
    throw err;
  }

  const home = !isMarkdown && directPage ? directPage : parsePage(normalized.href, homeResponse.text, { isMarkdown });
  const selected = isMarkdown ? [] : pageCandidates(home, normalized.origin, Math.max(0, pageLimit - 1));
  const routeResults = await Promise.all(selected.map(async (candidate) => {
    const response = await fetchText(candidate.url, { timeout: 9000 });
    return response.ok ? parsePage(candidate.url, response.text) : { url: candidate.url, role: roleFor(candidate.url, candidate.text), title: candidate.text || candidate.url, headings: [], paragraphs: [], anchors: [], assets: [], colors: [], fonts: [], ctaTexts: [], stats: [], quotes: [], logo: "", landmarks: {}, error: response.reason || `http_${response.status}` };
  }));
  const pages = [home, ...routeResults.filter((page) => !page.error)];
  const candidates = pages.flatMap((page, index) => screenshotCandidates(page, index));
  return buildBrief(normalized, pages, candidates, { pagesAttempted: 1 + selected.length, pageErrors: routeResults.filter((page) => page.error).map((page) => ({ url: page.url, error: page.error })).slice(0, 8) }, Boolean(jevKey));
}

export { normalizeUrl, readWebsite };
