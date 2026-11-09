import { CIRCUITS, SEASON, enrichCircuits } from './data.js';
import { bbox, centroid, pointAt, sampleElevations, loadTile, tileBounds, carveRoad } from './geo.js';
import { ROAD_LIFT, TRACK_WIDTH, buildPath, elevationPoints, setElevation, pathAt, buildMesh, buildDrive } from './track.js';
import { createTrackLayer } from './tracklayer.js';
import { getPhoto, trackSvg } from './photos.js';

const maplibregl = window.maplibregl;
const $ = (s) => document.querySelector(s);
const isTouch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('touch', isTouch);

enrichCircuits(new Date());
const byId = Object.fromEntries(CIRCUITS.map((c) => [c.id, c]));
const active = CIRCUITS.filter((c) => !c.cancelled);
$('#race-count').textContent = `${active.length} races · ${CIRCUITS.length - active.length} cancelled`;

const OFM = 'https://tiles.openfreemap.org';
const LANDMARK_CLASSES = ['attraction', 'stadium', 'castle', 'monument', 'museum', 'place_of_worship', 'theatre', 'zoo', 'park', 'harbor', 'ferry_terminal'];
const nameField = ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name']];

// The flat 2D outline fades away close up, where the 3D track model takes over.
const lineOpacity = (far, model) => ['interpolate', ['linear'], ['zoom'], 5, 0, 7, far, ...(model ? [16.2, far, 17.2, 0] : [])];
const glowOpacity = (model) => ['interpolate', ['linear'], ['zoom'], 5, 0, 7, 0.6, 14, 0.25, ...(model ? [16.2, 0.25, 17.2, 0] : [])];

function buildStyle() {
  return {
    version: 8,
    projection: { type: 'globe' },
    glyphs: `${OFM}/fonts/{fontstack}/{range}.pbf`,
    sky: {
      'sky-color': '#0b1d44',
      'horizon-color': '#8cb8ff',
      'fog-color': '#cfe2ff',
      'sky-horizon-blend': 0.7,
      'horizon-fog-blend': 0.6,
      'fog-ground-blend': 0.85,
      'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 6, 0.8, 9, 0]
    },
    sources: {
      satellite: {
        type: 'raster',
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        maxzoom: 19,
        attribution: 'Imagery © <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
      },
      dem: {
        type: 'raster-dem',
        tiles: ['f1dem://{z}/{x}/{y}'],
        encoding: 'terrarium',
        tileSize: 256,
        maxzoom: 15,
        attribution: 'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/">Mapzen / AWS Open Data</a>'
      },
      omt: {
        type: 'vector',
        url: `${OFM}/planet`,
        attribution: '<a href="https://openfreemap.org">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/">OpenMapTiles</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      },
      tracks: { type: 'geojson', data: { type: 'FeatureCollection', features: [] }, attribution: 'Circuits: <a href="https://github.com/bacinger/f1-circuits">bacinger/f1-circuits</a>' },
      starts: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } },
      car: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } }
    },
    terrain: { source: 'dem', exaggeration: 1.5 },
    layers: [
      // Vector land/ocean underneath the imagery: visible while imagery loads, or if it fails.
      { id: 'land', type: 'background', paint: { 'background-color': '#30422f' } },
      { id: 'water', type: 'fill', source: 'omt', 'source-layer': 'water', paint: { 'fill-color': '#0d3a63' } },
      { id: 'satellite', type: 'raster', source: 'satellite', paint: { 'raster-fade-duration': 200 } },
      {
        id: 'boundaries', type: 'line', source: 'omt', 'source-layer': 'boundary',
        filter: ['all', ['==', ['get', 'admin_level'], 2], ['!=', ['get', 'maritime'], 1]],
        maxzoom: 9,
        paint: { 'line-color': 'rgba(255,255,255,0.45)', 'line-width': ['interpolate', ['linear'], ['zoom'], 1, 0.4, 6, 1.2] }
      },
      {
        id: 'roads', type: 'line', source: 'omt', 'source-layer': 'transportation', minzoom: 12,
        filter: ['in', ['get', 'class'], ['literal', ['motorway', 'trunk', 'primary', 'secondary']]],
        paint: { 'line-color': 'rgba(255,255,255,0.25)', 'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.5, 17, 3] }
      },
      {
        id: 'track-glow', type: 'line', source: 'tracks', minzoom: 5,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#e10600', 'line-blur': 4, 'line-opacity': glowOpacity(true),
          'line-width': ['interpolate', ['exponential', 2], ['zoom'], 6, 4, 12, 10, 17, 30]
        }
      },
      {
        id: 'track-casing', type: 'line', source: 'tracks', minzoom: 5,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ffffff',
          'line-opacity': lineOpacity(1, true),
          'line-width': ['interpolate', ['exponential', 2], ['zoom'], 6, 2.5, 12, 6, 15, 16, 18, 90]
        }
      },
      {
        id: 'track-line', type: 'line', source: 'tracks', minzoom: 5,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['case', ['boolean', ['feature-state', 'selected'], false], '#ff2a1f', '#e10600'],
          'line-opacity': lineOpacity(1, true),
          'line-width': ['interpolate', ['exponential', 2], ['zoom'], 6, 1.5, 12, 3.5, 15, 11, 18, 70]
        }
      },
      {
        id: 'buildings', type: 'fill-extrusion', source: 'omt', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 0], 0, '#d9d4cb', 40, '#eae6df', 150, '#f6f3ee'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 13, 0, 14, ['coalesce', ['get', 'render_height'], 6]],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], 0],
          'fill-extrusion-opacity': 0.92,
          'fill-extrusion-vertical-gradient': true
        }
      },
      {
        id: 'start-finish', type: 'circle', source: 'starts', minzoom: 11,
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 11, 4, 17, 10],
          'circle-color': '#ffffff', 'circle-stroke-color': '#111', 'circle-stroke-width': 3,
          'circle-pitch-alignment': 'map'
        }
      },
      {
        id: 'start-finish-label', type: 'symbol', source: 'starts', minzoom: 13,
        layout: {
          'text-field': 'START / FINISH', 'text-font': ['Noto Sans Bold'], 'text-size': 11,
          'text-offset': [0, -1.6], 'text-letter-spacing': 0.08, 'text-allow-overlap': true
        },
        paint: { 'text-color': '#fff', 'text-halo-color': '#111', 'text-halo-width': 1.6 }
      },
      {
        id: 'poi', type: 'symbol', source: 'omt', 'source-layer': 'poi', minzoom: 14,
        filter: ['<=', ['coalesce', ['get', 'rank'], 99], ['step', ['zoom'], 6, 15, 14, 16, 30]],
        layout: {
          'text-field': nameField, 'text-font': ['Noto Sans Regular'],
          'text-size': ['match', ['get', 'class'], LANDMARK_CLASSES, 13, 11],
          'text-max-width': 9, 'text-variable-anchor': ['top', 'bottom', 'left', 'right'], 'text-radial-offset': 0.5,
          'text-padding': 4
        },
        paint: {
          'text-color': ['match', ['get', 'class'], LANDMARK_CLASSES, '#ffd23f', '#ffffff'],
          'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.4
        }
      },
      {
        id: 'water-names', type: 'symbol', source: 'omt', 'source-layer': 'water_name', minzoom: 3,
        layout: { 'text-field': nameField, 'text-font': ['Noto Sans Italic'], 'text-size': 12, 'text-max-width': 8 },
        paint: { 'text-color': '#bfe1ff', 'text-halo-color': 'rgba(0,20,40,0.8)', 'text-halo-width': 1.2 }
      },
      {
        id: 'places', type: 'symbol', source: 'omt', 'source-layer': 'place',
        filter: ['in', ['get', 'class'], ['literal', ['country', 'city', 'town', 'suburb']]],
        layout: {
          'text-field': nameField,
          'text-font': ['match', ['get', 'class'], 'country', ['literal', ['Noto Sans Bold']], ['literal', ['Noto Sans Regular']]],
          'text-size': ['interpolate', ['linear'], ['zoom'],
            1, ['match', ['get', 'class'], 'country', 10, 'city', 11, 10],
            5, ['match', ['get', 'class'], 'country', 15, 'city', 13, 11]],
          'text-transform': ['match', ['get', 'class'], 'country', 'uppercase', 'none'],
          'text-letter-spacing': ['match', ['get', 'class'], 'country', 0.12, 0],
          'text-max-width': 8,
          'symbol-sort-key': ['coalesce', ['get', 'rank'], 99]
        },
        minzoom: 1.5,
        paint: {
          'text-color': ['match', ['get', 'class'], 'country', 'rgba(255,255,255,0.9)', '#f0f0f0'],
          'text-halo-color': 'rgba(0,0,0,0.8)', 'text-halo-width': 1.3,
          'text-opacity': ['interpolate', ['linear'], ['zoom'],
            7, ['match', ['get', 'class'], 'country', 0.85, 1],
            8, ['match', ['get', 'class'], 'country', 0, 1]]
        }
      },
      {
        id: 'track-name', type: 'symbol', source: 'tracks', minzoom: 9, maxzoom: 14.5,
        layout: {
          'symbol-placement': 'line', 'symbol-spacing': 600,
          'text-field': ['get', 'name'], 'text-font': ['Noto Sans Bold'], 'text-size': 13,
          'text-letter-spacing': 0.05, 'text-offset': [0, -1.2]
        },
        paint: { 'text-color': '#fff', 'text-halo-color': '#b00400', 'text-halo-width': 2 }
      },
      {
        id: 'car', type: 'circle', source: 'car',
        paint: {
          'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 5, 17, 11],
          'circle-color': '#ffd23f', 'circle-stroke-color': '#e10600', 'circle-stroke-width': 3,
          'circle-pitch-alignment': 'map'
        }
      }
    ]
  };
}

const map = new maplibregl.Map({
  container: 'map',
  style: buildStyle(),
  center: [10, 30],
  zoom: isTouch ? 0.9 : 1.6,
  maxPitch: 80,
  hash: false,
  attributionControl: { compact: true },
  canvasContextAttributes: { antialias: true }
});
map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showZoom: !isTouch }), 'bottom-right');
map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
map.touchPitch.enable();
window.__map = map; // handy for debugging in the console

// ---------------- Track data ----------------

const tracks = {}; // id -> { coords, path, samples, elev, bounds, center }
let tracksLoaded;
const tracksReady = new Promise((resolve) => { tracksLoaded = resolve; });
const trackLayer = createTrackLayer();

async function loadTracks() {
  const res = await fetch('data/tracks.geojson');
  const fc = await res.json();
  const starts = [];
  const lines = [];
  for (const f of fc.features) {
    const c = byId[f.properties.id];
    if (!c) continue;
    const coords = f.geometry.coordinates;
    const path = buildPath(coords);
    tracks[c.id] = { coords, path, samples: path.samples, elev: null, bounds: bbox(coords), center: centroid(coords) };
    c.center = tracks[c.id].center;
    lines.push({ type: 'Feature', id: CIRCUITS.indexOf(c), properties: { id: c.id, name: c.name }, geometry: f.geometry });
    starts.push({ type: 'Feature', properties: { id: c.id }, geometry: { type: 'Point', coordinates: coords[0] } });
  }
  tracksLoaded();
  return { lines, starts };
}

// The map's terrain tiles go through this handler, which cuts a smooth road bed for
// each circuit into the elevation data. The terrain data is too coarse to contain the
// real road, so without this the ground would be bumpy under the track and beside it.
const CARVE_MIN_ZOOM = 13;
maplibregl.addProtocol('f1dem', async (params) => {
  const [z, x, y] = params.url.slice('f1dem://'.length).split('/').map(Number);
  const tile = await loadTile(z, x, y, false);
  let data = tile.data;
  if (z >= CARVE_MIN_ZOOM) {
    await tracksReady;
    const [[w, s], [e, n]] = tileBounds(z, x, y);
    const pad = 0.002; // roughly 200 m
    for (const [id, t] of Object.entries(tracks)) {
      const [[tw, ts], [te, tn]] = t.bounds;
      if (tw > e + pad || te < w - pad || ts > n + pad || tn < s - pad) continue;
      await ensureElevation(id);
      if (!t.elev) continue;
      if (data === tile.data) data = new Uint8ClampedArray(tile.data);
      carveRoad(data, tile.size, z, x, y, t.samples.map((sm) => sm.p), t.elev, TRACK_WIDTH / 2);
    }
  }
  return { data: await createImageBitmap(new ImageData(data, tile.size, tile.size)) };
});

// Samples the terrain under the track, then builds its 3D model. Always resolves:
// if the terrain tiles cannot be loaded the model is built flat.
function ensureElevation(id) {
  const t = tracks[id];
  if (!t) return Promise.resolve();
  if (!t.elevPromise) {
    const finish = (raw) => {
      const elev = setElevation(t.path, raw);
      if (raw) {
        let min = Infinity, max = -Infinity, gain = 0;
        for (let i = 0; i < elev.length; i++) {
          min = Math.min(min, elev[i]); max = Math.max(max, elev[i]);
          if (i && elev[i] > elev[i - 1]) gain += elev[i] - elev[i - 1];
        }
        t.stats = { min, max, gain };
        t.elev = elev;
      }
      trackLayer.setMesh(id, buildMesh(t.path), t.center);
      if (selected && selected.id === id) renderElevation(selected);
    };
    t.elevPromise = sampleElevations(elevationPoints(t.path), 15).then(finish, (err) => {
      console.warn('Elevation unavailable', err);
      t.elevFailed = true;
      finish(null);
    });
  }
  return t.elevPromise;
}

// ---------------- Markers ----------------

const markers = [];

function statusLabel(c) {
  return { completed: 'Completed', next: 'Next race', upcoming: 'Upcoming', cancelled: 'Cancelled' }[c.status];
}

function formatDate(iso, opts = { day: 'numeric', month: 'short' }) {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}

function createMarkers() {
  for (const c of CIRCUITS) {
    const el = document.createElement('div');
    el.className = `cm status-${c.status}`;
    el.innerHTML = `
      <button class="cm-pin" aria-label="${c.gp}: ${c.name}">
        <span class="cm-photo">${trackSvg(tracks[c.id].coords, { stroke: '#fff', width: 2 })}</span>
        ${c.round ? `<span class="cm-round">${c.round}</span>` : '<span class="cm-round x">✕</span>'}
      </button>
      <div class="cm-label"><span class="cm-flag">${c.flag}</span><span class="cm-name">${c.short}</span></div>`;
    el.addEventListener('click', (e) => { e.stopPropagation(); selectCircuit(c, { fly: false }); });
    const m = new maplibregl.Marker({ element: el, anchor: 'center', subpixelPositioning: true, opacityWhenCovered: '0' })
      .setLngLat(c.center)
      .addTo(map);
    markers.push({ c, el, m, label: el.querySelector('.cm-label') });

    getPhoto(c.wiki).then((ph) => {
      if (!ph) return;
      const img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.onload = () => {
        const holder = el.querySelector('.cm-photo');
        holder.innerHTML = '';
        holder.appendChild(img);
        holder.classList.add('has-img');
      };
      img.src = ph.thumb;
    });
  }
}

// Hide markers on the far side of the globe / when zoomed onto a track, and declutter labels.
let markersDetached = false;
const PRIORITY = { next: 0, upcoming: 1, completed: 2, cancelled: 3 };
function updateMarkers() {
  const zoom = map.getZoom();
  const closeUp = zoom > 11.5;
  const placed = [];
  const order = [...markers].sort((a, b) => {
    if (selected) { if (a.c === selected) return -1; if (b.c === selected) return 1; }
    return PRIORITY[a.c.status] - PRIORITY[b.c.status];
  });
  const W = map.getContainer().clientWidth, H = map.getContainer().clientHeight;
  // When zoomed onto a track, detach the markers entirely: besides being invisible,
  // MapLibre would keep projecting far-away markers against terrain every frame.
  if (closeUp !== markersDetached) {
    markersDetached = closeUp;
    for (const mk of markers) closeUp ? mk.m.remove() : mk.m.addTo(map);
  }
  if (closeUp) return;
  for (const mk of order) {
    const { el, m, c } = mk;
    let hidden = false;
    let p;
    try { p = map.project(c.center); } catch { p = { x: -1e4, y: -1e4 }; }
    if (p.x < -60 || p.y < -60 || p.x > W + 60 || p.y > H + 60) hidden = true;
    el.classList.toggle('cm-hidden', hidden);
    el.classList.toggle('cm-selected', selected === c);
    if (hidden) continue;
    // label collision (approximate rects; labels sit below the pin)
    const lw = Math.min(170, 30 + c.short.length * 7), lh = 20;
    const rect = { x: p.x - lw / 2, y: p.y + 20, w: lw, h: lh };
    const pin = { x: p.x - 18, y: p.y - 18, w: 36, h: 36 };
    const covered = m._element.style.opacity === '0';
    const overlap = placed.some((r) => !(rect.x > r.x + r.w || rect.x + rect.w < r.x || rect.y > r.y + r.h || rect.y + rect.h < r.y));
    const showLabel = !covered && !overlap && (zoom > 2.2 || PRIORITY[c.status] <= 1 || selected === c);
    mk.label.classList.toggle('hide', !showLabel);
    if (!covered) placed.push(pin);
    if (showLabel) placed.push(rect);
  }
}
let markerRaf = 0;
function scheduleMarkers() {
  if (markerRaf) return;
  markerRaf = requestAnimationFrame(() => { markerRaf = 0; updateMarkers(); });
}

// ---------------- Selection & info panel ----------------

let selected = null;

function selectCircuit(c, { fly = false } = {}) {
  if (selected) map.setFeatureState({ source: 'tracks', id: CIRCUITS.indexOf(selected) }, { selected: false });
  selected = c;
  map.setFeatureState({ source: 'tracks', id: CIRCUITS.indexOf(c) }, { selected: true });
  renderPanel(c);
  closeDrawer();
  ensureElevation(c.id);
  scheduleMarkers();
  if (fly) flyToCircuit(c);
  else if (map.getZoom() < 9) {
    // keep the globe view, but bring the circuit to the centre
    map.easeTo({ center: c.center, duration: 900, padding: panelPadding() });
  }
}

function panelPadding() {
  const panel = $('#panel');
  if (panel.hidden) return { top: 0, bottom: 0, left: 0, right: 0 };
  if (window.innerWidth >= 760) return { top: 0, bottom: 0, left: 0, right: panel.offsetWidth + 16 };
  const h = panel.classList.contains('collapsed') ? 132 : panel.offsetHeight;
  return { top: 0, bottom: Math.min(h, window.innerHeight * 0.45), left: 0, right: 0 };
}

// On phones the bottom sheet covers half the screen; tuck it away while the camera moves.
function collapseOnMobile() {
  if (window.innerWidth < 760) $('#panel').classList.add('collapsed');
}

function flyToCircuit(c, { pitch = 62 } = {}) {
  stopAll();
  collapseOnMobile();
  const t = tracks[c.id];
  const bearing = (c.bearing ?? -20);
  const cam = map.cameraForBounds(t.bounds, { padding: 40, bearing });
  const zoom = Math.min(16, (cam?.zoom ?? 14) - 0.2);
  map.flyTo({
    center: t.center, zoom, pitch, bearing,
    padding: panelPadding(),
    duration: 4500, curve: 1.6, essential: true
  });
}

function goHome() {
  stopAll();
  map.flyTo({ center: selected ? selected.center : [10, 30], zoom: isTouch ? 0.9 : 1.6, pitch: 0, bearing: 0, padding: { top: 0, left: 0, right: 0, bottom: 0 }, duration: 3500, essential: true });
}

function renderPanel(c) {
  const panel = $('#panel');
  const t = tracks[c.id];
  const rec = c.record
    ? `<strong>${c.record.time}</strong><span>${c.record.driver} (${c.record.year})</span>`
    : `<strong>—</strong><span>New circuit for ${SEASON}</span>`;
  $('#panel-body').innerHTML = `
    <div class="hero">
      <div class="hero-img">${trackSvg(t.coords, { stroke: '#e10600', width: 3 })}</div>
      <div class="hero-shade"></div>
      <div class="hero-text">
        <div class="pill status-${c.status}">${c.round ? `Round ${c.round} · ` : ''}${statusLabel(c)}${c.sprint && !c.cancelled ? ' · Sprint' : ''}</div>
        <h2>${c.flag} ${c.gp}</h2>
        <p>${c.name}</p>
      </div>
    </div>
    <div class="panel-content">
      <p class="meta">${c.city}, ${c.country} · ${formatDate(c.date, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      <div class="actions">
        <button class="btn primary" id="act-fly">Fly to circuit</button>
        <button class="btn" id="act-lap">▶ Fly a lap</button>
        <button class="btn" id="act-orbit">⟳ Orbit</button>
      </div>
      <div class="stats">
        <div class="stat"><span class="k">Circuit length</span><strong>${c.lengthKm.toFixed(3)} km</strong></div>
        <div class="stat"><span class="k">Laps</span><strong>${c.laps}</strong></div>
        <div class="stat"><span class="k">Race distance</span><strong>${c.distanceKm.toFixed(3)} km</strong></div>
        <div class="stat"><span class="k">Corners</span><strong>${c.turns}</strong></div>
        <div class="stat wide"><span class="k">Lap record</span>${rec}</div>
        <div class="stat"><span class="k">First Grand Prix</span><strong>${c.firstGp}</strong></div>
        <div class="stat"><span class="k">Type</span><strong class="small">${c.type}</strong></div>
      </div>
      <p class="blurb">${c.blurb}</p>
      <section class="elev">
        <h3>Track elevation</h3>
        <div id="elev-body" class="elev-body"><div class="loading">Sampling terrain along the lap…</div></div>
      </section>
      <p class="source">Photo &amp; more: <a href="https://en.wikipedia.org/wiki/${encodeURIComponent(c.wiki)}" target="_blank" rel="noopener">Wikipedia</a><span id="photo-credit"></span></p>
    </div>`;
  panel.hidden = false;
  panel.classList.remove('collapsed');
  panel.scrollTop = 0;

  $('#act-fly').onclick = () => flyToCircuit(c);
  $('#act-lap').onclick = () => toggleLap(c);
  $('#act-orbit').onclick = () => toggleOrbit(c);
  syncButtons();

  getPhoto(c.wiki).then((ph) => {
    if (!ph || selected !== c) return;
    const img = new Image();
    img.alt = `${c.name}`;
    img.onload = () => {
      const h = panel.querySelector('.hero-img');
      if (!h || selected !== c) return;
      h.innerHTML = '';
      h.appendChild(img);
      h.classList.add('has-img');
      const credit = $('#photo-credit');
      if (credit && ph.credit) credit.textContent = ` · ${ph.credit.replace(/_/g, ' ')}`;
    };
    img.src = ph.large;
  });
  renderElevation(c);
}

function renderElevation(c) {
  const body = $('#elev-body');
  if (!body) return;
  const t = tracks[c.id];
  if (!t.elev) {
    body.innerHTML = t.elevFailed
      ? '<div class="loading">Elevation data could not be loaded.</div>'
      : '<div class="loading">Sampling terrain along the lap…</div>';
    return;
  }
  const { min, max, gain } = t.stats;
  const total = t.samples[t.samples.length - 1].d;
  const W = 320, H = 110, padB = 16, padL = 34;
  const span = Math.max(8, max - min);
  const lo = min - span * 0.12, hi = max + span * 0.12;
  const x = (d) => padL + (d / total) * (W - padL - 4);
  const y = (e) => 4 + (1 - (e - lo) / (hi - lo)) * (H - padB - 8);
  const step = Math.max(1, Math.floor(t.samples.length / 300));
  let line = '';
  for (let i = 0; i < t.samples.length; i += step) line += `${i ? 'L' : 'M'}${x(t.samples[i].d).toFixed(1)},${y(t.elev[i]).toFixed(1)}`;
  const area = `${line}L${x(total).toFixed(1)},${H - padB}L${padL},${H - padB}Z`;
  const kmTicks = [];
  for (let k = 0; k <= total / 1000; k++) kmTicks.push(k);
  const tickEvery = total > 6000 ? 2 : 1;
  body.innerHTML = `
    <div class="elev-stats">
      <div><span class="k">Lowest</span><strong>${Math.round(min)} m</strong></div>
      <div><span class="k">Highest</span><strong>${Math.round(max)} m</strong></div>
      <div><span class="k">Height difference</span><strong>${Math.round(max - min)} m</strong></div>
      <div><span class="k">Climb per lap</span><strong>${Math.round(gain)} m</strong></div>
    </div>
    <svg class="elev-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Elevation profile">
      <defs>
        <linearGradient id="eg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="#ff3b2f" stop-opacity="0.55"/><stop offset="1" stop-color="#2b6cff" stop-opacity="0.08"/>
        </linearGradient>
      </defs>
      <text x="${padL - 4}" y="${y(max) + 4}" text-anchor="end">${Math.round(max)}</text>
      <text x="${padL - 4}" y="${y(min) + 4}" text-anchor="end">${Math.round(min)}</text>
      <line x1="${padL}" x2="${W - 4}" y1="${y(max)}" y2="${y(max)}" class="grid"/>
      <line x1="${padL}" x2="${W - 4}" y1="${y(min)}" y2="${y(min)}" class="grid"/>
      <path d="${area}" fill="url(#eg)"/>
      <path d="${line}" fill="none" stroke="#ff5a4f" stroke-width="1.8" vector-effect="non-scaling-stroke"/>
      ${kmTicks.filter((k) => k % tickEvery === 0).map((k) => `<text x="${x(k * 1000)}" y="${H - 3}" text-anchor="middle">${k}${k === 0 ? ' km' : ''}</text>`).join('')}
      <line id="elev-cursor" x1="0" x2="0" y1="4" y2="${H - padB}" class="cursor" visibility="hidden"/>
    </svg>
    <p class="hint">${isTouch ? 'Touch' : 'Hover'} the profile to locate that point on the track. Turn on “Colour track by elevation” in Layers to tint the 3D track from <span style="color:#2b6cff">low</span> to <span style="color:#ff3b2f">high</span>.</p>`;

  const svg = body.querySelector('svg');
  const cursor = svg.querySelector('#elev-cursor');
  const onMove = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const frac = Math.min(1, Math.max(0, (px - padL) / (W - padL - 4)));
    cursor.setAttribute('x1', px); cursor.setAttribute('x2', px); cursor.setAttribute('visibility', 'visible');
    if (!lap) setCar(pointAt(t.samples, frac).p);
  };
  svg.addEventListener('pointermove', onMove);
  svg.addEventListener('pointerdown', onMove);
  svg.addEventListener('pointerleave', () => { cursor.setAttribute('visibility', 'hidden'); if (!lap) setCar(null); });
}

function setElevCursor(frac) {
  const svg = document.querySelector('.elev-chart');
  if (!svg) return;
  const cursor = svg.querySelector('#elev-cursor');
  const W = 320, padL = 34;
  const px = padL + frac * (W - padL - 4);
  cursor.setAttribute('x1', px); cursor.setAttribute('x2', px); cursor.setAttribute('visibility', 'visible');
}

function setCar(p) {
  const src = map.getSource('car');
  if (!src) return;
  src.setData({ type: 'FeatureCollection', features: p ? [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }] : [] });
}

// ---------------- Lap fly-through & orbit ----------------

let lap = null;
let orbit = null;

function lapSeconds(c) {
  if (!c.record) return 90;
  const [m, s] = c.record.time.split(':');
  return +m * 60 + +s;
}

// "Fly a lap" is driven from the cockpit: the camera sits at the driver's eye height
// on the 3D track and follows a speed profile that brakes for corners and accelerates
// out of them.
const EYE_HEIGHT = 1.05; // metres above the road
const LOOK_DISTANCE = 30; // metres from the camera to the map's centre point
const RAD = Math.PI / 180;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const angleDiff = (a, b) => ((a - b + 540) % 360) - 180;
const NO_PADDING = { top: 0, bottom: 0, left: 0, right: 0 };
const ck = {
  root: $('#cockpit'), wheel: $('#ck-wheel'), speed: $('#ck-speed'), gear: $('#ck-gear'),
  throttle: $('#ck-throttle'), brake: $('#ck-brake'), time: $('#lap-time'), fade: $('#lap-fade')
};

function formatLapTime(sec) {
  const m = Math.floor(sec / 60), s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

function toggleLap(c) {
  if (lap) { stopLap(); return; }
  stopOrbit();
  stopSpin();
  const t = tracks[c.id];
  const me = lap = { c, raf: 0, cockpit: false };
  syncButtons();
  collapseOnMobile();
  const start = pathAt(t.path, 0);
  // Fly in behind the start line, then drop into the cockpit.
  map.flyTo({ center: start.p, zoom: 17.4, pitch: 74, bearing: start.heading, duration: 2600, essential: true, padding: NO_PADDING });
  const arrived = new Promise((resolve) => map.once('moveend', resolve));
  Promise.all([ensureElevation(c.id), arrived]).then(() => {
    if (lap !== me) return;
    ck.fade.classList.add('on');
    setTimeout(() => { if (lap === me) driveLap(me, t); }, 260);
  });
}

function driveLap(me, t) {
  const path = t.path;
  const drive = buildDrive(path, lapSeconds(me.c));
  me.cockpit = true;
  me.fov = map.getVerticalFieldOfView();
  me.maxPitch = map.getMaxPitch();
  document.body.classList.add('lap-mode');
  ck.root.hidden = false;
  const aspect = map.transform.width / map.transform.height;
  const fov = clamp((2 * Math.atan(Math.tan(43 * RAD) / aspect)) / RAD, 46, 72);
  map.setMaxPitch(120);
  map.setCenterClampedToGround(false);
  map.setVerticalFieldOfView(fov);
  // Drive at true scale: the exaggerated terrain used elsewhere makes every rise a ramp.
  me.terrain = map.getTerrain();
  if (me.terrain) map.setTerrain({ ...me.terrain, exaggeration: 1 });
  requestAnimationFrame(() => ck.fade.classList.remove('on'));

  let last = null;
  let pitchNow = null, rollNow = 0;
  let elapsed = -1.2; // sit on the grid for a moment before the launch
  const tick = (now) => {
    if (lap !== me) return;
    const dt = last === null ? 0 : Math.min(0.1, (now - last) / 1000);
    elapsed += dt;
    last = now;
    const st = drive.at(elapsed);
    if (st.done) { stopLap({ overview: true }); return; }

    const terrain = map.getTerrain();
    const exag = terrain ? terrain.exaggeration ?? 1 : 0;
    const cur = pathAt(path, st.s);
    // Look towards where the road is going, further ahead at speed, so the view
    // turns into a corner before the car does.
    const ahead = pathAt(path, st.s + clamp(6 + st.v * 0.55, 6, 45));
    const toAhead = Math.atan2(ahead.x - cur.x, ahead.y - cur.y) / RAD;
    const bearing = cur.heading + angleDiff(toAhead, cur.heading) * 0.7;
    const slopeAt = pathAt(path, st.s + 60);
    const slope = Math.atan2((slopeAt.elev - cur.elev) * exag, 60) / RAD;
    // Nose dips under braking and lifts under power; lean gently into corners.
    // Both are eased over time so the horizon never snaps.
    const pitchTarget = 86.5 + slope * 0.5 + clamp(st.a, -45, 12) * 0.035;
    const lateralG = (cur.kappa * st.v * st.v) / 9.81;
    const ease = 1 - Math.exp(-dt / 0.35);
    pitchNow = pitchNow === null ? pitchTarget : pitchNow + (pitchTarget - pitchNow) * ease;
    rollNow += (-clamp(lateralG, -5, 5) * 0.7 - rollNow) * ease;
    const pitch = pitchNow, roll = rollNow;
    const altitude = cur.elev * exag + ROAD_LIFT + EYE_HEIGHT;

    // MapLibre's camera is defined by the point it looks at, so place that point
    // a fixed distance ahead along the line of sight.
    const reach = LOOK_DISTANCE * Math.sin(pitch * RAD);
    const lat = cur.p[1] + (reach * Math.cos(bearing * RAD)) / 111194.9;
    const lng = cur.p[0] + (reach * Math.sin(bearing * RAD)) / (111194.9 * Math.cos(cur.p[1] * RAD));
    const tr = map.transform;
    const cameraToCentrePx = (0.5 * tr.height) / Math.tan((fov * RAD) / 2);
    const metrePx = 512 / (2 * Math.PI * 6371008.8 * Math.cos(lat * RAD)); // pixels per metre at zoom 0
    const zoom = Math.log2(cameraToCentrePx / (LOOK_DISTANCE * metrePx));
    map.jumpTo({
      center: [lng, lat], elevation: altitude - LOOK_DISTANCE * Math.cos(pitch * RAD),
      zoom, pitch, bearing, roll, padding: NO_PADDING
    });
    me.pos = cur.p;
    me.bearing = cur.heading;

    const kmh = st.v * 3.6;
    ck.speed.textContent = Math.round(kmh);
    ck.gear.textContent = elapsed < 0 ? 'N' : clamp(1 + Math.floor(kmh / 42), 1, 8);
    ck.wheel.setAttribute('transform', `rotate(${clamp((Math.atan(3.6 * cur.kappa) / RAD) * 11, -150, 150).toFixed(1)} 500 520)`);
    ck.throttle.style.transform = `scaleY(${clamp(st.a / 9, 0, 1).toFixed(2)})`;
    ck.brake.style.transform = `scaleY(${clamp(-st.a / 35, 0, 1).toFixed(2)})`;
    ck.time.textContent = formatLapTime(Math.max(0, elapsed));
    setElevCursor(st.s / path.total);
    me.raf = requestAnimationFrame(tick);
  };
  me.raf = requestAnimationFrame(tick);
}

function stopLap({ overview = false } = {}) {
  if (!lap) return;
  const me = lap;
  cancelAnimationFrame(me.raf);
  lap = null;
  ck.fade.classList.remove('on');
  if (me.cockpit) {
    // back to a normal map camera, just behind where the car was
    document.body.classList.remove('lap-mode');
    ck.root.hidden = true;
    map.setCenterClampedToGround(true);
    map.setVerticalFieldOfView(me.fov);
    if (me.terrain && map.getTerrain()) map.setTerrain({ ...me.terrain, exaggeration: exag() });
    if (me.pos) map.jumpTo({ center: me.pos, zoom: 17.2, pitch: 72, bearing: me.bearing, roll: 0 });
    map.setMaxPitch(me.maxPitch);
  }
  syncButtons();
  if (overview) flyToCircuit(me.c);
}

function toggleOrbit(c) {
  if (orbit) { stopOrbit(); return; }
  stopLap();
  collapseOnMobile();
  const t = tracks[c.id];
  const begin = () => {
    let last = performance.now();
    const tick = (now) => {
      if (!orbit) return;
      const dt = now - last; last = now;
      map.setBearing(map.getBearing() + dt * 0.006);
      orbit.raf = requestAnimationFrame(tick);
    };
    orbit.raf = requestAnimationFrame(tick);
  };
  orbit = { raf: 0 };
  const dist = map.getZoom() < 12 || maplibregl.LngLat.convert(map.getCenter()).distanceTo(maplibregl.LngLat.convert(t.center)) > 4000;
  if (dist) {
    const cam = map.cameraForBounds(t.bounds, { padding: 40 });
    map.flyTo({ center: t.center, zoom: Math.min(16, (cam?.zoom ?? 14) - 0.2), pitch: 60, duration: 3000, essential: true, padding: panelPadding() });
    map.once('moveend', () => orbit && begin());
  } else {
    map.easeTo({ center: t.center, pitch: Math.max(55, map.getPitch()), duration: 800 });
    map.once('moveend', () => orbit && begin());
  }
  syncButtons();
}

function stopOrbit() {
  if (!orbit) return;
  cancelAnimationFrame(orbit.raf);
  orbit = null;
  syncButtons();
}

function stopAll() { stopLap(); stopOrbit(); stopSpin(); }

function syncButtons() {
  const l = $('#act-lap'), o = $('#act-orbit');
  if (l) { l.textContent = lap ? '■ Stop lap' : '▶ Fly a lap'; l.classList.toggle('on', !!lap); }
  if (o) { o.textContent = orbit ? '■ Stop orbit' : '⟳ Orbit'; o.classList.toggle('on', !!orbit); }
}

// Any direct user interaction cancels camera animations.
for (const ev of ['mousedown', 'touchstart', 'wheel']) {
  map.getCanvasContainer().addEventListener(ev, () => { stopAll(); }, { passive: true });
}

// ---------------- Intro globe spin ----------------

let spin = { raf: 0, on: true };
function startSpin() {
  let last = performance.now();
  const tick = (now) => {
    if (!spin.on) return;
    const dt = Math.min(64, now - last); last = now;
    if (map.getZoom() < 3 && !map.isMoving()) {
      const c = map.getCenter();
      map.jumpTo({ center: [c.lng + dt * 0.004, c.lat] });
    }
    spin.raf = requestAnimationFrame(tick);
  };
  spin.raf = requestAnimationFrame(tick);
}
function stopSpin() { spin.on = false; cancelAnimationFrame(spin.raf); }

// ---------------- Calendar drawer ----------------

function renderCalendar(filter = '') {
  const q = filter.trim().toLowerCase();
  const list = $('#race-list');
  list.innerHTML = '';
  for (const c of CIRCUITS) {
    const hay = `${c.gp} ${c.name} ${c.city} ${c.country} ${c.short}`.toLowerCase();
    if (q && !hay.includes(q)) continue;
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="race status-${c.status}">
        <span class="race-round">${c.round ?? '—'}</span>
        <span class="race-flag">${c.flag}</span>
        <span class="race-main"><strong>${c.gp.replace(' Grand Prix', '')}</strong><small>${c.name}</small></span>
        <span class="race-date">${formatDate(c.date)}<small>${statusLabel(c)}</small></span>
      </button>`;
    li.querySelector('button').onclick = () => selectCircuit(c, { fly: true });
    list.appendChild(li);
  }
}

function openDrawer() {
  $('#calendar').hidden = false;
  $('#btn-calendar').classList.add('on');
  if (!isTouch) $('#search').focus();
}
function closeDrawer() { $('#calendar').hidden = true; $('#btn-calendar').classList.remove('on'); }

// ---------------- UI wiring ----------------

$('#btn-calendar').onclick = () => ($('#calendar').hidden ? openDrawer() : closeDrawer());
$('#btn-home').onclick = goHome;
$('#btn-layers').onclick = () => {
  const p = $('#layers');
  p.hidden = !p.hidden;
  $('#btn-layers').setAttribute('aria-expanded', String(!p.hidden));
  $('#btn-layers').classList.toggle('on', !p.hidden);
};
$('#search').addEventListener('input', (e) => renderCalendar(e.target.value));
document.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => {
  const id = b.dataset.close;
  if (id === 'panel') {
    $('#panel').hidden = true;
    stopLap(); stopOrbit();
    if (selected) map.setFeatureState({ source: 'tracks', id: CIRCUITS.indexOf(selected) }, { selected: false });
    selected = null;
    scheduleMarkers();
  } else closeDrawer();
}));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (lap) stopLap({ overview: true });
    else if (!$('#calendar').hidden) closeDrawer();
    else if (!$('#panel').hidden) document.querySelector('[data-close="panel"]').click();
  }
});

// Mobile bottom sheet: tap the handle to collapse/expand
document.querySelector('.sheet-handle').addEventListener('click', () => $('#panel').classList.toggle('collapsed'));

function setVis(layer, on) { if (map.getLayer(layer)) map.setLayoutProperty(layer, 'visibility', on ? 'visible' : 'none'); }
$('#opt-buildings').onchange = (e) => setVis('buildings', e.target.checked);
$('#opt-ribbon').onchange = (e) => {
  trackLayer.visible = e.target.checked;
  map.setPaintProperty('track-glow', 'line-opacity', glowOpacity(e.target.checked));
  for (const l of ['track-casing', 'track-line']) map.setPaintProperty(l, 'line-opacity', lineOpacity(1, e.target.checked));
  map.triggerRepaint();
};
$('#opt-labels').onchange = (e) => ['poi', 'places', 'water-names', 'track-name', 'start-finish-label'].forEach((l) => setVis(l, e.target.checked));
$('#opt-elevcolor').onchange = (e) => { trackLayer.tint = e.target.checked; map.triggerRepaint(); };
$('#lap-exit').onclick = () => stopLap({ overview: true });
const exag = () => +$('#opt-exag').value;
$('#opt-exag').oninput = () => {
  $('#opt-exag-out').textContent = exag().toFixed(1) + '×';
  if ($('#opt-terrain').checked) map.setTerrain({ source: 'dem', exaggeration: exag() });
};
$('#opt-terrain').onchange = (e) => map.setTerrain(e.target.checked ? { source: 'dem', exaggeration: exag() } : null);

// Zoom hint near circuits
function updateHint() {
  const hint = $('#zoom-hint');
  const z = map.getZoom();
  let msg = '';
  if (z >= 6 && z < 12) {
    const center = map.getCenter();
    const near = CIRCUITS.find((c) => center.distanceTo(maplibregl.LngLat.convert(c.center)) < 60000);
    if (near) msg = `Zoom in to see ${near.short} in 3D`;
  } else if (z >= 12 && z < 14.5 && map.getPitch() < 30) {
    msg = isTouch ? 'Tip: drag with two fingers to tilt the view' : 'Tip: right-drag or Ctrl+drag to tilt the view';
  }
  hint.textContent = msg;
  hint.hidden = !msg;
}

// Load elevation for whichever circuit we are zoomed into
function autoElevation() {
  if (map.getZoom() < 10.5) return;
  const center = map.getCenter();
  for (const c of CIRCUITS) {
    if (center.distanceTo(maplibregl.LngLat.convert(c.center)) < 15000) ensureElevation(c.id);
  }
}

// ---------------- Boot ----------------

map.on('load', async () => {
  const { lines, starts } = await loadTracks();
  map.getSource('tracks').setData({ type: 'FeatureCollection', features: lines });
  map.getSource('starts').setData({ type: 'FeatureCollection', features: starts });
  map.addLayer(trackLayer, 'start-finish');
  createMarkers();
  renderCalendar();
  updateMarkers();
  startSpin();

  const clickTrack = (e) => {
    const f = e.features && e.features[0];
    const c = f && byId[f.properties.id];
    if (c && c !== selected) selectCircuit(c);
  };
  for (const l of ['track-line']) {
    map.on('click', l, clickTrack);
    map.on('mouseenter', l, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', l, () => { map.getCanvas().style.cursor = ''; });
  }

  // deep link: #circuit=mc-1929
  const m = location.hash.match(/circuit=([\w-]+)/);
  if (m && byId[m[1]]) { stopSpin(); selectCircuit(byId[m[1]], { fly: true }); }

  setTimeout(() => $('#help').classList.add('fade'), 9000);
});

map.on('move', scheduleMarkers);
map.on('moveend', () => { updateHint(); autoElevation(); });
map.on('resize', scheduleMarkers);
map.on('error', (e) => {
  // Tile failures (offline, blocked hosts) should not break the app.
  if (e && e.error) console.warn('Map error:', e.error.message || e.error);
});

window.addEventListener('hashchange', () => {
  const m = location.hash.match(/circuit=([\w-]+)/);
  if (m && byId[m[1]]) selectCircuit(byId[m[1]], { fly: true });
});
