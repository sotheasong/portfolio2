precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform vec4 u_ripple[16];
uniform vec4 u_trail[12];

/* Cursor disk — circular influence around the pointer (distance `r` is aspect-correct).
 * Increase INNER_SOFT → softer onset away from the exact cursor tip.
 * Move OUTER_START / OUTER_END farther out → bigger circle before it fades to zero.
 */
const float CURSOR_INNER_SOFT = 0.06;
const float CURSOR_OUTER_START = 0.22;
const float CURSOR_OUTER_END = 0.52;
const float CURSOR_RADIAL_BASE = 0.11;
const float CURSOR_RADIAL_RIPPLE = 0.038;
const float CURSOR_RADIAL_FINE = 0.018;
const float CURSOR_RADIAL_MIN = 0.064;
const float CURSOR_RIPPLE_FREQ = 22.0;
const float CURSOR_RIPPLE_SPEED = 4.2;
const float CURSOR_FINE_FREQ = 31.0;
const float CURSOR_FINE_SPEED = 5.1;
const float CURSOR_SWIRL = 0.032;

/* Click ripples — expanding rings from tap points (tweak here).
 * Radial term uses a 0..1 waveform so displacement never pulls inward (no pinch).
 * Higher WAVE_FREQ → tighter rings. Higher WAVE_SPEED → faster outward motion.
 */
const float CLICK_WAVE_FREQ = 18.0;
const float CLICK_WAVE_SPEED = 2.8;
const float CLICK_TIME_DECAY = 0.45;
const float CLICK_DIST_DECAY = 1.2;
const float CLICK_RADIAL_STRENGTH = 0.08;
const float CLICK_TANGENT_STRENGTH = 0.014;
const float CLICK_PEAK_SHARPNESS = 1.35;

/* CRT — scanlines, RGB shadow mask, temporal phosphor / RF noise */
const float CRT_LINE_PERIOD_PX = 2.45;
const float CRT_SCAN_MIN = 0.74;
const float CRT_TRIAD_WIDTH = 2.15;
const float CRT_MASK_ROW_HEIGHT = 1.0;
const float CRT_MASK_STAGGER = 1.07;
const vec3 CRT_MASK_HI = vec3(1.032, 1.024, 1.028);
const vec3 CRT_MASK_LO = vec3(0.965, 0.972, 0.968);
const float CRT_PHOSPHOR_GRID = 4.2;
const float CRT_PHOSPHOR_TICK_HZ = 14.0;
const float CRT_PHOSPHOR_NOISE = 0.028;
const float CRT_POWER_HUM = 0.009;
/* Curved glass + bezel: countertop edge roll + barrel (curvedScreenUv), rim, chroma */
const float CRT_BARREL_STRENGTH = 0.055;
const float CRT_EDGE_DARKEN = 0.52;
const float CRT_EDGE_START = 0.40;
const float CRT_EDGE_END = 1.02;
/* Countertop roll: pull samples toward center near borders — simulates glass bending down */
const float GLASS_EDGE_ROLL_WIDTH = 0.24;
const float GLASS_EDGE_ROLL_POWER = 2.15;
const float GLASS_EDGE_ROLL_STRENGTH = 0.105;
const float GLASS_EDGE_CORNER_BOOST = 0.42;
const float GLASS_EDGE_BOTTOM_BIAS = 0.62;
/* Fresnel-style highlight on curved glass */
const float GLASS_RIM_IN = 0.30;
const float GLASS_RIM_PEAK = 0.52;
const float GLASS_RIM_OUT = 0.82;
const float GLASS_RIM_INTENSITY = 0.088;
const float GLASS_SWEEP = 7.5;
const float GLASS_SWEEP_TIME = 1.05;
/* Subtle R/B separation at periphery */
const float GLASS_CHRO_BEGIN = 0.34;
const float GLASS_CHRO_END = 0.94;
const float GLASS_CHRO_STRENGTH = 0.042;

const float TRAIL_DECAY = 1.45;
const float TRAIL_SIGMA = 0.09;
const float TRAIL_STRENGTH = 0.048;

float psrdnoise(vec2 x, vec2 period, float alpha, out vec2 gradient) {
  vec2 uv = vec2(x.x + x.y * 0.5, x.y);
  vec2 i0 = floor(uv), f0 = fract(uv);
  float cmp = step(f0.y, f0.x);
  vec2 o1 = vec2(cmp, 1.0 - cmp);
  vec2 i1 = i0 + o1, i2 = i0 + 1.0;
  vec2 v0 = vec2(i0.x - i0.y * 0.5, i0.y);
  vec2 v1 = vec2(v0.x + o1.x - o1.y * 0.5, v0.y + o1.y);
  vec2 v2 = vec2(v0.x + 0.5, v0.y + 1.0);
  vec2 x0 = x - v0, x1 = x - v1, x2 = x - v2;

  vec3 iu, iv, xw, yw;
  if (any(greaterThan(period, vec2(0.0)))) {
    xw = vec3(v0.x, v1.x, v2.x);
    yw = vec3(v0.y, v1.y, v2.y);
    if (period.x > 0.0) xw = mod(xw, period.x);
    if (period.y > 0.0) yw = mod(yw, period.y);
    iu = floor(xw + 0.5 * yw + 0.5);
    iv = floor(yw + 0.5);
  } else {
    iu = vec3(i0.x, i1.x, i2.x);
    iv = vec3(i0.y, i1.y, i2.y);
  }

  vec3 hash = mod(iu, 289.0);
  hash = mod((hash * 51.0 + 2.0) * hash + iv, 289.0);
  hash = mod((hash * 34.0 + 10.0) * hash, 289.0);
  vec3 psi = hash * 0.07482 + alpha;
  vec3 gx = cos(psi), gy = sin(psi);
  vec2 g0 = vec2(gx.x, gy.x);
  vec2 g1 = vec2(gx.y, gy.y);
  vec2 g2 = vec2(gx.z, gy.z);

  vec3 w = 0.8 - vec3(dot(x0, x0), dot(x1, x1), dot(x2, x2));
  w = max(w, 0.0);
  vec3 w2 = w * w, w4 = w2 * w2;
  vec3 gdotx = vec3(dot(g0, x0), dot(g1, x1), dot(g2, x2));
  float n = dot(w4, gdotx);

  vec3 w3 = w2 * w;
  vec3 dw = -8.0 * w3 * gdotx;
  vec2 dn0 = w4.x * g0 + dw.x * x0;
  vec2 dn1 = w4.y * g1 + dw.y * x1;
  vec2 dn2 = w4.z * g2 + dw.z * x2;
  gradient = 10.9 * (dn0 + dn1 + dn2);
  return 10.9 * n;
}

float random(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 trailDisplacement(vec2 q, float aspect, float t) {
  vec2 sum = vec2(0.0);
  for (int i = 0; i < 12; i++) {
    vec4 tr = u_trail[i];
    if (tr.w < 0.5) continue;

    vec2 c = vec2(tr.x * aspect, tr.y);
    vec2 delta = q - c;
    float r = length(delta);
    vec2 radial = r > 1e-4 ? delta / r : vec2(0.0);

    float age = t - tr.z;
    if (age < 0.0) continue;

    float sig2 = TRAIL_SIGMA * TRAIL_SIGMA;
    float g = exp(-r * r / sig2) * exp(-age * TRAIL_DECAY);
    float wob = sin(r * 13.5 - age * 3.0);
    sum += radial * (TRAIL_STRENGTH * g * (0.55 + 0.45 * wob));
  }
  return sum;
}

/* Barrel distortion in aspect-correct space (overall faceplate). */
vec2 curvedScreenUv(vec2 uv, float aspect) {
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0);
  float r2 = dot(p, p);
  p *= 1.0 + CRT_BARREL_STRENGTH * r2;
  uv = p / vec2(aspect, 1.0) + 0.5;
  return clamp(uv, 0.0, 1.0);
}

/* Glass countertop edge: warps UV inward near the frame like a rolled/“waterfall” lip. */
vec2 glassCountertopEdgeUv(vec2 uv, float aspect) {
  vec2 a = vec2(uv.x * aspect, uv.y);
  float cx = min(a.x, aspect - a.x);
  float cy = min(a.y, 1.0 - a.y);
  float ed = min(cx, cy);

  float w = max(GLASS_EDGE_ROLL_WIDTH, 1e-4);
  float t = 1.0 - clamp(ed / w, 0.0, 1.0);
  if (t < 1e-4) return uv;

  float roll = pow(t, GLASS_EDGE_ROLL_POWER);
  float cBoost = 1.0 + GLASS_EDGE_CORNER_BOOST * pow(1.0 - clamp(ed / w, 0.0, 1.0), 2.0);

  float bottomAU = a.y;
  float botW = smoothstep(w * 1.25, 0.0, bottomAU);
  roll *= 1.0 + GLASS_EDGE_BOTTOM_BIAS * botW;

  vec2 center = vec2(aspect * 0.5, 0.5);
  vec2 toC = center - a;
  float len = length(toC);
  vec2 dir = len > 1e-4 ? toC / len : vec2(0.0);
  a += dir * (GLASS_EDGE_ROLL_STRENGTH * roll * cBoost);

  return clamp(vec2(a.x / aspect, a.y), 0.0, 1.0);
}

vec3 crtDisplay(vec3 color, vec2 frag, float t) {
  float scanWave = cos(6.2831853 * frag.y / CRT_LINE_PERIOD_PX + t * 0.65);
  color *= mix(CRT_SCAN_MIN, 1.0, scanWave * 0.5 + 0.5);

  float row = floor(frag.y / CRT_MASK_ROW_HEIGHT);
  float stagger = mod(row, 2.0) * CRT_MASK_STAGGER;
  float sx = frag.x + stagger;
  float cell = mod(floor(sx / CRT_TRIAD_WIDTH), 3.0);
  vec3 mask =
    cell < 1.0 ? vec3(CRT_MASK_HI.x, CRT_MASK_LO.y, CRT_MASK_LO.z) :
    cell < 2.0 ? vec3(CRT_MASK_LO.x, CRT_MASK_HI.y, CRT_MASK_LO.z) :
                 vec3(CRT_MASK_LO.x, CRT_MASK_LO.y, CRT_MASK_HI.z);
  color *= mask;

  float tick = floor(t * CRT_PHOSPHOR_TICK_HZ);
  vec2 fq = frag * CRT_PHOSPHOR_GRID;
  vec3 phos = vec3(
    hash21(fq + vec2(2.17, 6.02) + vec2(tick * 1.03, tick * 0.91)),
    hash21(fq + vec2(9.11, 1.44) + vec2(tick * 0.97, tick * 1.05)),
    hash21(fq + vec2(4.53, 8.76) + vec2(tick * 1.07, tick * 0.99))
  );
  color += (phos - 0.5) * CRT_PHOSPHOR_NOISE;

  color *= 1.0 + CRT_POWER_HUM * sin(t * 11.3 + frag.y * 0.018);

  return color;
}

vec3 crtGlassEdge(vec3 color, vec2 frag, float t) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 pe = (frag / u_resolution.xy - 0.5) * vec2(aspect, 1.0);
  float ed = length(pe) * 1.08;

  float chrome = smoothstep(GLASS_CHRO_BEGIN, GLASS_CHRO_END, ed) * GLASS_CHRO_STRENGTH;
  color.r *= 1.0 + chrome * 0.62;
  color.b *= 1.0 - chrome * 0.38 + chrome * 0.08;
  color.g *= 1.0 + chrome * 0.18;

  float shade =
    1.0 -
    CRT_EDGE_DARKEN * smoothstep(CRT_EDGE_START, CRT_EDGE_END, ed);
  color *= shade;

  return color;
}

float mouseDistAspect(vec2 uv, vec2 pointer, float aspect) {
  vec2 q = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(pointer.x * aspect, pointer.y);
  return length(q - m);
}

vec2 pointerDisplacement(vec2 q, vec2 pointer, float aspect, float t) {
  vec2 m = vec2(pointer.x * aspect, pointer.y);
  vec2 d = q - m;
  float r = length(d);
  vec2 radial = r > 1e-4 ? d / r : vec2(0.0);
  vec2 tangent = vec2(-radial.y, radial.x);

  float inner = smoothstep(0.0, CURSOR_INNER_SOFT, r);
  float outer = 1.0 - smoothstep(CURSOR_OUTER_START, CURSOR_OUTER_END, r);
  float envelope = inner * outer;

  float swell = sin(r * CURSOR_RIPPLE_FREQ - t * CURSOR_RIPPLE_SPEED);
  float fine = sin(r * CURSOR_FINE_FREQ - t * CURSOR_FINE_SPEED);
  float radialPush =
    envelope *
    (CURSOR_RADIAL_BASE + CURSOR_RADIAL_RIPPLE * swell + CURSOR_RADIAL_FINE * fine);
  radialPush = max(radialPush, envelope * CURSOR_RADIAL_MIN);

  float swirl = envelope * CURSOR_SWIRL * sin(t * 2.4 + r * 16.0);
  return radial * radialPush + tangent * swirl;
}

vec2 mouseDisplacement(vec2 q, float aspect, float t) {
  return pointerDisplacement(q, u_mouse, aspect, t);
}

vec2 rippleDisplacementAt(vec2 q, vec2 centerNorm, float age, float aspect, float t) {
  if (age < 0.0) return vec2(0.0);

  vec2 c = vec2(centerNorm.x * aspect, centerNorm.y);
  vec2 delta = q - c;
  float r = length(delta);
  vec2 radial = r > 1e-4 ? delta / r : vec2(0.0);
  vec2 tangent = vec2(-radial.y, radial.x);

  float phase = r * CLICK_WAVE_FREQ - age * CLICK_WAVE_SPEED;
  float radialWave = pow(0.5 + 0.5 * sin(phase), CLICK_PEAK_SHARPNESS);

  float dampTime = exp(-age * CLICK_TIME_DECAY);
  float dampDist = exp(-r * CLICK_DIST_DECAY);
  float trailing = smoothstep(0.0, 0.12, age);
  float coreSoft = smoothstep(0.0, 0.05, r);

  float radialAmp =
    CLICK_RADIAL_STRENGTH * radialWave * dampTime * dampDist * trailing * coreSoft;

  float tangentAmp =
    CLICK_TANGENT_STRENGTH *
    sin(phase * 0.97 + 0.35) *
    dampTime *
    dampDist *
    trailing *
    coreSoft *
    radialWave;

  return radial * radialAmp + tangent * tangentAmp;
}

vec2 clickRippleDisplacement(vec2 q, float aspect, float t) {
  vec2 sum = vec2(0.0);
  for (int i = 0; i < 16; i++) {
    vec4 rip = u_ripple[i];
    if (rip.w < 0.5) continue;
    float age = t - rip.z;
    sum += rippleDisplacementAt(q, rip.xy, age, aspect, t);
  }
  return sum;
}

vec2 warpedUv(vec2 uv, float t) {
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 q = vec2(uv.x * aspect, uv.y);
  vec2 disp =
    mouseDisplacement(q, aspect, t) +
    clickRippleDisplacement(q, aspect, t) +
    trailDisplacement(q, aspect, t);
  q += disp;
  return vec2(q.x / aspect, q.y);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float aspect = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 uv = frag / u_resolution.xy;
  uv = glassCountertopEdgeUv(uv, aspect);
  uv = curvedScreenUv(uv, aspect);

  vec2 uvWarp = warpedUv(uv, u_time);

  float alpha = u_time * 0.38;
  vec2 p = 1.3 * (uvWarp - 0.5);
  vec2 g;

  float mouseDist = mouseDistAspect(uv, u_mouse, aspect);
  float ringBoost =
    0.85 *
    smoothstep(0.06, 0.32, mouseDist) *
    (1.0 - smoothstep(0.38, 0.68, mouseDist));
  float warpAmt =
    0.032 *
    (1.0 + ringBoost) *
    (1.0 + 0.28 * sin(u_time * 1.9 + mouseDist * 14.0));
  float warp = random(uvWarp + u_time * 0.08) * warpAmt;

  float n = 0.5 + 0.5 * psrdnoise(p - warp, vec2(0.0), alpha, g);

  vec3 darkBase  = vec3(0.07, 0.07, 0.08);
  vec3 midBase   = vec3(0.32, 0.32, 0.33);
  vec3 highBase  = vec3(0.62, 0.62, 0.64);

  vec3 color;
  if (n < 0.45) {
    color = mix(darkBase, midBase, smoothstep(0.0, 0.45, n));
  } else {
    color = mix(midBase, highBase, smoothstep(0.45, 1.0, n));
  }

  float vignette = 1.0 - smoothstep(0.3, 1.1, length(frag / u_resolution.xy - 0.5) * 1.6);
  color *= (0.72 + 0.28 * vignette);

  float tGrain = u_time * 24.0;
  float g1 = hash21(frag * 0.71 + floor(tGrain));
  float g2 = hash21(frag * 3.8 + floor(tGrain * 1.07));
  float g3 = hash21(frag.yy * 12.0 + frag.xx * 0.13 + tGrain);
  float grain = (g1 - 0.5) * 0.052 + (g2 - 0.5) * 0.038 + (g3 - 0.5) * 0.022;
  color += grain;

  color = crtDisplay(color, frag, u_time);
  color = crtGlassEdge(color, frag, u_time);

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
