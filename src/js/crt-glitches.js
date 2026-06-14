export function scheduleCrtGlitches(crtEl, terminalEl, floatLayerEl) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const nextDelay = () => 9000 + Math.random() * 11000;
  const burstMs = () => 90 + Math.random() * 70;

  const isOpening = () =>
    document.body.classList.contains('boot-screen-active') ||
    document.body.classList.contains('boot-screen-handoff') ||
    terminalEl?.classList.contains('terminal--opening') ||
    terminalEl?.classList.contains('terminal--opening-p1') ||
    terminalEl?.classList.contains('terminal--opening-p2') ||
    terminalEl?.classList.contains('terminal--opening-p3') ||
    terminalEl?.classList.contains('terminal--opening-p4');

  const isDormant = () => terminalEl?.classList.contains('terminal--dormant');

  const isTerminalActive = () =>
    terminalEl?.classList.contains('terminal--focused') && !isDormant();

  const getOpenWins = () =>
    [...(floatLayerEl?.querySelectorAll('.win:not(.win--closing)') ?? [])];

  const pickTarget = () => {
    const wins = getOpenWins();
    if (wins.length && (isDormant() || Math.random() < 0.5)) {
      return { el: wins[Math.floor(Math.random() * wins.length)], cls: 'win--glitch' };
    }
    if (isTerminalActive() && crtEl) {
      return { el: crtEl, cls: 'terminal__crt--glitch' };
    }
    if (wins.length) {
      return { el: wins[Math.floor(Math.random() * wins.length)], cls: 'win--glitch' };
    }
    return null;
  };

  const runBurst = () => {
    if (isOpening()) {
      window.setTimeout(runBurst, 400);
      return;
    }

    const target = pickTarget();
    if (!target) {
      window.setTimeout(runBurst, nextDelay());
      return;
    }

    target.el.classList.add(target.cls);
    window.setTimeout(() => {
      target.el.classList.remove(target.cls);
      window.setTimeout(runBurst, nextDelay());
    }, burstMs());
  };

  window.setTimeout(runBurst, 3500 + Math.random() * 4000);
}
