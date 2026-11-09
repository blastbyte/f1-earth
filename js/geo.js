// Geometry helpers and track elevation sampling.

const R = 6371008.8;
const toRad = (d) => (d * Math.PI) / 180;

export const TERRARIUM_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';

export function haversine(a, b) {
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function bbox(coords) {
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
  for (const [x, y] of coords) {
    if (x < w) w = x; if (x > e) e = x;
    if (y < s) s = y; if (y > n) n = y;
  }
  return [[w, s], [e, n]];
}

export function centroid(coords) {
  const [[w, s], [e, n]] = bbox(coords);
  return [(w + e) / 2, (s + n) / 2];
}

// Point along the track at fraction t (0..1) of total distance, with heading in degrees.
export function pointAt(samples, t) {
  const total = samples[samples.length - 1].d;
  const target = ((t % 1) + 1) % 1 * total;
  let lo = 0, hi = samples.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (samples[mid].d < target) lo = mid; else hi = mid;
  }
  const a = samples[lo], b = samples[hi];
  const f = (target - a.d) / ((b.d - a.d) || 1);
  const p = [a.p[0] + (b.p[0] - a.p[0]) * f, a.p[1] + (b.p[1] - a.p[1]) * f];
  const lat = toRad(p[1]);
  const heading = (Math.atan2((b.p[0] - a.p[0]) * Math.cos(lat), b.p[1] - a.p[1]) * 180) / Math.PI;
  return { p, heading, index: lo };
}

// ---- Terrarium elevation sampling (AWS Open Data terrain tiles) ----

const tileCache = new Map();

function lonLatToTile(lon, lat, z) {
  const n = 2 ** z;
  const x = ((lon + 180) / 360) * n;
  const latR = toRad(lat);
  const y = ((1 - Math.log(Math.tan(latR) + 1 / Math.cos(latR)) / Math.PI) / 2) * n;
  return [x, y];
}

function loadTile(z, x, y) {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      resolve({ size: img.width, data: ctx.getImageData(0, 0, img.width, img.height).data });
    };
    img.onerror = () => reject(new Error('tile ' + key));
    img.src = TERRARIUM_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y);
  });
  tileCache.set(key, promise);
  promise.catch(() => tileCache.delete(key));
  return promise;
}

function sampleTile(tile, fx, fy) {
  // bilinear interpolation
  const s = tile.size;
  const px = Math.min(s - 1.001, Math.max(0, fx * s - 0.5));
  const py = Math.min(s - 1.001, Math.max(0, fy * s - 0.5));
  const x0 = Math.floor(px), y0 = Math.floor(py);
  const tx = px - x0, ty = py - y0;
  const h = (x, y) => {
    const i = (y * s + x) * 4;
    const d = tile.data;
    return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768;
  };
  return (h(x0, y0) * (1 - tx) + h(x0 + 1, y0) * tx) * (1 - ty) + (h(x0, y0 + 1) * (1 - tx) + h(x0 + 1, y0 + 1) * tx) * ty;
}

// Returns the terrain elevation (metres) at each [lon, lat] point.
export async function sampleElevations(points, z = 15) {
  const needed = new Map();
  const locs = points.map((p) => {
    const [tx, ty] = lonLatToTile(p[0], p[1], z);
    const x = Math.floor(tx), y = Math.floor(ty);
    const key = `${x}/${y}`;
    if (!needed.has(key)) needed.set(key, loadTile(z, x, y));
    return { key, fx: tx - x, fy: ty - y };
  });
  const tiles = {};
  await Promise.all([...needed].map(async ([k, pr]) => { tiles[k] = await pr; }));
  return locs.map((l) => sampleTile(tiles[l.key], l.fx, l.fy));
}
