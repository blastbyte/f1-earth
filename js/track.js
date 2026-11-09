// Smooth track geometry: turns the circuit polyline into a curved centreline with
// heading, curvature and elevation, builds the 3D road mesh, and works out a speed
// profile (braking, cornering, acceleration) for driving a lap.

const R = 6371008.8;
const RAD = Math.PI / 180;

export const TRACK_WIDTH = 13; // metres
export const ROAD_LIFT = 0.3; // metres the road surface sits above the terrain's road bed
const KERB_WIDTH = 1.7;
const SKIRT_DEPTH = 3; // metres the road's sides reach below its surface

const wrapPi = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));

// Periodic Gaussian smoothing. `sigma` is in samples.
export function smoothClosed(arr, sigma) {
  if (sigma <= 0) return Array.from(arr);
  const n = arr.length;
  const r = Math.max(1, Math.ceil(sigma * 3));
  const w = [];
  let sum = 0;
  for (let k = -r; k <= r; k++) { const v = Math.exp(-(k * k) / (2 * sigma * sigma)); w.push(v); sum += v; }
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = -r; k <= r; k++) s += arr[(((i + k) % n) + n) % n] * w[k + r];
    out[i] = s / sum;
  }
  return out;
}

// Centripetal Catmull-Rom point between p1 and p2 (u in 0..1).
function catmullRom(p0, p1, p2, p3, u) {
  const knot = (a, b) => Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1])));
  const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
  const t = t1 + (t2 - t1) * u;
  const mix = (a, b, ta, tb) => {
    const f = (t - ta) / (tb - ta);
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
  };
  const a1 = mix(p0, p1, t0, t1), a2 = mix(p1, p2, t1, t2), a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2), b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

// Build a smooth closed centreline from circuit coordinates ([lon, lat], first == last).
// Samples are about `step` metres apart. Curvature is positive in right-hand corners.
export function buildPath(coords, step = 2.5) {
  const [lon0, lat0] = coords[0];
  const kx = Math.cos(lat0 * RAD) * R * RAD, ky = R * RAD;
  let P = [];
  for (const c of coords) {
    const q = [(c[0] - lon0) * kx, (c[1] - lat0) * ky];
    const last = P[P.length - 1];
    if (!last || Math.hypot(q[0] - last[0], q[1] - last[1]) > 0.5) P.push(q);
  }
  if (P.length > 1 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= 0.5) P.pop();
  const m = P.length;

  // 1) curve through the original points
  const dense = [];
  for (let i = 0; i < m; i++) {
    const p0 = P[(i - 1 + m) % m], p1 = P[i], p2 = P[(i + 1) % m], p3 = P[(i + 2) % m];
    const k = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1])));
    for (let j = 0; j < k; j++) dense.push(catmullRom(p0, p1, p2, p3, j / k));
  }

  // 2) resample at even spacing
  const cum = [0];
  for (let i = 0; i < dense.length; i++) {
    const a = dense[i], b = dense[(i + 1) % dense.length];
    cum.push(cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const rough = cum[dense.length];
  const n = Math.max(16, Math.round(rough / step));
  let xs = new Array(n), ys = new Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    const target = (i / n) * rough;
    while (cum[j + 1] < target) j++;
    const f = (target - cum[j]) / ((cum[j + 1] - cum[j]) || 1);
    const a = dense[j], b = dense[(j + 1) % dense.length];
    xs[i] = a[0] + (b[0] - a[0]) * f;
    ys[i] = a[1] + (b[1] - a[1]) * f;
  }

  // 3) round off the remaining kinks
  const sig = 4.5 / (rough / n);
  xs = smoothClosed(xs, sig);
  ys = smoothClosed(ys, sig);

  const d = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    d[i + 1] = d[i] + Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
  }
  const total = d[n];
  const ds = total / n;

  const heading = new Float64Array(n + 1); // radians, clockwise from north
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    heading[i] = Math.atan2(xs[b] - xs[a], ys[b] - ys[a]);
  }
  heading[n] = heading[0];
  let kappa = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = (i - 1 + n) % n, b = (i + 1) % n;
    kappa[i] = wrapPi(heading[b] - heading[a]) / (2 * ds);
  }
  const kappaRaw = kappa;
  kappa = smoothClosed(kappa, 7 / ds);

  const lonlat = (x, y) => [lon0 + x / kx, lat0 + y / ky];
  const samples = [];
  for (let i = 0; i <= n; i++) samples.push({ p: lonlat(xs[i % n], ys[i % n]), d: d[i] });

  return { n, ds, total, xs, ys, d, heading, kappa, kappaRaw, samples, lonlat, elev: null };
}

// Points to sample terrain at: centre, left edge and right edge of every section.
export function elevationPoints(path) {
  const pts = [];
  const hw = TRACK_WIDTH / 2 + 1;
  for (let i = 0; i < path.n; i++) {
    const h = path.heading[i], x = path.xs[i], y = path.ys[i];
    const rx = Math.cos(h), ry = -Math.sin(h); // unit vector to the right of travel
    pts.push(path.lonlat(x, y), path.lonlat(x - rx * hw, y - ry * hw), path.lonlat(x + rx * hw, y + ry * hw));
  }
  return pts;
}

// Combine raw terrain samples (3 per section) into one smooth elevation per sample.
// The terrain data is coarse and noisy (buildings and trees show up as bumps), so the
// road ignores raised blocks, has its gradient limited and is smoothed over a long
// distance. The terrain itself is then cut to match the road (see carveRoad).
const MAX_GRADIENT = 0.12;
const slide = (arr, reach, pick) => arr.map((_, i) => {
  let m = arr[i];
  for (let k = -reach; k <= reach; k++) m = pick(m, arr[(((i + k) % arr.length) + arr.length) % arr.length]);
  return m;
});
export function setElevation(path, raw) {
  const { n, ds } = path;
  const low = new Array(n);
  for (let i = 0; i < n; i++) low[i] = raw ? Math.min(raw[i * 3], raw[i * 3 + 1], raw[i * 3 + 2]) : 0;
  // Morphological opening: removes raised blocks shorter than twice the reach
  // (tree canopy, grandstands, buildings) but leaves real slopes where they are.
  const reach = Math.ceil(150 / ds);
  let e = slide(slide(low, reach, Math.min), reach, Math.max);
  const g = MAX_GRADIENT * ds;
  for (let pass = 0; pass < 2; pass++) {
    for (let i = 0; i < n; i++) e[i] = Math.max(e[i], e[(i - 1 + n) % n] - g);
    for (let i = n - 1; i >= 0; i--) e[i] = Math.max(e[i], e[(i + 1) % n] - g);
  }
  e = smoothClosed(e, 60 / ds);
  e.push(e[0]);
  path.elev = e;
  return e;
}

// Position, heading (degrees), curvature and elevation at distance s along the lap.
export function pathAt(path, s) {
  const { n, d, total } = path;
  s = ((s % total) + total) % total;
  let lo = Math.min(n - 1, Math.floor(s / path.ds));
  while (lo > 0 && d[lo] > s) lo--;
  while (lo < n - 1 && d[lo + 1] < s) lo++;
  const hi = lo + 1, j = hi % n;
  const f = (s - d[lo]) / ((d[hi] - d[lo]) || 1);
  const x = path.xs[lo] + (path.xs[j] - path.xs[lo]) * f;
  const y = path.ys[lo] + (path.ys[j] - path.ys[lo]) * f;
  const h = path.heading[lo] + wrapPi(path.heading[hi] - path.heading[lo]) * f;
  return {
    p: path.lonlat(x, y), x, y,
    heading: h / RAD,
    kappa: path.kappa[lo] + (path.kappa[j] - path.kappa[lo]) * f,
    elev: path.elev ? path.elev[lo] + (path.elev[hi] - path.elev[lo]) * f : 0
  };
}

// ---------------- 3D mesh ----------------

const mercX = (lon) => (lon + 180) / 360;
const mercY = (lat) => (1 - Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2)) / Math.PI) / 2;

// Interleaved vertices: x, y (mercator, relative to origin), elevation (m),
// u (m from centreline), v (m along the lap), lift (m), elevation 0..1, kind, depth bias.
// kind: 0 road, 1 kerb, 2 embankment.
export const VERTEX_FLOATS = 9;

export function buildMesh(path) {
  const { n } = path;
  const elev = path.elev;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) { min = Math.min(min, elev[i]); max = Math.max(max, elev[i]); }
  const span = Math.max(1, max - min);
  const [olon, olat] = path.lonlat(0, 0);
  const origin = [mercX(olon), mercY(olat)];
  const hw = TRACK_WIDTH / 2;
  const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

  const perSection = 10;
  const verts = new Float32Array((n + 1) * perSection * VERTEX_FLOATS);
  const idx = new Uint16Array(n * 5 * 6);
  let o = 0;
  const put = (x, y, e, u, v, lift, en, kind, bias) => {
    const [lon, lat] = path.lonlat(x, y);
    verts[o++] = mercX(lon) - origin[0]; verts[o++] = mercY(lat) - origin[1]; verts[o++] = e;
    verts[o++] = u; verts[o++] = v; verts[o++] = lift; verts[o++] = en; verts[o++] = kind; verts[o++] = bias;
  };
  for (let s = 0; s <= n; s++) {
    const i = s % n;
    const x = path.xs[i], y = path.ys[i], h = path.heading[i];
    const rx = Math.cos(h), ry = -Math.sin(h);
    const k = path.kappa[i];
    // On the inside of a very tight corner the edge must not cross the centre of the turn.
    const radius = 0.8 / Math.max(1e-6, Math.abs(path.kappaRaw[i]), Math.abs(k));
    const kerb = KERB_WIDTH * smooth(1 / 260, 1 / 110, Math.abs(k));
    const side = (sign) => {
      const inside = sign * k > 0;
      const edge = inside ? Math.min(hw, radius) : hw;
      const outer = inside ? Math.min(hw + kerb, radius) : hw + kerb;
      return { edge, outer };
    };
    const L = side(-1), Rt = side(1);
    const e = elev[i], en = (e - min) / span, v = path.d[s];
    const at = (off) => [x + rx * off, y + ry * off];
    const pl = at(-L.outer), el = at(-L.edge), er = at(Rt.edge), pr = at(Rt.outer);
    put(pl[0], pl[1], e, -hw - kerb - 1, v, -SKIRT_DEPTH, en, 2, 0);
    put(pl[0], pl[1], e, -hw - kerb, v, ROAD_LIFT, en, 2, 0);
    put(pl[0], pl[1], e, -hw - kerb, v, ROAD_LIFT, en, 1, 1);
    put(el[0], el[1], e, -hw, v, ROAD_LIFT, en, 1, 1);
    put(el[0], el[1], e, -hw, v, ROAD_LIFT, en, 0, 1);
    put(er[0], er[1], e, hw, v, ROAD_LIFT, en, 0, 1);
    put(er[0], er[1], e, hw, v, ROAD_LIFT, en, 1, 1);
    put(pr[0], pr[1], e, hw + kerb, v, ROAD_LIFT, en, 1, 1);
    put(pr[0], pr[1], e, hw + kerb, v, ROAD_LIFT, en, 2, 0);
    put(pr[0], pr[1], e, hw + kerb + 1, v, -SKIRT_DEPTH, en, 2, 0);
  }
  let q = 0;
  for (let s = 0; s < n; s++) {
    const a = s * perSection, b = a + perSection;
    for (let strip = 0; strip < 5; strip++) {
      const l0 = a + strip * 2, r0 = l0 + 1, l1 = b + strip * 2, r1 = l1 + 1;
      idx[q++] = l0; idx[q++] = r0; idx[q++] = l1;
      idx[q++] = r0; idx[q++] = r1; idx[q++] = l1;
    }
  }
  return { verts, idx, origin, metre: 1 / (2 * Math.PI * R * Math.cos(olat * RAD)), total: path.total };
}

// ---------------- Speed profile ----------------

const V_TOP = 95; // m/s
const cornerSpeed = (k) => {
  k = Math.abs(k);
  if (k < 1e-5) return V_TOP;
  // grip grows with downforce: v²·k = 16 + 0.0045·v², capped at about 5 g
  return Math.min(V_TOP, Math.sqrt(Math.min(16 / Math.max(k - 0.0045, 1e-6), 50 / k)));
};
const accelLimit = (v) => Math.max(0.3, Math.min(12, 940 / Math.max(v, 1)) - 0.0012 * v * v);
const brakeLimit = (v) => Math.min(50, 15 + 0.0045 * v * v);

// Speed at every sample for a lap from a standing start, timed so that a flying lap
// would match `lapSeconds`. Returns a function giving distance, speed and acceleration
// for a time since the start.
export function buildDrive(path, lapSeconds) {
  const { n, d } = path;
  const seg = (i) => d[(i % n) + 1] - d[i % n];
  const base = smoothClosed(path.kappa.map(cornerSpeed), 4 / path.ds);

  // Flying lap for a given cornering-grip multiplier. Goes round twice in each
  // direction so the start/finish joins up.
  const flyingLap = (grip) => {
    const fly = base.map((v) => Math.min(V_TOP, v * grip));
    for (let pass = 0; pass < 2; pass++) {
      for (let i = n - 1; i >= 0; i--) {
        const next = fly[(i + 1) % n];
        fly[i] = Math.min(fly[i], Math.sqrt(next * next + 2 * brakeLimit(next) * seg(i)));
      }
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        fly[j] = Math.min(fly[j], Math.sqrt(fly[i] * fly[i] + 2 * accelLimit(fly[i]) * seg(i)));
      }
    }
    let time = 0;
    for (let i = 0; i < n; i++) time += (2 * seg(i)) / (fly[i] + fly[(i + 1) % n]);
    return { fly, time };
  };
  // The centreline is tighter than a real racing line, so tune the cornering grip
  // until the lap time matches; any remainder is made up by scaling the speeds.
  let lo = 0.7, hi = 1.8;
  for (let k = 0; k < 12; k++) {
    const mid = (lo + hi) / 2;
    if (flyingLap(mid).time > lapSeconds) lo = mid; else hi = mid;
  }
  const { fly, time: flyTime } = flyingLap((lo + hi) / 2);
  const scale = Math.min(1.15, Math.max(0.85, flyTime / lapSeconds));

  // standing start, ending as the car crosses the line at speed
  let v = new Array(n + 1);
  v[0] = 0;
  for (let i = 0; i < n; i++) {
    const cap = fly[(i + 1) % n];
    v[i + 1] = Math.min(cap, Math.sqrt(v[i] * v[i] + 2 * accelLimit(v[i]) * seg(i)));
  }
  // soften pedal changes so the speed has no sudden kinks
  const sig = 9 / path.ds, r = Math.ceil(sig * 3);
  const soft = v.map((_, i) => {
    let s = 0, w = 0;
    for (let k = -r; k <= r; k++) {
      const j = Math.min(n, Math.max(0, i + k));
      const g = Math.exp(-(k * k) / (2 * sig * sig));
      s += v[j] * g; w += g;
    }
    const blend = Math.min(1, d[i] / 40); // keep the launch itself untouched
    return (v[i] * (1 - blend) + (s / w) * blend) * scale;
  });
  v = soft;
  const t = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) t[i + 1] = t[i] + (2 * (d[i + 1] - d[i])) / Math.max(0.05, v[i] + v[i + 1]);

  return {
    duration: t[n],
    topSpeed: Math.max(...v),
    at(time) {
      if (time <= 0) return { s: 0, v: 0, a: 0 };
      if (time >= t[n]) return { s: d[n], v: v[n], a: 0, done: true };
      let lo = 0, hi = n;
      while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= time) lo = mid; else hi = mid; }
      const dt = t[lo + 1] - t[lo], u = time - t[lo];
      const a = (v[lo + 1] - v[lo]) / dt;
      return { s: d[lo] + v[lo] * u + 0.5 * a * u * u, v: v[lo] + a * u, a };
    }
  };
}
