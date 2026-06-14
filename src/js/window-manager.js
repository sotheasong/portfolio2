import { WIN_TILT } from './config.js';
import { WIN_CRT_STACK_HTML } from './win-crt-template.js';

const LERP = 0.11;       // inertia factor (lower = more lag)
const SETTLE_PX = 0.25;  // stop lerp loop below this delta
const CHROME_H = 32;     // px — minimum visible chrome when dragging to bottom
const STACK_OFFSET = 30; // initial stagger per window

const LOG_ENTRIES = [
  'SYS INIT', 'MEM 87%', 'CLK SYNC', 'RENDER', 'BUF ↑',
  'IO WAIT',  'SIG OK',  'PROC ↑',   'FS READ', 'NET OK',
  'HEAP OK',  'THR 04',  'IRQ ACK',  'MEM 89%', 'CLK OK',
];

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function randBetween(lo, hi) { return lo + Math.random() * (hi - lo); }

/* ── FloatWindow ───────────────────────────────────────────────────── */

class FloatWindow {
  constructor({ id, title, buildContent, layer, zIndex, onFocus, onClose, stackIndex }) {
    this.id = id;
    this.layer = layer;
    this.onFocus = onFocus;
    this.onClose = onClose;

    this.w = 480;
    this.h = 360;
    this.minW = 280;
    this.minH = 200;

    this.x = Math.max(0, (window.innerWidth  - this.w) / 2 + stackIndex * STACK_OFFSET);
    this.y = Math.max(0, (window.innerHeight - this.h) / 2 + stackIndex * STACK_OFFSET);
    this.tx = this.x;
    this.ty = this.y;

    this._rafId = null;
    this._dragging = false;
    this._dragOx = 0;
    this._dragOy = 0;
    this._telemInterval = null;
    this._sigBase = randBetween(78, 96);

    this.el = this._build(title, buildContent, zIndex);
    this.el.style.setProperty('--win-tilt-x', `${WIN_TILT.baseX}deg`);
    this.el.style.setProperty('--win-tilt-y', '0deg');
    this._applyPos();
    this._bindChrome();
    this._bindResize();
    this._bindFocus();
    this._startTelemetry();

    layer.appendChild(this.el);

    // Enter animation — clear after so it doesn't block later state changes
    this.el.classList.add('win--entering');
    this.el.addEventListener('animationend', () => {
      this.el.classList.remove('win--entering');
    }, { once: true });
  }

  /* ── DOM builder ─────────────────────────────────────────── */

  _build(title, buildContent, zIndex) {
    const el = document.createElement('div');
    el.className = 'win win--focused';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.style.zIndex = zIndex;
    el.style.width  = `${this.w}px`;
    el.style.height = `${this.h}px`;

    // Logstrip content — duplicated for seamless marquee loop
    const logSpans = [...LOG_ENTRIES, ...LOG_ENTRIES]
      .map((e) => `<span>${e}</span>`)
      .join('<span class="win__log-sep">·</span>');

    el.innerHTML = `
      <div class="win__surface">
        <div class="win__chrome">
          <div class="win__drag">
            <span class="win__tag" aria-hidden="true">WIN</span>
            <span class="win__title">${title}</span>
          </div>
          <div class="win__telemetry" aria-hidden="true">
            <span class="win__telem-dot win__telem-dot--a"></span>
            <span class="win__telem-val">SIG --</span>
            <span class="win__telem-cursor">▌</span>
            <span class="win__telem-dot win__telem-dot--b"></span>
          </div>
        </div>
        <div class="win__logstrip" aria-hidden="true">
          <div class="win__logstrip-inner">${logSpans}</div>
        </div>
        <div class="win__body">
          <div class="win__content"></div>
        </div>
      </div>
      ${WIN_CRT_STACK_HTML}
      <div class="win__resize win__resize--s"  data-dir="s"></div>
      <div class="win__resize win__resize--e"  data-dir="e"></div>
      <div class="win__resize win__resize--se" data-dir="se"></div>
    `;

    el.querySelector('.win__content').appendChild(buildContent());

    return el;
  }

  /* ── Telemetry drift ─────────────────────────────────────── */

  _telemTick() {
    const valEl = this.el.querySelector('.win__telem-val');
    if (!valEl) return;
    this._sigBase += (Math.random() - 0.47) * 3.2;
    this._sigBase = clamp(this._sigBase, 68, 99);
    valEl.textContent = `SIG ${Math.round(this._sigBase)}`;
  }

  _startTelemetry() {
    this._telemTick();
    this._scheduleTelemetry();
  }

  _scheduleTelemetry() {
    if (this._telemInterval) return;
    this._telemInterval = setInterval(
      () => this._telemTick(),
      randBetween(2200, 3800)
    );
  }

  _pauseTelemetry() {
    if (!this._telemInterval) return;
    clearInterval(this._telemInterval);
    this._telemInterval = null;
  }

  /* ── Position — pure translate, no 3D distortion ─────────── */

  _applyPos() {
    this.el.dataset.posX = String(this.x);
    this.el.dataset.posY = String(this.y);
    const tiltX = this.el.style.getPropertyValue('--win-tilt-x') || `${WIN_TILT.baseX}deg`;
    const tiltY = this.el.style.getPropertyValue('--win-tilt-y') || '0deg';
    this.el.style.transform =
      `translate3d(${this.x}px, ${this.y}px, 0) rotateX(${tiltX}) rotateY(${tiltY})`;
  }

  /* ── Drag ────────────────────────────────────────────────── */

  _bindChrome() {
    const chrome = this.el.querySelector('.win__chrome');
    chrome.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      this.onFocus?.();
      this._startDrag(e);
    });
  }

  _startDrag(e) {
    this._dragOx = e.clientX - this.x;
    this._dragOy = e.clientY - this.y;
    this._dragging = true;
    this.el.classList.add('win--dragging');

    const onMove = (ev) => {
      this.tx = clamp(ev.clientX - this._dragOx, 0, window.innerWidth  - this.w);
      this.ty = clamp(ev.clientY - this._dragOy, 0, window.innerHeight - CHROME_H);
    };
    const onUp = () => {
      this._dragging = false;
      this.el.classList.remove('win--dragging');
      this.el.classList.add('win--settling');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseup',   onUp);
    this._startRaf();
  }

  _startRaf() {
    if (this._rafId) return;
    const tick = () => {
      this.x = lerp(this.x, this.tx, LERP);
      this.y = lerp(this.y, this.ty, LERP);

      this._applyPos();

      const done = !this._dragging
        && Math.abs(this.tx - this.x) < SETTLE_PX
        && Math.abs(this.ty - this.y) < SETTLE_PX;

      if (done) {
        this.x = this.tx;
        this.y = this.ty;
        this._applyPos();
        this.el.classList.remove('win--settling');
        this._rafId = null;
        return;
      }
      this._rafId = requestAnimationFrame(tick);
    };
    this._rafId = requestAnimationFrame(tick);
  }

  /* ── Resize ──────────────────────────────────────────────── */

  _bindResize() {
    this.el.querySelectorAll('.win__resize').forEach((handle) => {
      handle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        this.onFocus?.();
        this._startResize(e, handle.dataset.dir);
      });
    });
  }

  _startResize(e, dir) {
    const sx = e.clientX, sy = e.clientY;
    const sw = this.w,    sh = this.h;
    this.el.classList.add('win--resizing');

    const onMove = (ev) => {
      const dx = ev.clientX - sx;
      const dy = ev.clientY - sy;
      if (dir === 'e' || dir === 'se') this.w = Math.max(this.minW, sw + dx);
      if (dir === 's' || dir === 'se') this.h = Math.max(this.minH, sh + dy);
      this.el.style.width  = `${this.w}px`;
      this.el.style.height = `${this.h}px`;
    };
    const onUp = () => {
      this.el.classList.remove('win--resizing');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup',   onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup',   onUp);
  }

  /* ── Focus / blur ────────────────────────────────────────── */

  _bindFocus() {
    this.el.addEventListener('mousedown', () => this.onFocus?.());
  }

  focus(z) {
    this.el.style.zIndex = z;
    this.el.classList.add('win--focused');
    this.el.classList.remove('win--inactive');
    this._scheduleTelemetry();
  }

  blur() {
    if (this.el.classList.contains('win--closing')) return;
    this.el.classList.remove('win--focused');
    this.el.classList.add('win--inactive');
    this._pauseTelemetry();
    this.el.style.setProperty('--win-tilt-x', `${WIN_TILT.baseX}deg`);
    this.el.style.setProperty('--win-tilt-y', '0deg');
    this._applyPos();
  }

  /* ── Destroy ─────────────────────────────────────────────── */

  _destroy() {
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
    if (this._telemInterval) { clearInterval(this._telemInterval); this._telemInterval = null; }
    this.el.classList.add('win--closing');
    const cleanup = () => { this.el.remove(); this.onClose?.(this.id); };
    this.el.addEventListener('animationend', cleanup, { once: true });
    setTimeout(cleanup, 450);
  }
}

/* ── WindowManager ─────────────────────────────────────────────────── */

export class WindowManager {
  constructor(layerId, { onChange } = {}) {
    this.layer = document.getElementById(layerId);
    this.wins = new Map();
    this._z = 100;
    this._focusedId = null;
    this.onChange = onChange;
    this._bindClickAway();
  }

  _bindClickAway() {
    document.addEventListener(
      'mousedown',
      (event) => {
        if (!this.wins.size) return;
        if (event.target.closest?.('.win')) return;
        this.defocusAll();
      },
      true
    );
  }

  /** Click outside any window — all windows go inactive. */
  defocusAll() {
    if (!this._focusedId) return;
    this._focusedId = null;
    this.wins.forEach((win) => win.blur());
  }

  _emitChange() {
    this.onChange?.(this.wins.size > 0);
  }

  open(id, { title, buildContent }) {
    if (!this.layer) return;
    if (this.wins.has(id)) {
      this._focus(id);
      return;
    }
    const win = new FloatWindow({
      id, title, buildContent,
      layer: this.layer,
      zIndex: ++this._z,
      onFocus:  () => this._focus(id),
      onClose:  (wid) => {
        this.wins.delete(wid);
        if (this._focusedId === wid) this._focusedId = this._topId();
        this._emitChange();
      },
      stackIndex: this.wins.size,
    });
    this.wins.set(id, win);
    this._focus(id);
    this._emitChange();
  }

  _focus(id) {
    this._focusedId = id;
    this._z++;
    this.wins.forEach((win, wid) => {
      if (wid === id) win.focus(this._z);
      else win.blur();
    });
  }

  _topId() {
    let topId = null;
    let topZ = -1;
    this.wins.forEach((win, wid) => {
      const z = Number.parseInt(win.el.style.zIndex, 10) || 0;
      if (z >= topZ) {
        topZ = z;
        topId = wid;
      }
    });
    return topId;
  }

  /** Close focused window; returns true if one was closed. */
  closeFocused() {
    if (this.wins.size === 0) return false;
    const id = this._focusedId ?? this._topId();
    const win = id ? this.wins.get(id) : null;
    if (!win) return false;
    win._destroy();
    return true;
  }

  closeAll() {
    if (this.wins.size === 0) return;
    this.wins.forEach((win) => win._destroy());
    this.wins.clear();
    this._focusedId = null;
    this._emitChange();
  }
}
