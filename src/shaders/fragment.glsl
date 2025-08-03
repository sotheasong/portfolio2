precision mediump float;

uniform float u_time;
uniform vec3 u_resolution;
uniform sampler2D u_grainTexture;
uniform vec2 u_mouse;

// ----- Noise Function (psrdnoise) -----

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

// ----- Main Shader -----

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec2 uv = fragCoord.xy / u_resolution.xy;

  const float nscale = 1.3;
  const vec2 per = vec2(0.0);
  vec2 v = vec2(0.2, 0.0);
  float alpha = u_time * 0.5;

  vec2 p = nscale * (uv - 0.5);
  vec2 g;

  float angle = u_time/2.0;
  mat2 rot = mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
  vec2 rp = rot * (uv - 0.5) + 0.5;

  float warp = random(uv + u_time) * 0.03;
  float n = 0.5 + 0.5 * psrdnoise(p - warp, per, alpha, g);

  // float levels = 30.0;
  // float n = floor(rawNoise * levels) / (levels - 1.0);

  vec3 color1 = vec3(1.0, 1.0, 1.0);
  vec3 color2 = vec3(0.5, 0.5, 0.5);
  vec3 color3 = vec3(0.2, 0.2, 0.2);
  vec3 color;
  if (n < 0.5) {
      color = mix(color1, color2, smoothstep(0.0, 0.5, n));
  } else {
      color = mix(color2, color3, smoothstep(0.5, 1.0, n));
  }

  // Subtle grain effect
  float grainFreq = 0.02;
  float grainStrength = 0.0;
  float grain = random(gl_FragCoord.xy * grainFreq + u_time * 10.0);
  grain = (grain - 0.5) * grainStrength;
  color += grain;

  gl_FragColor = vec4(color, 1.0);
}
