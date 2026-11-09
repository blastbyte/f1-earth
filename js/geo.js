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

// Loads and decodes a terrain tile. Tiles are kept only when `keep` is set (the ones
// sampled along a track); the rest are passed straight on to the map.
export function loadTile(z, x, y, keep = true) {
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
  if (keep) {
    tileCache.set(key, promise);
    promise.catch(() => tileCache.delete(key));
  }
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

// [[west, south], [east, north]] of a tile.
export function tileBounds(z, x, y) {
  const n = 2 ** z;
  const lat = (ty) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
  return [[(x / n) * 360 - 180, lat(y + 1)], [((x + 1) / n) * 360 - 180, lat(y)]];
}

// Cut a road bed into terrain tile pixels (Terrarium RGBA, edited in place): level
// with the road within `inner` metres of the centreline, blending back to the
// original ground by `inner + 40` metres. `points` are [lon, lat], `elev` in metres.
export function carveRoad(data, size, z, x, y, points, elev, halfWidth) {
  const metres = (40075016.7 * Math.cos(toRad(points[0][1]))) / (2 ** z * size); // per pixel
  const inner = Math.max(15, halfWidth + 1.5 * metres), outer = inner + 40;
  const reach = Math.ceil(outer / metres);
  const dist = new Float32Array(size * size).fill(Infinity);
  const road = new Float32Array(size * size);
  let touched = false;
  for (let i = 0; i < points.length; i++) {
    const [tx, ty] = lonLatToTile(points[i][0], points[i][1], z);
    const fx = (tx - x) * size - 0.5, fy = (ty - y) * size - 0.5;
    if (fx < -reach || fy < -reach || fx > size + reach || fy > size + reach) continue;
    const x0 = Math.max(0, Math.floor(fx - reach)), x1 = Math.min(size - 1, Math.ceil(fx + reach));
    const y0 = Math.max(0, Math.floor(fy - reach)), y1 = Math.min(size - 1, Math.ceil(fy + reach));
    for (let py = y0; py <= y1; py++) {
      for (let px = x0; px <= x1; px++) {
        const d = Math.hypot(px - fx, py - fy) * metres;
        const k = py * size + px;
        if (d < dist[k]) { dist[k] = d; road[k] = elev[i]; touched = true; }
      }
    }
  }
  if (!touched) return;
  for (let k = 0; k < dist.length; k++) {
    if (dist[k] >= outer) continue;
    const t = Math.min(1, Math.max(0, (dist[k] - inner) / (outer - inner)));
    const w = 1 - t * t * (3 - 2 * t);
    const o = k * 4;
    const ground = data[o] * 256 + data[o + 1] + data[o + 2] / 256 - 32768;
    const v = ground + (road[k] - ground) * w + 32768;
    data[o] = Math.floor(v / 256);
    data[o + 1] = Math.floor(v) % 256;
    data[o + 2] = Math.min(255, Math.round((v - Math.floor(v)) * 256));
  }
}
