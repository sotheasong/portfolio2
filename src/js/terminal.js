import {
  CLOSE_ANIM_MS,
  OPEN_ANIM_MS,
  OPEN_OVERLAP_MS,
  OPEN_PHASE,
  TERM_TILT,
} from './config.js';
import { runCommand } from './commands.js';
import { WindowManager } from './window-manager.js';

const INPUT_HINT = 'type help for commands';

export function initTerminal({ terminal, crt, getThree }) {
  const shell = document.querySelector('.terminal__shell');
  const screen = document.querySelector('.terminal__screen');
  const openBtn = document.getElementById('terminal-open');
  const workspace = document.getElementById('terminal-workspace');
  const output = document.getElementById('terminal-output');
  const pathNode = document.querySelector('.terminal__instr__node');
  const input = document.getElementById('terminal-input');
  const inputWrap = document.querySelector('.terminal__input-wrap');
  const blockCursor = document.getElementById('terminal-cursor');
  const inputRow = document.querySelector('.terminal__input-row');

  const isMinimized = () => terminal?.classList.contains('terminal--minimized');
  const isDormant = () => terminal?.classList.contains('terminal--dormant');
  const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let openPhaseTimers = [];
  let isAnimating = false;
  let cursorRaf = 0;
  let showInputHint = true;

  const scrollOutput = () => {
    if (output) output.scrollTop = output.scrollHeight;
  };

  const appendOutputLine = (text, className = 'terminal__history-line--out') => {
    if (!output || !text) return;
    const block = document.createElement('div');
    block.className = `terminal__history-line ${className}`;
    block.textContent = text;
    output.appendChild(block);
    scrollOutput();
  };

  const appendCommandLine = (line) => {
    if (!output || !line) return;
    const block = document.createElement('div');
    block.className = 'terminal__history-line terminal__history-line--cmd';
    block.textContent = `$ ${line}`;
    output.appendChild(block);
    scrollOutput();
  };

  const setPathNode = (label) => {
    if (!pathNode) return;
    pathNode.textContent = label ?? '~/portfolio';
  };

  const dismissInputHint = () => {
    if (!showInputHint || !input) return;
    showInputHint = false;
    input.classList.remove('terminal__input-line--hint');
    input.removeAttribute('data-placeholder');
  };

  const showInputHintIfNeeded = () => {
    if (!showInputHint || !input) return;
    input.classList.add('terminal__input-line--hint');
    input.setAttribute('data-placeholder', INPUT_HINT);
  };

  let winManager;

  const getCaretRect = (range) => {
    const rects = range.getClientRects();
    if (rects.length > 0) return rects[rects.length - 1];

    const inputRect = input.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;
    if (!input.textContent?.length) {
      return new DOMRect(inputRect.left, inputRect.top, 0, lineHeight);
    }

    const marker = document.createElement('span');
    marker.textContent = '\u200b';
    range.insertNode(marker);
    const rect = marker.getBoundingClientRect();
    marker.remove();
    return rect.width > 0 || rect.height > 0
      ? rect
      : new DOMRect(inputRect.left, inputRect.top, 0, lineHeight);
  };

  const lockTerminalTilt = () => {
    if (!crt) return;
    crt.style.setProperty('--term-tilt-x', `${TERM_TILT.baseX}deg`);
    crt.style.setProperty('--term-tilt-y', '0deg');
  };

  const focusTerminal = () => {
    if (!terminal || isMinimized() || isDormant()) return;
    terminal.classList.add('terminal--focused');
  };

  const defocusTerminal = () => {
    if (!terminal) return;
    terminal.classList.remove('terminal--focused');
    input?.blur();
    if (!isMinimized()) lockTerminalTilt();
    syncBlockCursor();
  };

  const syncBlockCursor = () => {
    cursorRaf = 0;
    if (!input || !blockCursor || !inputWrap) return;
    if (
      isMinimized() ||
      !terminal?.classList.contains('terminal--focused') ||
      document.activeElement !== input
    ) {
      blockCursor.classList.remove('terminal__cursor--visible');
      return;
    }

    const selection = window.getSelection();
    let range;

    if (selection && selection.rangeCount > 0 && input.contains(selection.anchorNode)) {
      range = selection.getRangeAt(0).cloneRange();
      range.collapse(true);
    } else {
      range = document.createRange();
      range.selectNodeContents(input);
      range.collapse(true);
    }

    const caretRect = getCaretRect(range);
    const wrapRect = inputWrap.getBoundingClientRect();
    const lineHeight = parseFloat(getComputedStyle(input).lineHeight) || 20;

    blockCursor.style.left = `${caretRect.left - wrapRect.left}px`;
    blockCursor.style.top = `${caretRect.top - wrapRect.top}px`;
    blockCursor.style.lineHeight =
      caretRect.height > 0 ? `${caretRect.height}px` : `${lineHeight}px`;
    blockCursor.classList.add('terminal__cursor--visible');
  };

  const scheduleBlockCursor = () => {
    if (cursorRaf) return;
    cursorRaf = window.requestAnimationFrame(syncBlockCursor);
  };

  const syncDormantState = (dormant) => {
    if (!terminal) return;
    terminal.classList.toggle('terminal--dormant', dormant);
    if (dormant) defocusTerminal();
    scheduleBlockCursor();
  };

  winManager = new WindowManager('float-layer', {
    onChange: (hasWindows) => syncDormantState(hasWindows),
  });

  const commandCtx = {
    appendOutput: (text) => appendOutputLine(text),
    openWindow: (id, opts) => winManager.open(id, opts),
  };

  const clearOpenPhaseTimers = () => {
    openPhaseTimers.forEach((id) => window.clearTimeout(id));
    openPhaseTimers = [];
  };

  const scheduleOpenPhase = (fn, delay) => {
    openPhaseTimers.push(window.setTimeout(fn, delay));
  };

  const startOpenSequence = () => {
    if (!terminal) return;
    clearOpenPhaseTimers();
    terminal.classList.remove(
      'terminal--opening-p1',
      'terminal--opening-p2',
      'terminal--opening-p3',
      'terminal--opening-p4'
    );
    terminal.classList.add('terminal--opening', 'terminal--opening-p1');

    const p2At = OPEN_PHASE.wake - OPEN_OVERLAP_MS;
    const p4At = p2At + OPEN_PHASE.expand - OPEN_OVERLAP_MS;

    scheduleOpenPhase(() => {
      terminal.classList.remove('terminal--opening-p1');
      terminal.classList.add('terminal--opening-p2');
      getThree?.()?.syncUiPanels();
    }, p2At);

    scheduleOpenPhase(() => {
      terminal.classList.remove('terminal--opening-p2');
      terminal.classList.add('terminal--opening-p4');
    }, p4At);

    scheduleOpenPhase(() => {
      applyExpandedState(true);
      finishExpand();
    }, OPEN_ANIM_MS);
  };

  const applyExpandedState = (expanded) => {
    if (!terminal) return;
    if (expanded) {
      terminal.classList.remove('terminal--minimized');
    } else {
      terminal.classList.add('terminal--minimized');
      winManager.closeAll();
    }
    openBtn?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    workspace?.setAttribute('aria-hidden', expanded ? 'false' : 'true');
    getThree?.()?.syncUiPanels();
    if (expanded) {
      crt?.style.setProperty('--term-tilt-x', `${TERM_TILT.baseX}deg`);
      crt?.style.setProperty('--term-tilt-y', '0deg');
    } else if (crt) {
      crt.style.removeProperty('--term-tilt-x');
      crt.style.removeProperty('--term-tilt-y');
    }
  };

  const finishExpand = () => {
    clearOpenPhaseTimers();
    terminal?.classList.remove(
      'terminal--opening',
      'terminal--opening-p1',
      'terminal--opening-p2',
      'terminal--opening-p3',
      'terminal--opening-p4'
    );
    isAnimating = false;
    window.requestAnimationFrame(() => {
      showInputHintIfNeeded();
      focusInput();
    });
  };

  const setExpanded = (expanded, { animate = true } = {}) => {
    if (!terminal) return;
    if (expanded) {
      if (animate && !prefersReducedMotion()) {
        startOpenSequence();
        return;
      }
      applyExpandedState(true);
      finishExpand();
      return;
    }

    clearOpenPhaseTimers();
    terminal.classList.remove(
      'terminal--opening',
      'terminal--opening-p1',
      'terminal--opening-p2',
      'terminal--opening-p3',
      'terminal--opening-p4',
      'terminal--closing'
    );
    defocusTerminal();
    applyExpandedState(false);
    isAnimating = false;
    syncBlockCursor();
  };

  const isColdBooting = () =>
    document.body.classList.contains('boot-screen-active') ||
    document.body.classList.contains('boot-screen-handoff');

  const expand = (event) => {
    event?.stopPropagation();
    if (!isMinimized() || isAnimating || isColdBooting()) return;
    isAnimating = true;
    setExpanded(true, { animate: !prefersReducedMotion() });
  };

  const minimize = () => {
    if (isMinimized() || isAnimating) return;
    defocusTerminal();
    if (prefersReducedMotion()) {
      setExpanded(false);
      return;
    }
    isAnimating = true;
    terminal.classList.add('terminal--closing');
    window.setTimeout(() => {
      applyExpandedState(false);
      terminal.classList.remove('terminal--closing');
      isAnimating = false;
      syncBlockCursor();
    }, CLOSE_ANIM_MS);
  };

  const focusInput = () => {
    if (isMinimized() || isDormant()) return;
    focusTerminal();
    input?.focus();
    scheduleBlockCursor();
  };

  const submitInputLine = () => {
    if (!input) return;
    const line = input.textContent?.replace(/\n/g, '').trim() ?? '';
    dismissInputHint();
    if (line) {
      appendCommandLine(line);
      runCommand(line, commandCtx);
    }
    input.textContent = '';
    focusInput();
  };

  openBtn?.addEventListener('click', expand);

  shell?.addEventListener('click', (event) => {
    if (!isMinimized() || isAnimating || isColdBooting()) return;
    expand(event);
  });

  window.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (isMinimized()) return;
    event.preventDefault();
    if (winManager.closeFocused()) return;
    minimize();
  });

  terminal?.addEventListener(
    'mousedown',
    (event) => {
      if (isMinimized() || isDormant() || isColdBooting()) return;
      if (event.button !== 0) return;
      focusInput();
    },
    true
  );

  document.addEventListener(
    'mousedown',
    (event) => {
      if (isMinimized() || isColdBooting()) return;
      if (event.target.closest?.('#portfolio-terminal')) return;
      if (event.target.closest?.('.win')) return;
      defocusTerminal();
    },
    true
  );

  screen?.addEventListener('mousedown', (event) => {
    if (isMinimized() || isDormant()) return;
    if (event.target.closest('.terminal__input-row')) return;
    event.preventDefault();
    focusInput();
  });

  inputRow?.addEventListener('mousedown', () => {
    if (isMinimized()) return;
    window.requestAnimationFrame(focusInput);
  });

  input?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitInputLine();
      return;
    }
    if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
      dismissInputHint();
    }
    scheduleBlockCursor();
  });

  input?.addEventListener('keyup', scheduleBlockCursor);
  input?.addEventListener('click', scheduleBlockCursor);
  input?.addEventListener('focus', () => {
    focusTerminal();
    scheduleBlockCursor();
  });
  input?.addEventListener('blur', () => {
    const selection = window.getSelection();
    if (selection && input.contains(selection.anchorNode)) {
      selection.removeAllRanges();
    }
    syncBlockCursor();
  });

  input?.addEventListener('paste', (event) => {
    event.preventDefault();
    dismissInputHint();
    const text = event.clipboardData?.getData('text/plain').replace(/\r?\n/g, '') ?? '';
    document.execCommand('insertText', false, text);
    scheduleBlockCursor();
  });

  input?.addEventListener('input', () => {
    if (input.textContent?.includes('\n')) {
      input.textContent = input.textContent.replace(/\n/g, '');
    }
    if (!input.textContent?.length && input.innerHTML !== '') {
      input.innerHTML = '';
    }
    if (input.textContent?.length) dismissInputHint();
    scheduleBlockCursor();
  });

  document.addEventListener('selectionchange', () => {
    if (document.activeElement === input) scheduleBlockCursor();
  });

  window.addEventListener('resize', scheduleBlockCursor);

  syncBlockCursor();
}
