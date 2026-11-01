// Hearth Studio render engine (WebGL2).
// Composites stone veneer onto a room image, per pixel:
//   perspective-correct wall coordinates (inches) -> seamless stone texture
//   joint width from a distance field, mortar color, relief lit by the room's light
//   tone-mapped with the same curve the scene renders used.

const MAXZ = 6;      // surfaces per room
const SLOTS = 3;     // distinct stones per render pass
const DMAX = 1.5;    // inches encoded in dist textures
const NCAP = 8;      // stovepipe pieces

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

// a catalog stove standing in a sample room: the light it takes away from the room around it
uniform int uSt;                 // 1 = a stove stands in this room
uniform sampler2D uShade;        // per pixel: camera distance (16 bits in r, g) and direct-sun share (b)
uniform ivec2 uShadeSize;
uniform float uDistMax;          // metres at r = g = 1
uniform mat3 uRay;               // scene px -> world ray direction
uniform vec3 uCamC;              // camera position (m)
uniform vec3 uBoxMin, uBoxMax;   // the stove's body (m)
uniform vec4 uFoot;              // its footprint x0, y0, x1, y1 (m)
uniform float uFootZ;            // the floor it stands on (m)
uniform vec4 uAo;                // contact shadow: under it, beside it, reach under (m), reach beside (m)
uniform int uUseSun;
uniform vec3 uSunTo;             // toward the sun
uniform vec4 uCapA[${NCAP}], uCapB[${NCAP}];  // stovepipe capsules: a.xyz + radius, b.xyz
uniform int uNCap;

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

float rayBox(vec3 o, vec3 d, vec3 bmin, vec3 bmax){
  vec3 inv = 1.0 / d;
  vec3 t0 = (bmin - o) * inv, t1 = (bmax - o) * inv;
  vec3 tn = min(t0, t1), tf = max(t0, t1);
  float a = max(max(tn.x, tn.y), tn.z), b = min(min(tf.x, tf.y), tf.z);
  return b > max(a, 0.0) ? 1.0 : 0.0;
}
// distance between a ray and a segment, and where along the ray it's closest
float raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float t){
  vec3 ba = b - a, oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), oaba = dot(oa, ba), oard = dot(oa, rd);
  float den = max(baba - bard * bard, 1e-9);
  float tt = (bard * oaba - baba * oard) / den;
  float h = clamp((oaba + tt * bard) / baba, 0.0, 1.0);
  t = dot(a + h * ba - ro, rd);
  return length(ro + t * rd - (a + h * ba));
}
// share of the light a stove leaves at world point P (1 = all of it)
float stoveLight(vec3 P, float sunShare){
  // contact shadow: under the stove (between its legs) and close beside it
  vec2 q = max(vec2(uFoot.x - P.x, uFoot.y - P.y), vec2(P.x - uFoot.z, P.y - uFoot.w));
  float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float low = 1.0 - smoothstep(0.0, uAo.z, P.z - uFootZ);
  float under = uAo.x * (1.0 - smoothstep(-0.07, 0.10, sdf)) * low;
  vec3 c = clamp(P, uBoxMin, uBoxMax);
  float beside = uAo.y * exp(-length(P - c) / uAo.w);
  float k = 1.0 - max(under, beside);
  if (uUseSun == 1 && sunShare > 0.004) {
    vec3 L = normalize(uSunTo);
    vec3 t1 = normalize(cross(L, vec3(0.0, 0.0, 1.0))), t2 = cross(L, t1);
    float occ = 0.0;
    for (int i = 0; i < 5; i++) {
      float an = float(i) * 1.5708;
      vec2 j = i == 0 ? vec2(0.0) : vec2(cos(an), sin(an)) * 0.016;
      vec3 d = normalize(L + t1 * j.x + t2 * j.y);
      float hit = rayBox(P + d * 0.004, d, uBoxMin, uBoxMax);
      for (int n = 0; n < ${NCAP}; n++) {
        if (n >= uNCap) break;
        float tr; float dd = raySeg(P, d, uCapA[n].xyz, uCapB[n].xyz, tr);
        if (tr > 0.004 && dd < uCapA[n].w) hit = 1.0;
      }
      occ += hit;
    }
    k *= 1.0 - sunShare * occ / 5.0;
  }
  return k;
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
  if (uSt == 1) {
    // where this pixel is in the room, from its camera distance (nearest texel: no blending across edges)
    vec4 sh = texelFetch(uShade, clamp(ivec2(uv * vec2(uShadeSize)), ivec2(0), uShadeSize - 1), 0);
    float dist = (sh.r * 65280.0 + sh.g * 255.0) / 65535.0 * uDistMax;
    vec3 P = uCamC + normalize(uRay * vec3(uv * uImg, 1.0)) * dist;
    float lk = stoveLight(P, sh.b);
    if (lk < 0.999) { base = tonemap(untonemap(base) * lk); irr *= lk; }
  }
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

// The stove itself and its pipe, drawn over the room after the stone (premultiplied alpha).
const SFS = `#version 300 es
precision highp float;
out vec4 outColor;
uniform vec2 uCanvas;
uniform vec3 uView;
uniform vec4 uBBox;              // scene px the stove and pipe cover
uniform sampler2D uCut;          // the cutout (sRGB, so it samples linear)
uniform vec3 uCutXf;             // scene px = t + s * cutout px: s, tx, ty
uniform vec2 uCutSize;
uniform vec3 uCutY, uCutR;       // up the photo in two parts: scene y of the top's back, the top's front and the floor, and their cutout rows
uniform vec4 uGlass;             // the fire window, cutout fractions
uniform vec4 uSpan;              // measured front: left, right; outline top, bottom (cutout fractions)
uniform vec3 uEFront, uESide;    // light on the stove's front and its visible side
uniform float uProf[8];          // light across the front, screen left to right (relative)
uniform float uVProf[5];         // and from the floor up
uniform float uStudio;           // studio photo -> surface color
uniform float uEmis;             // brightness of the fire behind the glass
uniform float uEve, uFlick, uExpo;
uniform vec3 uTint;
uniform mat3 uRay;
uniform vec3 uCamC, uCamFwd;
uniform float uFpx;              // focal length, scene px
uniform vec4 uCapA[${NCAP}], uCapB[${NCAP}];
uniform int uNCap;
uniform vec4 uThim;              // trim ring on the chimney: centre xyz, radius
uniform float uPipeTop;          // a pipe that stands on the stove's top: the top's height (else far below)
uniform vec3 uLdir;              // where the strongest light comes from (for the pipe)
// a built-in fireplace's front, flat on the room's wall (the site's, 31 Oct 2026)
uniform int uFace;               // 1 = draw the cutout as a fireplace's front
uniform mat3 uFaceH;             // scene px -> cutout fractions (stoves.js, placeFace)
uniform sampler2D uIrr, uFire;   // the room's light and its fire's share, as the room pass reads them
uniform int uIrrMode, uUseFire;
uniform vec2 uIrrRange, uImg;

vec3 oetf(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
vec3 tonemap(vec3 x){ x = max(x, 0.0); return oetf(clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14), 0.0, 1.0)); }
float raySeg(vec3 ro, vec3 rd, vec3 a, vec3 b, out float t, out vec3 q, out vec3 ax){
  vec3 ba = b - a, oa = ro - a;
  float baba = dot(ba, ba), bard = dot(ba, rd), oaba = dot(oa, ba), oard = dot(oa, rd);
  float den = max(baba - bard * bard, 1e-9);
  float tt = (bard * oaba - baba * oard) / den;
  float h = clamp((oaba + tt * bard) / baba, 0.0, 1.0);
  t = dot(a + h * ba - ro, rd);
  q = ro + t * rd - (a + h * ba);
  ax = ba / sqrt(baba);
  return length(q);
}
float prof8(float u){ float x = clamp((u - 0.03) / 0.94, 0.0, 1.0) * 7.0; int i = int(min(floor(x), 6.0)); float f = x - float(i);
  float a = uProf[0], b = uProf[1];
  for (int k = 0; k < 7; k++) if (k == i) { a = uProf[k]; b = uProf[k + 1]; }
  return mix(a, b, f); }
float prof5(float v){ float x = clamp((v - 0.06) / 0.88, 0.0, 1.0) * 4.0; int i = int(min(floor(x), 3.0)); float f = x - float(i);
  float a = uVProf[0], b = uVProf[1];
  for (int k = 0; k < 4; k++) if (k == i) { a = uVProf[k]; b = uVProf[k + 1]; }
  return mix(a, b, f); }
vec3 lightOn(vec3 n){
  // a matte surface facing n: the front's light, plus the side light where it faces that way
  vec3 amb = uEFront * 0.85;
  vec3 dir = max(uESide - amb, vec3(0.0));
  return amb + dir * max(dot(n, uLdir), 0.0) + uEFront * 0.15 * max(n.y, 0.0);
}
void main(){
  vec2 px = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 ip = (px - uView.yz) / uView.x;
  if (ip.x < uBBox.x || ip.y < uBBox.y || ip.x > uBBox.z || ip.y > uBBox.w) discard;
  if (uFace == 1) {
    // a built-in fireplace's front: the photo straight on, mapped onto the wall, lit by the light on
    // the wall right there (the same light a painted wall gets)
    vec3 q = uFaceH * vec3(ip, 1.0);
    vec2 fuv = q.xy / q.z;
    vec4 c = texture(uCut, clamp(fuv, 0.0, 1.0));
    if (fuv.x < 0.0 || fuv.y < 0.0 || fuv.x > 1.0 || fuv.y > 1.0 || c.a <= 0.002) discard;
    vec2 uv = ip / uImg;
    float fk = uUseFire == 1 ? 1.0 + (uFlick - 1.0) * texture(uFire, uv).r : 1.0;
    vec3 e = texture(uIrr, uv).rgb;
    vec3 E = (uIrrMode == 0 ? exp2(mix(vec3(uIrrRange.x), vec3(uIrrRange.y), e)) : e) * fk;
    vec3 lin = c.rgb * uStudio * E;
    // behind the glass: the flames as the photo shows them, and the firebox lit by them (and a little
    // by the room, through the glass). A light liner drawn as fire, the stoves' way, glowed like a
    // lamp in the evening (31 Oct 2026)
    vec2 gq = max(uGlass.xy - fuv, fuv - uGlass.zw);
    float gd = length(max(gq, 0.0)) + min(max(gq.x, gq.y), 0.0);
    float g = 1.0 - smoothstep(-0.006, 0.002, gd);
    float fl = 1.0 + (uFlick - 1.0) * 1.6;
    float flame = smoothstep(0.40, 0.62, max(c.r, max(c.g, c.b)));
    vec3 inside = mix(c.rgb * uStudio * (E * 0.4 + vec3(2.3, 1.84, 1.15) * fl), c.rgb * uEmis * fl, flame);
    lin += uEve * vec3(1.0, 0.42, 0.12) * 0.22 * exp(-max(gd, 0.0) / 0.035) * c.rgb * 6.0;
    outColor = vec4(tonemap(mix(lin, inside, g) * uExpo * uTint) * c.a, c.a);
    return;
  }
  vec4 thim = vec4(0.0), pipe = vec4(0.0);
  vec3 ro = uCamC, rd = normalize(uRay * vec3(ip, 1.0));
  // ---- the trim ring on the chimney, then the pipe in front of it
  // pipe and ring black, as stovepipe is: they were twice the stove's black, and looked gray (Ben,
  // 31 Oct 2026)
  if (uThim.w > 0.0) {
    float t = (uThim.y - ro.y) / rd.y;
    vec3 p = ro + rd * t;
    float w = dot(p - ro, uCamFwd) / (uFpx * uView.x);
    float rr = length(p.xz - uThim.xz);
    float cov = clamp((uThim.w - rr) / w + 0.5, 0.0, 1.0);
    if (cov > 0.0) {
      float rim = smoothstep(uThim.w * 0.82, uThim.w * 0.95, rr);
      vec3 E = lightOn(vec3(0.0, 1.0, 0.0));
      vec3 c = tonemap((vec3(0.012) + rim * 0.008) * E * uExpo * uTint);
      thim = vec4(c * cov, cov);
    }
  }
  float best = 1e9, bcov = 0.0; vec3 bn = vec3(0.0);
  for (int i = 0; i < ${NCAP}; i++) {
    if (i >= uNCap) break;
    float t; vec3 q, ax;
    float r = uCapA[i].w;
    float d = raySeg(ro, rd, uCapA[i].xyz, uCapB[i].xyz, t, q, ax);
    float w = t / (uFpx * uView.x) * dot(rd, uCamFwd);
    float cov = clamp((r - d) / w + 0.5, 0.0, 1.0);
    if (cov <= 0.0 || t <= 0.0) continue;
    float dep = t - sqrt(max(r * r - d * d, 0.0));
    // a pipe that stands on the stove's top is cut flat there
    cov *= clamp((ro.z + rd.z * dep - uPipeTop) / w + 0.5, 0.0, 1.0);
    if (cov <= 0.0) continue;
    if (dep < best || cov > bcov + 0.5) {
      best = dep; bcov = max(bcov, cov);
      vec3 side = d > 1e-6 ? q / d : vec3(0.0);
      vec3 v = -rd - dot(-rd, ax) * ax; v = normalize(v);
      float e = clamp(d / r, 0.0, 1.0);
      bn = normalize(side * e + v * sqrt(1.0 - e * e));
    }
  }
  if (bcov > 0.0) {
    vec3 E = lightOn(bn);
    vec3 h = normalize(uLdir - rd);
    float sp = pow(max(dot(bn, h), 0.0), 28.0) * 0.012;
    vec3 c = tonemap((vec3(0.008) * E + sp * (uESide + uEFront) * 0.5) * uExpo * uTint);
    pipe = vec4(c * bcov, bcov);
  }
  vec4 acc = pipe + thim * (1.0 - pipe.a);
  // ---- the stove, over its pipe; a pipe that stands on the top is in front of the top (the site's,
  // 31 Oct 2026)
  // across, one scale (the maker's width). Up, the front (floor to the top's front edge: the maker's
  // height) and the top surface are each fitted to what the room's camera sees (the site's, 30 Oct 2026)
  float ry = ip.y >= uCutY.y
    ? uCutR.y + (ip.y - uCutY.y) * (uCutR.z - uCutR.y) / max(uCutY.z - uCutY.y, 1e-3)
    : uCutR.x + (ip.y - uCutY.x) * (uCutR.y - uCutR.x) / max(uCutY.y - uCutY.x, 1e-3);
  vec2 cuv = vec2((ip.x - uCutXf.y) / uCutXf.x, ry) / uCutSize;
  if (cuv.x >= 0.0 && cuv.y >= 0.0 && cuv.x <= 1.0 && cuv.y <= 1.0) {
    vec4 c = texture(uCut, cuv);
    if (c.a > 0.002) {
      float uf = (cuv.x - uSpan.x) / max(uSpan.y - uSpan.x, 1e-4);
      float vf = 1.0 - (cuv.y - uSpan.z) / max(uSpan.w - uSpan.z, 1e-4);
      float vp = prof5(vf);
      vec3 E = mix(uEFront * prof8(uf) * vp, uESide * vp, 1.0 - smoothstep(uSpan.x - 0.03, uSpan.x + 0.01, cuv.x));
      vec3 lin = c.rgb * uStudio * E;
      // the fire window shows the photo's own fire; in the evening its glow catches the door round it
      vec2 gq = max(uGlass.xy - cuv, cuv - uGlass.zw);
      float gd = length(max(gq, 0.0)) + min(max(gq.x, gq.y), 0.0);
      float g = 1.0 - smoothstep(-0.006, 0.002, gd);
      // only what's bright enough to be fire: the door's iron inside the box (an arched window's top
      // corners, a grille over the glass) is lit like the rest of the stove (the site's, 28 Oct 2026)
      g *= smoothstep(0.06, 0.22, max(c.r, max(c.g, c.b)));
      vec3 fire = c.rgb * uEmis * (1.0 + (uFlick - 1.0) * 1.6);
      lin += uEve * vec3(1.0, 0.42, 0.12) * 0.22 * exp(-max(gd, 0.0) / 0.035) * c.rgb * 6.0;
      lin = mix(lin, fire, g);
      vec4 sv = vec4(tonemap(lin * uExpo * uTint) * c.a, c.a);
      acc = uPipeTop > -100.0 && ip.y < uCutY.y ? pipe + (sv + thim * (1.0 - c.a)) * (1.0 - pipe.a) : sv + acc * (1.0 - c.a);
    }
  }
  if (acc.a <= 0.0) discard;
  outColor = acc;
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

const colMajor = (m) => [m[0][0], m[1][0], m[2][0], m[0][1], m[1][1], m[2][1], m[0][2], m[1][2], m[2][2]];
function capArrays(caps) {
  const a = new Float32Array(4 * NCAP), b = new Float32Array(4 * NCAP);
  const n = Math.min(NCAP, caps ? caps.length : 0);
  for (let i = 0; i < n; i++) { const c = caps[i]; a.set([c[0], c[1], c[2], c[3]], i * 4); b.set([c[4], c[5], c[6], 0], i * 4); }
  return [a, b, n];
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
    // the stove + pipe program
    const sp = gl.createProgram();
    gl.attachShader(sp, compile(gl, gl.VERTEX_SHADER, VS));
    gl.attachShader(sp, compile(gl, gl.FRAGMENT_SHADER, SFS));
    gl.bindAttribLocation(sp, 0, "aPos");
    gl.linkProgram(sp);
    if (!gl.getProgramParameter(sp, gl.LINK_STATUS)) throw new Error("Link failed: " + gl.getProgramInfoLog(sp));
    this.sprog = sp;
    this.sloc = {};
    const sn = gl.getProgramParameter(sp, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < sn; i++) {
      const info = gl.getActiveUniform(sp, i);
      this.sloc[info.name.replace(/\[0\]$/, "")] = gl.getUniformLocation(sp, info.name);
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
  _pass(look, { w, h, view, scissor = null, expo = 1, tint = [1, 1, 1], relief = 1, time = 0, sel = [], scene = null }) {
    const gl = this.gl, s = scene || this.scene, L = this.loc;
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
    gl.uniform1f(L.uFlick, s.noFire ? 0 : Number.isFinite(this.flick) ? this.flick : 1);   // 0 takes the fire's light out entirely
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
    // a catalog stove's shadows on the room
    const st = look.stove, sr = s.stoveRoom, on = !!(st && sr && sr.shade);
    gl.uniform1i(L.uSt, on ? 1 : 0);
    bind(15, on ? sr.shade : this.blank, "uShade");
    if (on) {
      gl.uniform2i(L.uShadeSize, sr.shadeSize[0], sr.shadeSize[1]);
      gl.uniform1f(L.uDistMax, sr.distMax);
      gl.uniformMatrix3fv(L.uRay, false, colMajor(sr.ray));
      gl.uniform3fv(L.uCamC, sr.C);
      gl.uniform3fv(L.uBoxMin, st.box.min);
      gl.uniform3fv(L.uBoxMax, st.box.max);
      gl.uniform4fv(L.uFoot, st.foot);
      gl.uniform1f(L.uFootZ, st.footZ);
      gl.uniform4fv(L.uAo, st.ao);
      gl.uniform1i(L.uUseSun, sr.useSun ? 1 : 0);
      gl.uniform3fv(L.uSunTo, sr.sunTo || [0, 0, 1]);
      const [ca, cb, n] = capArrays(st.caps);
      gl.uniform4fv(L.uCapA, ca); gl.uniform4fv(L.uCapB, cb); gl.uniform1i(L.uNCap, n);
    }
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** The stove and its pipe over the room (after _pass, same view and scissor). */
  _stovePass(st, { w, h, view, scissor = null, expo = 1, tint = [1, 1, 1], scene = null }) {
    const gl = this.gl, L = this.sloc, sc = scene || this.scene, sr = sc && sc.stoveRoom;
    if (!st || !st.tex || !sc || !(sr || st.face)) return;   // a fireplace's front needs only the room's light
    gl.useProgram(this.sprog);
    gl.bindVertexArray(this.vao);
    gl.viewport(0, 0, w, h);
    if (scissor) { gl.enable(gl.SCISSOR_TEST); gl.scissor(scissor[0], scissor[1], scissor[2], scissor[3]); }
    else gl.disable(gl.SCISSOR_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(L.uCanvas, w, h);
    gl.uniform3f(L.uView, view.scale, view.ox, view.oy);
    gl.uniform4fv(L.uBBox, st.bbox);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, st.tex); gl.uniform1i(L.uCut, 0);
    gl.uniform1i(L.uFace, st.face ? 1 : 0);
    if (st.face) {   // a built-in fireplace's front, flat on the wall (stoves.js, placeFace)
      gl.uniformMatrix3fv(L.uFaceH, false, colMajor(st.face));
      gl.uniform2f(L.uImg, sc.width, sc.height);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, sc.irr.tex); gl.uniform1i(L.uIrr, 1);
      gl.uniform1i(L.uIrrMode, sc.irr.mode);
      gl.uniform2f(L.uIrrRange, sc.irr.range[0], sc.irr.range[1]);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, sc.fire || this.blank); gl.uniform1i(L.uFire, 2);
      gl.uniform1i(L.uUseFire, sc.fire ? 1 : 0);
      gl.uniform4fv(L.uGlass, st.glass || [0, 0, 0, 0]);
      gl.uniform1f(L.uStudio, st.studio);
      gl.uniform1f(L.uEmis, st.emis);
      gl.uniform1f(L.uEve, st.eve ? 1 : 0);
      gl.uniform1f(L.uFlick, Number.isFinite(this.flick) && sc.fire && !sc.noFire ? this.flick : 1);
      gl.uniform1f(L.uExpo, expo);
      gl.uniform3fv(L.uTint, tint);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.disable(gl.BLEND);
      return;
    }
    gl.uniform3f(L.uCutXf, st.s, st.tx, st.ty);
    gl.uniform2f(L.uCutSize, st.w, st.h);
    const ym = st.ymap || [st.ty, st.ty + st.s * st.h / 2, st.ty + st.s * st.h, 0, st.h / 2, st.h];   // without it: one scale, as before
    gl.uniform3f(L.uCutY, ym[0], ym[1], ym[2]);
    gl.uniform3f(L.uCutR, ym[3], ym[4], ym[5]);
    gl.uniform4fv(L.uGlass, st.glass || [0, 0, 0, 0]);
    gl.uniform4fv(L.uSpan, st.span);
    gl.uniform3fv(L.uEFront, st.light.front);
    gl.uniform3fv(L.uESide, st.light.side);
    gl.uniform1fv(L.uProf, st.light.prof);
    gl.uniform1fv(L.uVProf, st.light.vprof);
    gl.uniform1f(L.uStudio, st.studio);
    gl.uniform1f(L.uEmis, st.emis);
    gl.uniform1f(L.uEve, st.eve ? 1 : 0);
    gl.uniform1f(L.uFlick, Number.isFinite(this.flick) && sc.fire && !sc.noFire ? this.flick : 1);
    gl.uniform1f(L.uExpo, expo);
    gl.uniform3fv(L.uTint, tint);
    gl.uniformMatrix3fv(L.uRay, false, colMajor(sr.ray));
    gl.uniform3fv(L.uCamC, sr.C);
    gl.uniform3fv(L.uCamFwd, sr.fwd);
    gl.uniform1f(L.uFpx, sr.f);
    const [ca, cb, n] = capArrays(st.caps);
    gl.uniform4fv(L.uCapA, ca); gl.uniform4fv(L.uCapB, cb); gl.uniform1i(L.uNCap, n);
    gl.uniform4fv(L.uThim, st.thimble || [0, 0, 0, 0]);
    gl.uniform1f(L.uPipeTop, st.pipeTop ?? -1e3);
    gl.uniform3fv(L.uLdir, st.ldir);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
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
    if (!cmp || cmp.mode === "off") { this._pass(look, common); this._stovePass(look.stove, common); return; }
    const sx = Math.round(cmp.split * w);
    // right side: current look; left side: "before" (no stone, same stove) or look B
    const R = { ...common, scissor: [sx, 0, w - sx, h] };
    this._pass(look, R); this._stovePass(look.stove, R);
    const left = cmp.mode === "before" ? { zones: {}, stove: look.stove } : cmp.lookB;
    const Lf = { ...common, sel: [], scissor: [0, 0, Math.max(0, sx), h], scene: cmp.mode === "before" ? null : cmp.sceneB || null };
    this._pass(left, Lf); this._stovePass(left.stove, Lf);
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
    const o = { w, h, view, expo: opts.expo ?? 1, tint: opts.tint || [1, 1, 1], relief: opts.relief ?? 1 };
    if (cmp && cmp.mode !== "off") {
      const sx = Math.round(cmp.split * w);
      const R = { ...o, scissor: [sx, 0, w - sx, h] }, Lf = { ...o, scissor: [0, 0, sx, h], scene: cmp.mode === "before" ? null : cmp.sceneB || null };
      this._pass(look, R); this._stovePass(look.stove, R);
      const left = cmp.mode === "before" ? { zones: {}, stove: look.stove } : cmp.lookB;
      this._pass(left, Lf); this._stovePass(left.stove, Lf);
    } else {
      this._pass(look, o); this._stovePass(look.stove, o);
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
