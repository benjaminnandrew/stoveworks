// Hearth Studio render engine (WebGL2).
// Composites stone veneer onto a room image, per pixel:
//   perspective-correct wall coordinates (inches) -> seamless stone texture
//   joint width from a distance field, mortar color, relief lit by the room's light
//   tone-mapped with the same curve the scene renders used.

const MAXZ = 6;      // surfaces per room
const SLOTS = 3;     // distinct stones per render pass
const DMAX = 1.5;    // inches encoded in dist textures

const VS = `#version 300 es
in vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FS = `#version 300 es
precision highp float;
precision highp int;
out vec4 outColor;

uniform vec2 uCanvas;        // canvas size in px
uniform vec2 uImg;           // image size in px
uniform vec3 uView;          // scale (canvas px per image px), offset x, offset y (canvas px)
uniform sampler2D uBase, uMask0, uMask1, uIrr, uGrad;
uniform int uIrrMode;        // 0 = log2-encoded 8-bit, 1 = linear float
uniform vec2 uIrrRange;
uniform int uUseGradTex;
uniform int uComposite;      // 0 = rendered scene (replace drywall), 1 = photo (mix)
uniform vec3 uDrywall;       // linear albedo of the plain wall in scene renders
uniform float uExpo;         // extra exposure (photo mode brightness)
uniform vec3 uTint;          // light color adjustment
uniform float uRelief;       // relief strength multiplier
uniform float uTime;
uniform vec4 uBg;            // letterbox color
uniform float uGrid;         // 1 = draw 1 ft grid on stone
uniform sampler2D uFire;     // share of each pixel's light that comes from the fire (evening scenes)
uniform int uUseFire;
uniform float uFlick;        // current firelight multiplier (1 = steady)

uniform mat3 uH[${MAXZ}];
uniform int uZMask[${MAXZ}];     // tex*3+channel, -1 = none
uniform int uZMode[${MAXZ}];     // 0 off, 1 stone, 2 paint, 3 tint (recolor what's there: uZPaint = albedo ratio)
uniform int uZSlot[${MAXZ}];
uniform vec3 uZMortar[${MAXZ}];
uniform float uZJoint[${MAXZ}];  // half joint width, inches
uniform vec3 uZPaint[${MAXZ}];
uniform vec4 uZXf[${MAXZ}];      // offset u, offset v (in), shuffle seed, unused
uniform vec2 uZGrad[${MAXZ}];
uniform float uZSel[${MAXZ}];

uniform sampler2D uAlb0, uAlb1, uAlb2, uHgt0, uHgt1, uHgt2, uDst0, uDst1, uDst2;
uniform vec4 uSInfo[${SLOTS}];   // tileW, tileH, reliefIn, rowShuffle

vec3 oetf(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 tonemap(vec3 x){ x = max(x, 0.0); return oetf(clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0)); }
vec3 eotf(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
// inverse of tonemap(): back to scene-linear light, so a surface can be recolored and keep its shading
vec3 untonemap(vec3 y){
  y = min(eotf(y), vec3(0.985));
  vec3 a = 2.43 * y - 2.51, b = 0.59 * y - 0.03, c = 0.14 * y;
  return max((-b - sqrt(max(b * b - 4.0 * a * c, 0.0))) / (2.0 * a), 0.0);
}
float hash1(float n){ return fract(sin(n * 127.1 + 311.7) * 43758.5453); }

vec3 albS(int s, vec2 t, vec2 dx, vec2 dy){ if(s==0) return textureGrad(uAlb0,t,dx,dy).rgb; if(s==1) return textureGrad(uAlb1,t,dx,dy).rgb; return textureGrad(uAlb2,t,dx,dy).rgb; }
float hgtS(int s, vec2 t, vec2 dx, vec2 dy){ if(s==0) return textureGrad(uHgt0,t,dx,dy).r; if(s==1) return textureGrad(uHgt1,t,dx,dy).r; return textureGrad(uHgt2,t,dx,dy).r; }
float dstS(int s, vec2 t, vec2 dx, vec2 dy){ if(s==0) return textureGrad(uDst0,t,dx,dy).r; if(s==1) return textureGrad(uDst1,t,dx,dy).r; return textureGrad(uDst2,t,dx,dy).r; }

vec3 decodeIrr(vec2 uv){
  vec3 e = texture(uIrr, uv).rgb;
  if (uIrrMode == 0) return exp2(mix(vec3(uIrrRange.x), vec3(uIrrRange.y), e));
  return e;
}

vec3 shadeStone(int k, vec2 wall, vec2 wdx, vec2 wdy, vec3 irr, vec2 g){
  // wall: inches (u right, v up); wdx/wdy: its screen derivatives (taken in uniform control flow)
  int s = uZSlot[k];
  vec4 si = uSInfo[s];
  vec2 inv = vec2(1.0 / si.x, -1.0 / si.y);
  vec2 tc = wall * inv;
  vec2 dx = wdx * inv, dy = wdy * inv;
  if (si.w > 0.5) { float row = floor(tc.y); tc.x += hash1(row + uZXf[k].z * 17.0); }
  float fp = max(length(wdx), length(wdy));   // inches per pixel
  vec3 alb = albS(s, tc, dx, dy);
  float d = dstS(s, tc, dx, dy) * ${DMAX.toFixed(2)};
  float h = hgtS(s, tc, dx, dy);
  float eps = max(0.22, fp * 1.5);
  vec2 eu = vec2(eps / si.x, 0.0), ev = vec2(0.0, eps / si.y);
  float hu = hgtS(s, tc + eu, dx, dy), hv = hgtS(s, tc - ev, dx, dy);
  float rel = si.z * uRelief;
  float dhu = (hu - h) * rel / eps, dhv = (hv - h) * rel / eps;
  // joint
  float jw = uZJoint[k];
  float aa = max(fp * 0.7, 0.015);
  float stoneM = smoothstep(jw - aa, jw + aa, d);
  vec3 n = normalize(vec3(-dhu, -dhv, 1.0));
  // first-order irradiance response to the tilted surface normal (from the room's light)
  float lf = clamp(1.0 + g.x * n.x + g.y * n.y, 0.18, 2.6) * mix(1.0, n.z, 0.25);
  float edgeAO = mix(0.72, 1.0, smoothstep(jw, jw + 0.45, d));
  vec3 stoneLin = alb * irr * lf * edgeAO;
  // mortar: recessed, shadowed near stone edges; dry stack shows dark gaps
  float depth = clamp((jw - d) / max(jw, 0.03), 0.0, 1.0);
  float mAO = mix(0.5, 0.96, smoothstep(0.0, 0.7, depth));
  float dry = 1.0 - smoothstep(0.08, 0.17, jw);
  float side = clamp(0.5 + 0.5 * (g.x * 0.0 - g.y * 0.6), 0.6, 1.0);
  vec3 mortLin = mix(uZMortar[k] * mAO * side, vec3(0.010, 0.009, 0.008), dry) * irr;
  vec3 lin = mix(mortLin, stoneLin, stoneM);
  if (uGrid > 0.5) {
    vec2 f = abs(fract(wall / 12.0 + 0.5) - 0.5) * 12.0;
    float gl = 1.0 - smoothstep(fp * 0.6, fp * 1.6, min(f.x, f.y));
    lin = mix(lin, vec3(1.6, 1.2, 0.5) * max(dot(irr, vec3(0.33)), 0.2), gl * 0.85);
  }
  return tonemap(lin * uExpo);
}

void main(){
  vec2 px = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 uv = (px - uView.yz) / (uView.x * uImg);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { outColor = uBg; return; }
  vec3 base = texture(uBase, uv).rgb;
  float fk = uUseFire == 1 ? 1.0 + (uFlick - 1.0) * texture(uFire, uv).r : 1.0;
  base *= fk;
  vec3 m0 = texture(uMask0, uv).rgb, m1 = texture(uMask1, uv).rgb;
  float cov[${MAXZ}];
  cov[0] = m0.r; cov[1] = m0.g; cov[2] = m0.b; cov[3] = m1.r; cov[4] = m1.g; cov[5] = m1.b;
  vec3 irr = decodeIrr(uv) * uTint * fk;
  vec2 gt = uUseGradTex == 1 ? (texture(uGrad, uv).rg - 0.5) * 4.0 : vec2(0.0);
  vec3 col = base;
  vec3 dry = tonemap(uDrywall * irr);
  float selEdge = 0.0, selFill = 0.0;
  for (int k = 0; k < ${MAXZ}; k++) {
    int mi = uZMask[k];
    if (mi < 0) continue;
    float m = cov[mi];
    float sel = uZSel[k];
    float e = clamp(fwidth(m) * 2.2, 0.0, 1.0);
    if (sel > 0.0) {
      selEdge = max(selEdge, e * sel);
      selFill = max(selFill, m * sel);
    }
    if (uZMode[k] == 0) continue;
    vec3 hw = uH[k] * vec3(uv, 1.0);
    vec2 wall = hw.xy / hw.z + uZXf[k].xy;
    vec2 wdx = dFdx(wall), wdy = dFdy(wall);
    if (m < 0.002) continue;
    if (uZMode[k] == 3) { col = mix(col, tonemap(untonemap(base) * uZPaint[k]), m); continue; }
    vec2 g = uUseGradTex == 1 ? gt : uZGrad[k];
    vec3 sc = uZMode[k] == 2 ? tonemap(uZPaint[k] * irr * uExpo) : shadeStone(k, wall, wdx, wdy, irr, g);
    if (uComposite == 0) col += m * (sc - dry);
    else col = mix(col, sc, m);
  }
  if (selFill > 0.0) {
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0);
    col = mix(col, vec3(0.55, 0.85, 0.75), selFill * 0.06 * (0.6 + 0.4 * pulse));
    float dash = step(0.5, fract((px.x + px.y) / 14.0 - uTime * 0.6));
    col = mix(col, mix(vec3(1.0), vec3(0.32, 0.72, 0.6), dash), selEdge);
  }
  outColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    throw new Error("Shader compile failed: " + log);
  }
  return s;
}

export class StoneEngine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 is not available on this device.");
    this.gl = gl;
    gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    this.floatOK = !!gl.getExtension("EXT_color_buffer_float");
    gl.getExtension("OES_texture_float_linear");
    const p = gl.createProgram();
    gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FS));
    gl.bindAttribLocation(p, 0, "aPos");
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error("Link failed: " + gl.getProgramInfoLog(p));
    this.prog = p;
    this.loc = {};
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      const name = info.name.replace(/\[0\]$/, "");
      this.loc[name] = gl.getUniformLocation(p, info.name);
    }
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.stones = new Map();     // id -> {alb, hgt, dst, info}
    this.blank = this._solidTex([0, 0, 0, 255]);
    this.neutralGrad = this._solidTex([128, 128, 128, 255]);
    this.scene = null;
    this.view = { scale: 1, ox: 0, oy: 0 };
    this.bg = [0.08, 0.085, 0.085, 1];
    this.time = 0;
    this.grid = false;
  }

  _solidTex(rgba) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(rgba));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    return t;
  }

  texFromImage(img, { internal = "RGBA8", format = "RGBA", mip = false, repeat = false, linear = true } = {}) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl[internal], gl[format], gl.UNSIGNED_BYTE, img);
    const wrap = repeat ? gl.REPEAT : gl.CLAMP_TO_EDGE;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      const af = gl.getExtension("EXT_texture_filter_anisotropic");
      if (af) gl.texParameterf(gl.TEXTURE_2D, af.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(af.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    }
    return t;
  }

  texFromFloat(w, h, data) {
    const gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    return t;
  }

  deleteTex(t) { if (t && t !== this.blank && t !== this.neutralGrad) this.gl.deleteTexture(t); }

  /** Register a stone (images already decoded). */
  addStone(id, { albedo, height, dist, tileIn, reliefIn, rowShuffle }) {
    if (this.stones.has(id)) return;
    this.stones.set(id, {
      alb: this.texFromImage(albedo, { internal: "SRGB8_ALPHA8", mip: true, repeat: true }),
      hgt: this.texFromImage(height, { internal: "R8", format: "RED", mip: true, repeat: true }),
      dst: this.texFromImage(dist, { internal: "R8", format: "RED", mip: true, repeat: true }),
      info: [tileIn[0], tileIn[1], reliefIn, rowShuffle ? 1 : 0],
    });
  }
  hasStone(id) { return this.stones.has(id); }

  /**
   * scene = { width, height, base, masks:[tex,tex?], irr:{tex, mode, range}, grad:{tex}|null,
   *           composite:0|1, drywall:[r,g,b], zones:[{H:3x3 rows, mask:[tex,ch]|null, grad:[gx,gy]}] }
   * Textures are owned by the caller (see app); engine just draws.
   */
  setScene(scene) { this.scene = scene; }

  fit(mode = "contain") {
    const s = this.scene; if (!s) return;
    const cw = this.canvas.width, ch = this.canvas.height;
    const sc = mode === "cover" ? Math.max(cw / s.width, ch / s.height) : Math.min(cw / s.width, ch / s.height);
    this.view = { scale: sc, ox: (cw - s.width * sc) / 2, oy: (ch - s.height * sc) / 2, fitScale: sc };
  }

  /** canvas px -> normalized image uv */
  toUV(px, py) {
    const v = this.view, s = this.scene;
    return [(px - v.ox) / (v.scale * s.width), (py - v.oy) / (v.scale * s.height)];
  }
  toCanvas(u, v) {
    const vw = this.view, s = this.scene;
    return [u * s.width * vw.scale + vw.ox, v * s.height * vw.scale + vw.oy];
  }

  /** Draw one pass with a given look into the current framebuffer (optionally scissored). */
  _pass(look, { w, h, view, scissor = null, expo = 1, tint = [1, 1, 1], relief = 1, time = 0, sel = [] }) {
    const gl = this.gl, s = this.scene, L = this.loc;
    gl.useProgram(this.prog);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, w, h);
    if (scissor) { gl.enable(gl.SCISSOR_TEST); gl.scissor(scissor[0], scissor[1], scissor[2], scissor[3]); }
    else gl.disable(gl.SCISSOR_TEST);
    gl.uniform2f(L.uCanvas, w, h);
    gl.uniform2f(L.uImg, s.width, s.height);
    gl.uniform3f(L.uView, view.scale, view.ox, view.oy);
    gl.uniform4fv(L.uBg, this.bg);
    gl.uniform1f(L.uTime, time);
    gl.uniform1f(L.uGrid, this.grid ? 1 : 0);
    gl.uniform1i(L.uIrrMode, s.irr.mode);
    gl.uniform2f(L.uIrrRange, s.irr.range[0], s.irr.range[1]);
    gl.uniform1i(L.uUseGradTex, s.grad ? 1 : 0);
    gl.uniform1i(L.uComposite, s.composite);
    gl.uniform3fv(L.uDrywall, s.drywall);
    gl.uniform1f(L.uExpo, expo);
    gl.uniform3fv(L.uTint, tint);
    gl.uniform1f(L.uRelief, relief);
    // textures 0..4
    const bind = (unit, tex, name) => { gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, tex); gl.uniform1i(L[name], unit); };
    bind(0, s.base, "uBase");
    bind(1, s.masks[0] || this.blank, "uMask0");
    bind(2, s.masks[1] || this.blank, "uMask1");
    bind(3, s.irr.tex, "uIrr");
    bind(4, s.grad ? s.grad.tex : this.neutralGrad, "uGrad");
    bind(14, s.fire || this.blank, "uFire");
    gl.uniform1i(L.uUseFire, s.fire ? 1 : 0);
    gl.uniform1f(L.uFlick, Number.isFinite(this.flick) ? this.flick : 1);   // 0 takes the fire's light out entirely
    // stone slots
    const slotIds = [];
    const zMask = new Int32Array(6).fill(-1), zMode = new Int32Array(6), zSlot = new Int32Array(6);
    const zMortar = new Float32Array(18), zJoint = new Float32Array(6), zPaint = new Float32Array(18), zXf = new Float32Array(24), zGrad = new Float32Array(12), zSel = new Float32Array(6), H = new Float32Array(54);
    s.zones.forEach((z, k) => {
      if (k >= 6) return;
      const a = look.zones[z.id] || { mode: "off" };
      if (z.mask) zMask[k] = z.mask[0] * 3 + z.mask[1];
      zMode[k] = a.mode === "stone" ? 1 : a.mode === "paint" ? 2 : a.mode === "tint" ? 3 : 0;
      if (zMode[k] === 1) {
        if (!this.stones.has(a.stone)) zMode[k] = 0;
        else {
          let si = slotIds.indexOf(a.stone);
          if (si < 0 && slotIds.length < SLOTS) { slotIds.push(a.stone); si = slotIds.length - 1; }
          if (si < 0) zMode[k] = 0; else zSlot[k] = si;
        }
      }
      const mc = a.mortar || [0.5, 0.5, 0.5];
      zMortar.set(mc, k * 3);
      zJoint[k] = a.joint ?? 0.25;
      zPaint.set(a.paint || [0.7, 0.7, 0.7], k * 3);
      zXf.set([a.offU || 0, a.offV || 0, a.seed || 0, 0], k * 4);
      zGrad.set(z.grad || [0, 0], k * 2);
      zSel[k] = sel[k] || 0;
      // mat3 column-major
      const m = z.H;
      H.set([m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]], k * 9);
    });
    gl.uniformMatrix3fv(L.uH, false, H);
    gl.uniform1iv(L.uZMask, zMask);
    gl.uniform1iv(L.uZMode, zMode);
    gl.uniform1iv(L.uZSlot, zSlot);
    gl.uniform3fv(L.uZMortar, zMortar);
    gl.uniform1fv(L.uZJoint, zJoint);
    gl.uniform3fv(L.uZPaint, zPaint);
    gl.uniform4fv(L.uZXf, zXf);
    gl.uniform2fv(L.uZGrad, zGrad);
    gl.uniform1fv(L.uZSel, zSel);
    const info = new Float32Array(12);
    for (let i = 0; i < SLOTS; i++) {
      const st = this.stones.get(slotIds[i]);
      const unitA = 5 + i, unitH = 8 + i, unitD = 11 + i;
      bind(unitA, st ? st.alb : this.blank, "uAlb" + i);
      bind(unitH, st ? st.hgt : this.blank, "uHgt" + i);
      bind(unitD, st ? st.dst : this.blank, "uDst" + i);
      info.set(st ? st.info : [24, 24, 1, 0], i * 4);
    }
    gl.uniform4fv(L.uSInfo, info);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /**
   * Render to the visible canvas.
   * opts.compare: {mode:'before'|'look', split: 0..1 (canvas x fraction), lookB}
   */
  render(look, opts = {}) {
    if (!this.scene) return;
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    const w = this.canvas.width, h = this.canvas.height;
    const common = { w, h, view: this.view, expo: opts.expo ?? 1, tint: opts.tint || [1, 1, 1], relief: opts.relief ?? 1, time: opts.time || 0, sel: opts.sel || [] };
    const cmp = opts.compare;
    if (!cmp || cmp.mode === "off") { this._pass(look, common); return; }
    const sx = Math.round(cmp.split * w);
    // right side: current look; left side: "before" (no stone) or look B
    this._pass(look, { ...common, scissor: [sx, 0, w - sx, h] });
    const left = cmp.mode === "before" ? { zones: {} } : cmp.lookB;
    this._pass(left, { ...common, sel: [], scissor: [0, 0, Math.max(0, sx), h] });
    gl.disable(gl.SCISSOR_TEST);
  }

  /** Full-resolution render to a 2D canvas (for saving). */
  renderToCanvas(look, opts = {}) {
    const gl = this.gl, s = this.scene;
    const w = s.width, h = s.height;
    const fb = gl.createFramebuffer();
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const view = { scale: 1, ox: 0, oy: 0 };
    const prevGrid = this.grid; this.grid = false;
    const cmp = opts.compare;
    if (cmp && cmp.mode !== "off") {
      const sx = Math.round(cmp.split * w);
      this._pass(look, { w, h, view, scissor: [sx, 0, w - sx, h], expo: opts.expo ?? 1, tint: opts.tint || [1, 1, 1], relief: opts.relief ?? 1 });
      this._pass(cmp.mode === "before" ? { zones: {} } : cmp.lookB, { w, h, view, scissor: [0, 0, sx, h], expo: opts.expo ?? 1, tint: opts.tint || [1, 1, 1], relief: opts.relief ?? 1 });
    } else {
      this._pass(look, { w, h, view, expo: opts.expo ?? 1, tint: opts.tint || [1, 1, 1], relief: opts.relief ?? 1 });
    }
    this.grid = prevGrid;
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(fb); gl.deleteTexture(tex);
    // flip rows (GL origin bottom-left; our shader already wrote top row at y=h-1)
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    const id = ctx.createImageData(w, h);
    const row = w * 4;
    for (let y = 0; y < h; y++) id.data.set(px.subarray((h - 1 - y) * row, (h - y) * row), y * row);
    ctx.putImageData(id, 0, 0);
    return c;
  }
}

export const LIMITS = { MAXZ, SLOTS, DMAX };
