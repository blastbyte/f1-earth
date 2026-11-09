// MapLibre custom layer that draws the circuits as textured 3D road meshes:
// asphalt, white edge lines, red and white kerbs in the corners, a chequered
// start/finish line, and embankments down to the terrain.

import { VERTEX_FLOATS, TRACK_WIDTH } from './track.js';

const VERT = `
ATTR vec3 a_pos;
ATTR vec2 a_uv;
ATTR vec4 a_misc;
uniform mat4 u_matrix;
uniform float u_exag;
uniform float u_metre;
uniform float u_depth_a;
uniform float u_depth_bias;
VARY_OUT vec2 v_uv;
VARY_OUT vec2 v_info;
void main() {
  float h = a_pos.z * u_exag + a_misc.x;
  vec4 p = u_matrix * vec4(a_pos.xy, h * u_metre, 1.0);
  // Pull the road surface a little towards the camera in depth only, so small
  // differences from the terrain mesh cannot bury it.
  float b = min(u_depth_bias * a_misc.w, 0.5 * p.w);
  if (p.w > 0.0 && b > 0.0) p.z = p.w * (p.z - u_depth_a * b) / (p.w - b);
  v_uv = a_uv;
  v_info = a_misc.yz;
  gl_Position = p;
}`;

const FRAG = `
precision highp float;
uniform sampler2D u_tex;
uniform float u_tint;
uniform float u_opacity;
uniform float u_hw;
VARY_IN vec2 v_uv;
VARY_IN vec2 v_info;
vec3 ramp(float t) {
  vec3 c0 = vec3(0.17, 0.42, 1.0), c1 = vec3(0.0, 0.72, 0.83), c2 = vec3(0.34, 0.89, 0.62);
  vec3 c3 = vec3(1.0, 0.82, 0.25), c4 = vec3(1.0, 0.23, 0.18);
  if (t < 0.25) return mix(c0, c1, t * 4.0);
  if (t < 0.5) return mix(c1, c2, (t - 0.25) * 4.0);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) * 4.0);
  return mix(c3, c4, clamp((t - 0.75) * 4.0, 0.0, 1.0));
}
float band(float x, float lo, float hi, float aa) {
  return smoothstep(lo - aa, lo + aa, x) * (1.0 - smoothstep(hi - aa, hi + aa, x));
}
void main() {
  float kind = floor(v_info.y + 0.5);
  float grain = TEX(u_tex, v_uv / 5.0).r;
  float patch_ = TEX(u_tex, v_uv / 37.0).g;
  vec3 col;
  if (kind > 1.5) {
    col = vec3(0.19, 0.18, 0.16) * (0.8 + 0.4 * grain);
  } else if (kind > 0.5) {
    float aa = fwidth(v_uv.y) / 3.0;
    float f = fract(v_uv.y / 3.0);
    float stripe = band(f, 0.5, 1.0, aa) + (1.0 - smoothstep(0.0, aa, f));
    col = mix(vec3(0.82, 0.07, 0.05), vec3(0.93), clamp(stripe, 0.0, 1.0)) * (0.82 + 0.3 * grain);
  } else {
    float e = abs(v_uv.x);
    float aa = fwidth(v_uv.x);
    float tone = 0.2 + 0.11 * grain + 0.05 * patch_;
    // darker rubbered-in band down the middle of the road
    tone *= 1.0 - 0.2 * exp(-pow(v_uv.x / 2.6, 2.0));
    col = vec3(tone, tone, tone * 1.04);
    col = mix(col, ramp(v_info.x) * (0.55 + 0.9 * grain), u_tint * 0.72);
    // white lines along both edges
    col = mix(col, vec3(0.9), band(e, u_hw - 0.5, u_hw - 0.22, aa) * 0.95);
    // chequered start/finish line
    float av = fwidth(v_uv.y);
    float onLine = band(v_uv.y, 0.4, 2.0, av) * (1.0 - smoothstep(u_hw - 0.6 - aa, u_hw - 0.6 + aa, e));
    vec2 cell = floor(vec2(v_uv.x, v_uv.y - 0.4) / 0.8);
    float chk = mod(cell.x + cell.y, 2.0);
    col = mix(col, mix(vec3(0.06), vec3(0.94), chk), onLine);
  }
  FRAG_COLOR = vec4(col * u_opacity, u_opacity);
}`;

function source(gl2, text, isFrag) {
  if (gl2) {
    return '#version 300 es\n' + (isFrag ? 'precision highp float;\nout vec4 fragColor;\n' : '') + text
      .replace(/ATTR/g, 'in').replace(/VARY_OUT/g, 'out').replace(/VARY_IN/g, 'in')
      .replace(/TEX\(/g, 'texture(').replace(/FRAG_COLOR/g, 'fragColor');
  }
  return (isFrag ? '#extension GL_OES_standard_derivatives : enable\n' : '') + text
    .replace(/ATTR/g, 'attribute').replace(/VARY_OUT/g, 'varying').replace(/VARY_IN/g, 'varying')
    .replace(/TEX\(/g, 'texture2D(').replace(/FRAG_COLOR/g, 'gl_FragColor');
}

// Tiling asphalt texture: fine grain in red, larger blotches in green.
function asphaltPixels(size) {
  let seed = 1234567;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const coarse = 16, grid = [];
  for (let i = 0; i < coarse * coarse; i++) grid.push(rnd());
  const g = (x, y) => grid[((y + coarse) % coarse) * coarse + ((x + coarse) % coarse)];
  const px = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * coarse, fy = (y / size) * coarse;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const blot = (g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty;
      const speck = rnd() < 0.04 ? 0.35 : 0;
      const grain = Math.min(1, 0.25 + rnd() * 0.5 + speck);
      const o = (y * size + x) * 4;
      px[o] = grain * 255; px[o + 1] = blot * 255; px[o + 2] = 128; px[o + 3] = 255;
    }
  }
  return px;
}

function mul(a, b) { // column-major 4x4, float64
  const out = new Float64Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  }
  return out;
}

export function createTrackLayer() {
  const meshes = new Map(); // id -> { mesh, vbo, ibo, vao, count, centre }
  let map, program, loc, texture, failed = false;

  const layer = {
    id: 'track-model',
    type: 'custom',
    renderingMode: '3d',
    visible: true,
    tint: false,
    minzoom: 12,

    onAdd(m) { map = m; },

    setMesh(id, mesh, centre) {
      const old = meshes.get(id);
      meshes.set(id, { mesh, centre, stale: old });
      if (map) map.triggerRepaint();
    },

    hasMesh(id) { return meshes.has(id); },

    _init(gl) {
      const gl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
      if (!gl2 && !gl.getExtension('OES_standard_derivatives')) throw new Error('derivatives unsupported');
      const compile = (type, text) => {
        const sh = gl.createShader(type);
        gl.shaderSource(sh, source(gl2, text, type === gl.FRAGMENT_SHADER));
        gl.compileShader(sh);
        if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh));
        return sh;
      };
      program = gl.createProgram();
      gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      loc = { a_pos: gl.getAttribLocation(program, 'a_pos'), a_uv: gl.getAttribLocation(program, 'a_uv'), a_misc: gl.getAttribLocation(program, 'a_misc') };
      for (const u of ['u_matrix', 'u_exag', 'u_metre', 'u_depth_a', 'u_depth_bias', 'u_tex', 'u_tint', 'u_opacity', 'u_hw']) {
        loc[u] = gl.getUniformLocation(program, u);
      }
      const size = 256;
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, asphaltPixels(size));
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
      if (aniso) gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    },

    _upload(gl, entry) {
      if (entry.stale) {
        gl.deleteBuffer(entry.stale.vbo); gl.deleteBuffer(entry.stale.ibo);
        entry.stale = null;
      }
      entry.vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, entry.vbo);
      gl.bufferData(gl.ARRAY_BUFFER, entry.mesh.verts, gl.STATIC_DRAW);
      entry.ibo = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, entry.ibo);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, entry.mesh.idx, gl.STATIC_DRAW);
      entry.count = entry.mesh.idx.length;
    },

    render(gl, args) {
      if (failed || !layer.visible || !meshes.size) return;
      const zoom = map.getZoom();
      const proj = args.defaultProjectionData;
      // The meshes are positioned in Mercator space; wait until the globe has flattened out.
      if (zoom < layer.minzoom || (proj.projectionTransition ?? 0) > 0.001) return;
      try {
        if (!program) layer._init(gl);
      } catch (err) {
        failed = true;
        console.warn('3D track model unavailable:', err.message);
        return;
      }
      const tr = map.transform;
      const centre = map.getCenter();
      const terrain = map.getTerrain();
      const near = tr.nearZ, far = tr.farZ;

      gl.useProgram(program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(loc.u_tex, 0);
      gl.uniform1f(loc.u_exag, terrain ? terrain.exaggeration ?? 1 : 0);
      gl.uniform1f(loc.u_tint, layer.tint ? 1 : 0);
      gl.uniform1f(loc.u_opacity, Math.min(1, (zoom - layer.minzoom) / 0.8));
      gl.uniform1f(loc.u_hw, TRACK_WIDTH / 2);
      gl.uniform1f(loc.u_depth_a, (far + near) / (far - near));
      gl.uniform1f(loc.u_depth_bias, 2.5 * tr.pixelsPerMeter);
      gl.disable(gl.CULL_FACE);

      const stride = VERTEX_FLOATS * 4;
      for (const entry of meshes.values()) {
        if (centre.distanceTo(new centre.constructor(entry.centre[0], entry.centre[1])) > 60000) continue;
        if (!entry.vbo || entry.stale) layer._upload(gl, entry);
        const o = entry.mesh.origin;
        const translate = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, o[0], o[1], 0, 1]);
        gl.uniformMatrix4fv(loc.u_matrix, false, new Float32Array(mul(proj.mainMatrix, translate)));
        gl.uniform1f(loc.u_metre, entry.mesh.metre);
        gl.bindBuffer(gl.ARRAY_BUFFER, entry.vbo);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, entry.ibo);
        gl.enableVertexAttribArray(loc.a_pos);
        gl.vertexAttribPointer(loc.a_pos, 3, gl.FLOAT, false, stride, 0);
        gl.enableVertexAttribArray(loc.a_uv);
        gl.vertexAttribPointer(loc.a_uv, 2, gl.FLOAT, false, stride, 12);
        gl.enableVertexAttribArray(loc.a_misc);
        gl.vertexAttribPointer(loc.a_misc, 4, gl.FLOAT, false, stride, 20);
        gl.drawElements(gl.TRIANGLES, entry.count, gl.UNSIGNED_SHORT, 0);
      }
    }
  };
  return layer;
}
