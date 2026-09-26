/**
 * Server-side capture helpers: URL safety, sitemap discovery, brand extraction
 * from linked stylesheets, and screenshot/asset proxying.
 *
 * Everything here is stateless — nothing is stored. Screenshots are rendered by
 * the free thum.io service and streamed back same-origin through /api/shot so
 * the studio player, canvas and downloaded projects can all use them.
 */

const BLOCKED_HOST =
  /^(localhost|127\.|0\.|10\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/i;

// Alternate IP encodings and internal-only names.
const BLOCKED_PATTERNS = [
  /^0x[0-9a-f]+$/i, // Hexadecimal IP
  /^\d+$/, // Decimal IP
  /\[?::ffff:/i, // IPv4-mapped IPv6
  /^\[?f[cd][0-9a-f]{2}:/i, // IPv6 unique local
  /^\[?fe80:/i, // IPv6 link local
  /\.local$/i,
  /\.localhost$/i,
  /\.internal$/i,
];

export function safeUrl(raw: string): URL {
  let input = String(raw ?? "").trim();
  if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
  let u: URL;
  try {
    u = new URL(input);
  } catch {
    throw new Error("That doesn't look like a valid web address.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https addresses are supported.");
  }
  if (u.username || u.password) {
    throw new Error("Addresses with credentials are not supported.");
  }
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host || host.length > 253 || !host.includes(".")) {
    throw new Error("That address isn't reachable from the internet.");
  }
  if (BLOCKED_HOST.test(host) || BLOCKED_PATTERNS.some((re) => re.test(host))) {
    throw new Error("That address isn't reachable from the internet.");
  }
  if (host.includes("169.254.169.254") || /(^|\.)metadata(\.|$)/.test(host)) {
    throw new Error("That address isn't reachable from the internet.");
  }
  if (u.href.length > 2000) throw new Error("That address is too long.");
  u.hash = "";
  return u;
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36 SnapMySite/1.0";

/**
 * Fetches text, following redirects by hand so every hop is re-checked
 * against `safeUrl` (a public page can't bounce us onto a private address).
 */
export async function fetchText(url: string, timeoutMs = 12000, maxBytes = 3_000_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    let current = safeUrl(url).toString();
    for (let hop = 0; hop < 5; hop++) {
      const res = await fetch(current, {
        signal: ctrl.signal,
        redirect: "manual",
        headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,text/css,*/*" },
      });
      if (res.status >= 300 && res.status < 400) {
        const next = res.headers.get("location");
        await res.body?.cancel();
        if (!next) return null;
        current = safeUrl(new URL(next, current).toString()).toString();
        continue;
      }
      if (!res.ok) {
        await res.body?.cancel();
        return null;
      }
      const type = res.headers.get("content-type") ?? "";
      if (!/text|xml|html|css|javascript/i.test(type)) {
        await res.body?.cancel();
        return null;
      }
      const body = await res.text();
      return body.length > maxBytes ? body.slice(0, maxBytes) : body;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Sitemap discovery                                                   */
/* ------------------------------------------------------------------ */

const SKIP_EXT =
  /\.(png|jpe?g|gif|svg|webp|avif|ico|css|js|mjs|json|xml|pdf|zip|rar|gz|mp4|webm|mp3|wav|woff2?|ttf|otf|eot|dmg|exe|csv|txt)(\?|#|$)/i;

function samePageUrl(href: string, base: URL): string | null {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    if (u.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) return null;
    if (SKIP_EXT.test(u.pathname)) return null;
    u.hash = "";
    u.search = "";
    u.pathname = u.pathname.replace(/\/+$/, "") || "/";
    return u.toString();
  } catch {
    return null;
  }
}

/** Page URLs listed in the site's sitemap (follows up to a few sitemap indexes). */
export async function sitemapPages(origin: URL, limit = 60, timeoutMs = 6000): Promise<string[]> {
  const found = new Set<string>();
  const queue = [`${origin.origin}/sitemap.xml`, `${origin.origin}/sitemap_index.xml`];
  const seen = new Set<string>();
  while (queue.length && found.size < limit && seen.size < 4) {
    const mapUrl = queue.shift()!;
    if (seen.has(mapUrl)) continue;
    seen.add(mapUrl);
    const xml = await fetchText(mapUrl, timeoutMs, 2_000_000);
    if (!xml || !/<(urlset|sitemapindex)\b/i.test(xml)) continue;
    const isIndex = /<sitemapindex\b/i.test(xml);
    for (const m of xml.matchAll(/<loc>\s*(?:<!\[CDATA\[)?\s*([^<\s\]]+)/gi)) {
      if (isIndex) {
        if (queue.length < 4) queue.push(m[1]!);
        continue;
      }
      const n = samePageUrl(m[1]!, origin);
      if (n) found.add(n);
      if (found.size >= limit) break;
    }
  }
  return [...found];
}

/* ------------------------------------------------------------------ */
/* Brand extraction (includes linked stylesheets)                      */
/* ------------------------------------------------------------------ */

export type Brand = {
  siteName: string | null;
  favicon: string | null;
  logo: string | null;
  ogImage: string | null;
  colors: string[];
  fonts: string[];
};

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i").exec(tag);
  return m ? m[1]! : null;
}

function abs(href: string | null, base: URL): string | null {
  if (!href) return null;
  try {
    const u = new URL(href, base);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

function hexOf(color: string): string | null {
  const c = color.trim().toLowerCase();
  const short = /^#([0-9a-f]{3})$/.exec(c);
  if (short)
    return `#${short[1]!
      .split("")
      .map((x) => x + x)
      .join("")}`;
  const long = /^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/.exec(c);
  if (long) return `#${long[1]!}`;
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/.exec(c);
  if (rgb) {
    if (rgb[4] !== undefined && Number(rgb[4]) < 0.5) return null;
    return `#${[rgb[1]!, rgb[2]!, rgb[3]!]
      .map((n) =>
        Math.max(0, Math.min(255, Math.round(Number(n))))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")}`;
  }
  return null;
}

const GENERIC_FONT =
  /^(inherit|initial|unset|var\(|sans-serif|serif|monospace|system-ui|cursive|fantasy|ui-|-apple-system|blinkmacsystemfont|emoji|math|fangsong|segoe ui|helvetica|arial|roboto$)/i;

/** Brand kit from a page's HTML plus up to four of its linked stylesheets. */
export async function extractBrand(html: string, base: URL, timeoutMs = 8000): Promise<Brand> {
  const tags = html.match(/<(link|meta)\b[^>]*>/gi) ?? [];
  let favicon: string | null = null;
  let ogImage: string | null = null;
  let siteName: string | null = null;
  let themeColor: string | null = null;
  const sheets: string[] = [];

  for (const tag of tags) {
    const rel = (attr(tag, "rel") ?? "").toLowerCase();
    const prop = (attr(tag, "property") ?? attr(tag, "name") ?? "").toLowerCase();
    if (/icon/.test(rel) && !favicon) favicon = abs(attr(tag, "href"), base);
    if (rel === "apple-touch-icon") favicon = abs(attr(tag, "href"), base) ?? favicon;
    if (prop === "og:image" && !ogImage) ogImage = abs(attr(tag, "content"), base);
    if (prop === "og:site_name") siteName = attr(tag, "content") ?? siteName;
    if (prop === "theme-color") themeColor = hexOf(attr(tag, "content") ?? "");
    if (rel.includes("stylesheet") && sheets.length < 4) {
      const href = abs(attr(tag, "href"), base);
      if (href) sheets.push(href);
    }
  }

  let logo: string | null = null;
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    if (/logo|brand|wordmark/i.test(m[0])) {
      logo = abs(attr(m[0], "src") ?? attr(m[0], "data-src"), base);
      if (logo) break;
    }
  }

  let css = "";
  for (const m of html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) css += `\n${m[1]}`;
  const sheetTexts = await Promise.all(sheets.map((s) => fetchText(s, timeoutMs, 1_200_000)));
  for (const t of sheetTexts) if (t) css += `\n${t}`;
  const haystack = `${css}\n${html}`;

  const counts = new Map<string, number>();
  let scanned = 0;
  for (const m of haystack.matchAll(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]{5,40}\)/g)) {
    if (++scanned > 20000) break;
    const hex = hexOf(m[0]);
    if (hex) counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }
  const colors: string[] = themeColor ? [themeColor] : [];
  for (const [hex] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    if (colors.length >= 12) break;
    if (!colors.includes(hex)) colors.push(hex);
  }

  const fonts = new Set<string>();
  for (const m of haystack.matchAll(/fonts\.googleapis\.com\/css2?\?([^"'<>)]+)/gi)) {
    for (const f of m[1]!.match(/family=([^&:]+)/g) ?? []) {
      fonts.add(decodeURIComponent(f.replace("family=", "")).replace(/\+/g, " "));
    }
  }
  for (const m of haystack.matchAll(/font-family\s*:\s*([^;}{]+)/gi)) {
    for (const part of m[1]!.split(",")) {
      const name = part.replace(/["']/g, "").trim();
      if (!name || name.length > 40 || GENERIC_FONT.test(name)) continue;
      fonts.add(name);
      break;
    }
    if (fonts.size > 12) break;
  }

  return { siteName, favicon, logo, ogImage, colors, fonts: [...fonts].slice(0, 8) };
}

/* ------------------------------------------------------------------ */
/* Screenshots                                                          */
/* ------------------------------------------------------------------ */

export type ShotRequest = { url: string; width: number; height: number; full: boolean };

/** Same-origin screenshot URL served by /api/shot. */
export function shotUrl(
  origin: string,
  pageUrl: string,
  width: number,
  height: number,
  full = false,
) {
  const q = new URLSearchParams({
    url: pageUrl,
    w: String(width),
    h: String(height),
    full: full ? "1" : "0",
  });
  return `${origin.replace(/\/+$/, "")}/api/shot?${q.toString()}`;
}

/** thum.io render URL: the page at the given viewport width, cropped to the fold unless full. */
export function thumUrl({ url, width, height, full }: ShotRequest) {
  const parts = ["https://image.thum.io/get", `width/${width}`, `viewportWidth/${width}`];
  if (full) parts.push("fullpage");
  else parts.push(`crop/${height}`);
  parts.push("noanimate", url);
  return parts.join("/");
}
