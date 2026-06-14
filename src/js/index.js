import '../css/main.css';

import Three from './three.js';
import { runColdBootSequence } from './boot.js';
import { scheduleCrtGlitches } from './crt-glitches.js';
import { initTerminal } from './terminal.js';
import { TERM_TILT, WIN_TILT } from './config.js';

function setupTiltHandlers(terminal, crt, floatLayer) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const term = { ...TERM_TILT };
  const win = { ...WIN_TILT };

  const lockTerminalTilt = () => {
    if (!crt) return;
    crt.style.setProperty('--term-tilt-x', `${term.baseX}deg`);
    crt.style.setProperty('--term-tilt-y', '0deg');
  };

  const applyTerminalTilt = (event) => {
    if (!crt) return;
    const nx = (event.clientX / window.innerWidth - 0.5) * 2;
    const ny = (event.clientY / window.innerHeight - 0.5) * 2;
    crt.style.setProperty('--term-tilt-y', `${nx * term.maxYaw}deg`);
    crt.style.setProperty('--term-tilt-x', `${term.baseX - ny * term.maxPitch}deg`);
  };

  const lockWinTilt = (el) => {
    el.style.setProperty('--win-tilt-x', `${win.baseX}deg`);
    el.style.setProperty('--win-tilt-y', '0deg');
    const x = el.dataset.posX ?? '0';
    const y = el.dataset.posY ?? '0';
    el.style.transform =
      `translate3d(${x}px, ${y}px, 0) rotateX(${win.baseX}deg) rotateY(0deg)`;
  };

  const applyWinTilt = (el, event) => {
    const rect = el.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) return;

    const nx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    const ny = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    const tiltX = `${win.baseX - ny * win.maxPitch}deg`;
    const tiltY = `${nx * win.maxYaw}deg`;

    el.style.setProperty('--win-tilt-x', tiltX);
    el.style.setProperty('--win-tilt-y', tiltY);
    const x = el.dataset.posX ?? '0';
    const y = el.dataset.posY ?? '0';
    el.style.transform =
      `translate3d(${x}px, ${y}px, 0) rotateX(${tiltX}) rotateY(${tiltY})`;
  };

  let pending = false;
  let lastEvent = null;

  const tick = () => {
    pending = false;
    const event = lastEvent;
    if (!event) return;

    const termActive =
      terminal &&
      terminal.classList.contains('terminal--focused') &&
      !terminal.classList.contains('terminal--minimized') &&
      !terminal.classList.contains('terminal--dormant');

    if (termActive) applyTerminalTilt(event);
    else lockTerminalTilt();

    if (!floatLayer) return;
    const wins = floatLayer.querySelectorAll('.win:not(.win--closing)');
    if (!wins.length) return;

    wins.forEach((el) => {
      if (el.classList.contains('win--focused')) applyWinTilt(el, event);
      else lockWinTilt(el);
    });
  };

  window.addEventListener(
    'pointermove',
    (event) => {
      lastEvent = event;
      if (!pending) {
        pending = true;
        requestAnimationFrame(tick);
      }
    },
    { passive: true }
  );
}

window.addEventListener('load', () => {
  const canvas = document.querySelector('#canvas');
  if (!canvas) {
    console.error('Missing #canvas — animated background cannot start');
    return;
  }

  const terminal = document.getElementById('portfolio-terminal');
  const crt = document.querySelector('.terminal__crt');
  const floatLayer = document.getElementById('float-layer');

  let three = null;

  runColdBootSequence({
    onComplete: () => {
      three = new Three(canvas);
      three.syncUiPanels();
      scheduleCrtGlitches(crt, terminal, floatLayer);
    },
  });

  setupTiltHandlers(terminal, crt, floatLayer);
  initTerminal({
    terminal,
    crt,
    getThree: () => three,
  });
});
