import {
  BOOT_OPERATOR,
  BOOT_NODE,
  BOOT_HANDOFF,
  COLD_BOOT_PHASE,
  COLD_BOOT_DIAG,
} from './config.js';

export function runColdBootSequence({ onComplete } = {}) {
  const bootScreen = document.getElementById('boot-screen');
  if (!bootScreen) {
    onComplete?.();
    return;
  }

  const log = document.getElementById('boot-screen-log');
  const operatorEl = document.getElementById('boot-screen-operator');
  const nodeEl = document.getElementById('boot-screen-node');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const phases = [
    'boot-screen--p1',
    'boot-screen--p2',
    'boot-screen--p3',
    'boot-screen--p4',
    'boot-screen--p5',
  ];
  let bootTimers = [];

  const clearBootTimers = () => {
    bootTimers.forEach((id) => window.clearTimeout(id));
    bootTimers = [];
  };

  const schedule = (fn, delay) => {
    bootTimers.push(window.setTimeout(fn, delay));
  };

  const setPhase = (index) => {
    phases.forEach((cls, i) => {
      bootScreen.classList.toggle(cls, i === index);
    });
  };

  const appendBootLine = (tag, status, { pending = false } = {}) => {
    if (!log) return;
    const line = document.createElement('div');
    line.className = 'boot-screen__line';
    const tagEl = document.createElement('span');
    tagEl.className = 'boot-screen__tag';
    tagEl.textContent = tag;
    const dots = document.createElement('span');
    dots.className = 'boot-screen__dots';
    dots.textContent = '................';
    const statusEl = document.createElement('span');
    statusEl.className = pending
      ? 'boot-screen__status boot-screen__status--pending'
      : 'boot-screen__status';
    statusEl.textContent = status;
    line.append(tagEl, dots, statusEl);
    log.appendChild(line);
    window.requestAnimationFrame(() => line.classList.add('boot-screen__line--in'));
    return statusEl;
  };

  const resolveBootLine = (statusEl, status) => {
    if (!statusEl) return;
    statusEl.textContent = status;
    statusEl.classList.remove('boot-screen__status--pending');
  };

  const typeResolve = (el, text, charMs, done) => {
    if (!el) {
      done?.();
      return;
    }
    el.classList.add('boot-screen__id-val--resolve');
    let i = 0;
    const tick = () => {
      const partial = text.slice(0, i);
      el.textContent = i < text.length ? `${partial}▮` : text;
      i += 1;
      if (i <= text.length) {
        schedule(tick, charMs);
      } else {
        done?.();
      }
    };
    tick();
  };

  const finishBoot = () => {
    clearBootTimers();
    const terminal = document.getElementById('portfolio-terminal');
    const handoffTotal = BOOT_HANDOFF.revealDelay + BOOT_HANDOFF.crossfade;

    bootScreen.classList.remove(...phases);
    bootScreen.classList.add('boot-screen--handoff');

    schedule(() => {
      document.body.classList.remove('boot-screen-active');
      document.body.classList.add('boot-screen-handoff');
      terminal?.classList.add('terminal--boot-reveal');
      onComplete?.();
    }, BOOT_HANDOFF.revealDelay);

    schedule(() => {
      bootScreen.classList.add('boot-screen--exit');
    }, BOOT_HANDOFF.dissolve);

    schedule(() => {
      document.body.classList.remove('boot-screen-handoff');
      terminal?.classList.remove('terminal--boot-reveal');
      bootScreen.setAttribute('aria-hidden', 'true');
      bootScreen.remove();
    }, handoffTotal);
  };

  const runReduced = () => {
    setPhase(4);
    appendBootLine('SIGNAL', 'STABLE');
    appendBootLine('SYNC', 'LOCKED');
    appendBootLine('SCAN', 'ALIGNED');
    COLD_BOOT_DIAG.forEach(({ tag, status }) => appendBootLine(tag, status));
    if (operatorEl) operatorEl.textContent = BOOT_OPERATOR;
    if (nodeEl) nodeEl.textContent = BOOT_NODE;
    schedule(finishBoot, 80);
  };

  if (reduced) {
    runReduced();
    return;
  }

  let t = 0;

  schedule(() => {
    const pending = appendBootLine('SIGNAL', 'ACQ...', { pending: true });
    schedule(() => resolveBootLine(pending, 'STABLE'), COLD_BOOT_PHASE.signal - 180);
  }, t);
  t += COLD_BOOT_PHASE.signal;

  schedule(() => {
    setPhase(1);
    const pending = appendBootLine('SYNC', 'HUNT', { pending: true });
    schedule(() => resolveBootLine(pending, 'LOCKED'), COLD_BOOT_PHASE.sync - 200);
  }, t);
  t += COLD_BOOT_PHASE.sync;

  schedule(() => {
    setPhase(2);
    const pending = appendBootLine('SCAN', 'DRIFT', { pending: true });
    schedule(() => resolveBootLine(pending, 'ALIGNED'), COLD_BOOT_PHASE.scan - 180);
  }, t);
  t += COLD_BOOT_PHASE.scan;

  schedule(() => {
    setPhase(3);
    COLD_BOOT_DIAG.forEach(({ tag, status }, index) => {
      schedule(() => appendBootLine(tag, status), index * COLD_BOOT_PHASE.diagGap);
    });
  }, t);
  t += COLD_BOOT_DIAG.length * COLD_BOOT_PHASE.diagGap + 120;

  schedule(() => {
    setPhase(4);
    typeResolve(operatorEl, BOOT_OPERATOR, COLD_BOOT_PHASE.charMs, () => {
      schedule(() => {
        typeResolve(nodeEl, BOOT_NODE, COLD_BOOT_PHASE.charMs, () => {
          schedule(finishBoot, COLD_BOOT_PHASE.hold);
        });
      }, COLD_BOOT_PHASE.identityDelay);
    });
  }, t);
}
