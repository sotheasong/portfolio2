precision mediump float;

uniform float u_time;
uniform vec2 u_resolution;
uniform vec2 u_mouse;

// Up to 8 window influence zones: xy = normalized center, zw = normalized size
uniform vec4 u_windows[8];
uniform int u_windowCount;
uniform int u_activeWindow; // index of focused window (-1 = none)

// ----- Noise -----

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

// Returns 0.0 inside window core, 1.0 outside
float windowInfluence(vec2 uv, vec4 win) {
  vec2 center = win.xy;
  vec2 halfSize = win.zw * 0.5;
  // Soft rectangular falloff
  vec2 d = abs(uv - center) / (halfSize + 0.08);
  float box = max(d.x, d.y);
  return smoothstep(0.85, 1.35, box);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;

  float alpha = u_time * 0.38;
  vec2 p = 1.3 * (uv - 0.5);
  vec2 g;

  // Compute accumulated window suppression across all windows
  float suppression = 0.0;
  float stabilization = 0.0;
  for (int i = 0; i < 8; i++) {
    if (i >= u_windowCount) break;
    float infl = 1.0 - windowInfluence(uv, u_windows[i]);
    float isActive = (i == u_activeWindow) ? 1.0 : 0.0;
    // Active window suppresses noise more strongly
    suppression += infl * (0.07 + isActive * 0.05);
    stabilization += infl * (0.04 + isActive * 0.03);
  }
  suppression = clamp(suppression, 0.0, 0.18);
  stabilization = clamp(stabilization, 0.0, 0.12);

  // Warp offset — reduced under windows
  float warpAmt = 0.025 * (1.0 - stabilization * 6.0);
  float warp = random(uv + u_time * 0.08) * warpAmt;

  float n = 0.5 + 0.5 * psrdnoise(p - warp, vec2(0.0), alpha, g);

  // Darken and slightly compress noise range under windows (luminance suppression)
  n = n - suppression;
  n = clamp(n, 0.0, 1.0);

  // Map noise to monochrome — charcoal-to-silver range, avoid pure white
  vec3 darkBase  = vec3(0.07, 0.07, 0.08);
  vec3 midBase   = vec3(0.32, 0.32, 0.33);
  vec3 highBase  = vec3(0.62, 0.62, 0.64);

  vec3 color;
  if (n < 0.45) {
    color = mix(darkBase, midBase, smoothstep(0.0, 0.45, n));
  } else {
    color = mix(midBase, highBase, smoothstep(0.45, 1.0, n));
  }

  // Radial vignette
  float vignette = 1.0 - smoothstep(0.3, 1.1, length(uv - 0.5) * 1.6);
  color *= (0.72 + 0.28 * vignette);

  // Subtle temporal grain woven into field
  float grainSeed = random(gl_FragCoord.xy * 0.8 + floor(u_time * 18.0));
  color += (grainSeed - 0.5) * 0.028;

  gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
}
