// Fetches a circuit photo from Wikipedia at runtime (CORS-enabled REST API) and caches
// the result in localStorage. Falls back to the article's lead image, then to null
// (the caller then draws the track outline instead).

const CACHE_KEY = 'f1earth.photos.v2';
let cache = {};
try { cache = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}'); } catch { cache = {}; }

function save() {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* storage unavailable */ }
}

const SKIP = /logo|map|layout|flag|diagram|icon|location|svg|track_?map|circuit_?map|signature|helmet/i;
const inflight = new Map();

function abs(src) {
  return src.startsWith('//') ? 'https:' + src : src;
}

// Wikimedia thumbnail URLs contain /NNNpx-; swap the width.
function sized(url, width) {
  return url.replace(/\/(\d+)px-/, `/${width}px-`);
}

async function lookup(title) {
  const t = encodeURIComponent(title);
  // 1) media-list: images in the order they appear in the article; take the first real photo.
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/media-list/${t}`);
    if (r.ok) {
      const j = await r.json();
      for (const item of j.items || []) {
        if (item.type !== 'image' || !item.srcset || !item.srcset.length) continue;
        if (!/\.jpe?g$/i.test(item.title || '')) continue;
        if (SKIP.test(item.title)) continue;
        const src = abs(item.srcset[0].src);
        return { thumb: sized(src, 160), large: sized(src, 800), credit: item.title.replace(/^File:/, '') };
      }
    }
  } catch { /* try next */ }
  // 2) summary lead image
  try {
    const r = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`);
    if (r.ok) {
      const j = await r.json();
      const img = j.originalimage || j.thumbnail;
      if (img && img.source) {
        const thumb = j.thumbnail ? sized(j.thumbnail.source, 160) : img.source;
        const large = j.thumbnail ? sized(j.thumbnail.source, 800) : img.source;
        return { thumb, large, credit: 'Wikipedia' };
      }
    }
  } catch { /* give up */ }
  return null;
}

export function getPhoto(title) {
  if (title in cache) return Promise.resolve(cache[title]);
  if (inflight.has(title)) return inflight.get(title);
  const p = lookup(title).then((res) => {
    // only cache successes, so a transient network failure is retried next visit
    if (res) { cache[title] = res; save(); }
    inflight.delete(title);
    return res;
  });
  inflight.set(title, p);
  return p;
}

// SVG of a track outline, used as a placeholder and fallback "photo".
export function trackSvg(coords, { stroke = '#e10600', width = 6, bg = 'transparent' } = {}) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  const k = Math.cos((coords[0][1] * Math.PI) / 180);
  const pts = coords.map(([x, y]) => [x * k, -y]);
  for (const [x, y] of pts) { w = Math.min(w, x); e = Math.max(e, x); s = Math.min(s, y); n = Math.max(n, y); }
  const size = Math.max(e - w, n - s) || 1;
  const pad = size * 0.12;
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${((x - w + pad + (size - (e - w)) / 2) / (size + 2 * pad) * 100).toFixed(2)},${((y - s + pad + (size - (n - s)) / 2) / (size + 2 * pad) * 100).toFixed(2)}`).join('');
  return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet" style="background:${bg}"><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
