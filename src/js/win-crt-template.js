/** Full CRT overlay + bezel stack (mirrors main terminal). */
export const WIN_CRT_STACK_HTML = `
  <div class="win__crt-fx" aria-hidden="true">
    <div class="win__crt-fx__glass" aria-hidden="true"></div>
    <div class="win__crt-fx__jitter">
      <div class="win__crt-fx__scanlines"></div>
      <div class="win__crt-fx__bloom">
        <div class="win__crt-fx__diffuse win__crt-fx__diffuse--h"></div>
        <div class="win__crt-fx__diffuse win__crt-fx__diffuse--v"></div>
        <div class="win__crt-fx__diffuse win__crt-fx__diffuse--accent"></div>
      </div>
      <div class="win__crt-fx__phosphor"></div>
      <div class="win__crt-fx__vignette"></div>
      <div class="win__crt-fx__curvature"></div>
      <div class="win__crt-fx__flicker"></div>
      <div class="win__crt-fx__noise"></div>
      <div class="win__crt-fx__roll"></div>
      <div class="win__crt-fx__chroma"></div>
      <div class="win__crt-fx__glitchbars"></div>
    </div>
  </div>
  <div class="win__bezel" aria-hidden="true">
    <div class="win__bezel__vignette"></div>
    <div class="win__bezel__pressure"></div>
    <div class="win__bezel__thickness"></div>
    <div class="win__bezel__rim"></div>
  </div>
`;
