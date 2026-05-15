// Retro-futuristic OS window manager
// Manages draggable system modules, boot sequence, and signal field integration

let threeInstance = null;
let windows = []; // { el, id, cx, cy, w, h, active }
let activeIndex = -1;
let dragState = null; // { win, startX, startY, startLeft, startTop }
let isDragging = false;

const SESSION_ID = Math.random().toString(36).slice(2, 8).toUpperCase();
const BOOT_TIME = new Date().toISOString().replace('T', ' ').slice(0, 19);

export function initWindowManager(three) {
  threeInstance = three;
}

function updateSignalField() {
  if (!threeInstance) return;
  const mapped = windows.map((w) => ({
    cx: w.cx,
    cy: w.cy,
    w: w.w,
    h: w.h
  }));
  threeInstance.updateWindows(mapped, activeIndex);
}

function measureWindow(win) {
  const rect = win.el.getBoundingClientRect();
  win.cx = rect.left + rect.width / 2;
  win.cy = rect.top + rect.height / 2;
  win.w = rect.width;
  win.h = rect.height;
}

function setActive(index) {
  if (activeIndex === index) return;
  activeIndex = index;
  windows.forEach((w, i) => {
    w.el.classList.toggle('sys-window--active', i === index);
    w.el.classList.toggle('sys-window--inactive', i !== index);
  });
  // Raise active window z-index
  windows.forEach((w, i) => {
    w.el.style.zIndex = i === index ? 120 : 100 + i;
  });
  updateSignalField();
}

function makeWindowDraggable(win, index) {
  const titlebar = win.el.querySelector('.sys-titlebar');
  if (!titlebar) return;

  titlebar.addEventListener('mousedown', (e) => {
    e.preventDefault();
    setActive(index);

    const rect = win.el.getBoundingClientRect();
    dragState = {
      win,
      startX: e.clientX,
      startY: e.clientY,
      startLeft: rect.left,
      startTop: rect.top
    };
    isDragging = false;
    win.el.classList.add('sys-window--dragging');
  });

  win.el.addEventListener('mousedown', () => setActive(index));
}

function onMouseMove(e) {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if (!isDragging && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) isDragging = true;
  if (!isDragging) return;

  const newLeft = dragState.startLeft + dx;
  const newTop = dragState.startTop + dy;
  dragState.win.el.style.left = newLeft + 'px';
  dragState.win.el.style.top = newTop + 'px';
  measureWindow(dragState.win);
  updateSignalField();
}

function onMouseUp() {
  if (dragState) {
    dragState.win.el.classList.remove('sys-window--dragging');
    dragState = null;
    isDragging = false;
  }
}

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// Build a system window element
function createWindow({ id, title, subtitle, content, style = {} }) {
  const el = document.createElement('div');
  el.className = 'sys-window sys-window--inactive';
  el.dataset.windowId = id;

  el.innerHTML = `
    <div class="sys-titlebar">
      <div class="sys-titlebar__left">
        <span class="sys-titlebar__indicator"></span>
        <span class="sys-titlebar__label">${title}</span>
      </div>
      <div class="sys-titlebar__right">
        <span class="sys-titlebar__meta">${subtitle || ''}</span>
        <span class="sys-titlebar__session">SES:${SESSION_ID}</span>
      </div>
    </div>
    <div class="sys-scanline-top"></div>
    <div class="sys-content">
      ${content}
    </div>
    <div class="sys-statusbar">
      <span class="sys-statusbar__status">NOMINAL</span>
      <span class="sys-statusbar__time sys-clock">${timestamp()}</span>
      <span class="sys-statusbar__node">NODE_${Math.floor(Math.random() * 99).toString().padStart(2, '0')}</span>
    </div>
    <div class="sys-edge-glow"></div>
  `;

  Object.assign(el.style, style);
  return el;
}

// Boot sequence state machine
async function bootSequence(container) {
  // Phase 1: boot overlay with system init text
  const overlay = document.createElement('div');
  overlay.id = 'boot-overlay';
  overlay.innerHTML = `
    <div class="boot-lines" id="boot-lines"></div>
  `;
  document.body.appendChild(overlay);

  const bootLines = document.getElementById('boot-lines');

  const lines = [
    { text: 'SIGNAL FIELD INITIALIZED', delay: 200 },
    { text: 'ATMOSPHERIC MODULE v2.4.1 LOADING...', delay: 400 },
    { text: 'ENVIRONMENT RENDERER: ACTIVE', delay: 280 },
    { text: `SESSION ID: ${SESSION_ID}`, delay: 320 },
    { text: `BOOT TIMESTAMP: ${BOOT_TIME}`, delay: 200 },
    { text: 'SCANNING WORKSPACE TOPOLOGY...', delay: 500 },
    { text: 'ARCHIVE INDEX: FOUND', delay: 300 },
    { text: 'MODULE REGISTRY: 4 NODES PENDING', delay: 350 },
    { text: 'SIGNAL STABILIZING...', delay: 600 },
    { text: 'MOUNTING SYSTEM MODULES', delay: 200 },
  ];

  function addLine(text) {
    const span = document.createElement('div');
    span.className = 'boot-line';
    span.textContent = '> ' + text;
    bootLines.appendChild(span);
    // fade in
    requestAnimationFrame(() => span.classList.add('boot-line--visible'));
  }

  for (const line of lines) {
    await sleep(line.delay);
    addLine(line.text);
  }

  await sleep(800);

  // Phase 2: fade out overlay
  overlay.classList.add('boot-overlay--fade');
  await sleep(700);
  overlay.remove();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Materialize window with scanline emergence
async function materializeWindow(el, container, delay = 0) {
  await sleep(delay);
  el.classList.add('sys-window--materializing');
  container.appendChild(el);

  // measure after layout
  await sleep(50);
  measureWindow(windows.find((w) => w.el === el));
  updateSignalField();

  await sleep(60);
  el.classList.add('sys-window--emerged');
  await sleep(800);
  el.classList.remove('sys-window--materializing');
}

// Content templates
function homeContent() {
  return `
    <div class="sys-module-home">
      <div class="sys-home-callsign">PORTFOLIO<br><span class="sys-home-name">SYSTEM ARCHIVE</span></div>
      <div class="sys-home-tagline">Atmospheric computational workspace<br>Signal field active — all nodes online</div>
      <div class="sys-home-meta">
        <div class="sys-meta-row"><span class="sys-meta-key">OPERATOR</span><span class="sys-meta-val">Designer / Developer</span></div>
        <div class="sys-meta-row"><span class="sys-meta-key">STATUS</span><span class="sys-meta-val sys-blink-dot"><span class="dot"></span> ONLINE</span></div>
        <div class="sys-meta-row"><span class="sys-meta-key">UPTIME</span><span class="sys-meta-val sys-uptime">00:00:00</span></div>
      </div>
    </div>
  `;
}

function archiveContent() {
  return `
    <div class="sys-module-archive">
      <div class="sys-section-label">ARCHIVE.LOG // ABOUT</div>
      <p class="sys-body-text">
        A practitioner of the computational and visual — building interfaces where signal meets form.
        Specializing in immersive digital environments, systems design, and front-end engineering.
      </p>
      <p class="sys-body-text">
        Operating at the intersection of interaction design and systems thinking.
        Every artifact produced for clarity, restraint, and precision.
      </p>
      <div class="sys-divider"></div>
      <div class="sys-skill-grid">
        <div class="sys-skill-item">SYSTEMS DESIGN</div>
        <div class="sys-skill-item">CREATIVE DEV</div>
        <div class="sys-skill-item">GLSL / WEBGL</div>
        <div class="sys-skill-item">INTERACTION</div>
        <div class="sys-skill-item">UI ARCHITECTURE</div>
        <div class="sys-skill-item">MOTION</div>
      </div>
    </div>
  `;
}

function projectContent() {
  const projects = [
    { id: 'PRJ_001', name: 'SIGNAL FIELD', tag: 'WebGL / GLSL', status: 'ACTIVE' },
    { id: 'PRJ_002', name: 'ATMOSPHERIC OS', tag: 'Interface Design', status: 'ACTIVE' },
    { id: 'PRJ_003', name: 'ARCHIVE ENGINE', tag: 'Systems / JS', status: 'STABLE' },
    { id: 'PRJ_004', name: 'TELEMETRY DASH', tag: 'Data / Canvas', status: 'STABLE' },
    { id: 'PRJ_005', name: 'DORMANT FORMS', tag: 'Generative Art', status: 'ARCHIVED' },
  ];

  return `
    <div class="sys-module-projects">
      <div class="sys-section-label">PROJECT_INDEX // NODE_01</div>
      <div class="sys-project-list">
        ${projects.map((p) => `
          <div class="sys-project-row">
            <span class="sys-project-id">${p.id}</span>
            <span class="sys-project-name">${p.name}</span>
            <span class="sys-project-tag">${p.tag}</span>
            <span class="sys-project-status sys-project-status--${p.status.toLowerCase()}">${p.status}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function terminalContent() {
  return `
    <div class="sys-module-terminal">
      <div class="sys-section-label">TERMINAL // CONTACT</div>
      <div class="sys-terminal-lines" id="terminal-lines">
        <div class="sys-terminal-line"><span class="sys-terminal-prompt">SYS &gt;</span> CONTACT MODULE INITIALIZED</div>
        <div class="sys-terminal-line"><span class="sys-terminal-prompt">SYS &gt;</span> CHANNEL: OPEN</div>
        <div class="sys-terminal-line"><span class="sys-terminal-prompt">SYS &gt;</span> <span class="sys-terminal-muted">awaiting transmission...</span></div>
      </div>
      <div class="sys-divider"></div>
      <div class="sys-contact-grid">
        <a class="sys-contact-link" href="mailto:hello@example.com">EMAIL_CHANNEL</a>
        <a class="sys-contact-link" href="#" target="_blank">GITHUB_REPO</a>
        <a class="sys-contact-link" href="#" target="_blank">LINKEDIN_NODE</a>
      </div>
      <div class="sys-terminal-cursor-row">
        <span class="sys-terminal-prompt">SYS &gt;</span>
        <span class="sys-terminal-cursor"></span>
      </div>
    </div>
  `;
}

export async function initOS(container) {
  // Register global drag events
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  // Boot sequence
  await bootSequence(container);

  // Define all system windows
  const defs = [
    {
      id: 'home',
      title: 'SYS://HOME',
      subtitle: 'BOOT_NODE',
      content: homeContent(),
      style: { left: '6vw', top: '8vh', width: '340px' }
    },
    {
      id: 'archive',
      title: 'ARCHIVE.LOG',
      subtitle: 'IDENT_RECORD',
      content: archiveContent(),
      style: { left: '56vw', top: '7vh', width: '380px' }
    },
    {
      id: 'projects',
      title: 'PROJECT_INDEX',
      subtitle: 'NODE_01',
      content: projectContent(),
      style: { left: '8vw', top: '55vh', width: '420px' }
    },
    {
      id: 'terminal',
      title: 'TERMINAL',
      subtitle: 'CONTACT_OUT',
      content: terminalContent(),
      style: { left: '58vw', top: '52vh', width: '340px' }
    }
  ];

  // Create and register windows
  defs.forEach((def, i) => {
    const el = createWindow(def);
    const win = { el, id: def.id, cx: 0, cy: 0, w: 0, h: 0, active: false };
    windows.push(win);
    makeWindowDraggable(win, i);
  });

  // Materialize windows with staggered delays
  const delays = [0, 350, 620, 900];
  await Promise.all(
    windows.map((win, i) => materializeWindow(win.el, container, delays[i]))
  );

  // Activate first window
  setActive(0);

  // Start ambient behaviors
  startAmbientTick();
  startUptimeClock();
}

// Ambient tick — flickers, timestamp updates, telemetry
function startAmbientTick() {
  // Update all clock elements every second
  setInterval(() => {
    document.querySelectorAll('.sys-clock').forEach((el) => {
      el.textContent = timestamp();
    });
  }, 1000);

  // Rare dormant flicker on inactive windows
  setInterval(() => {
    const inactive = windows.filter((_, i) => i !== activeIndex);
    if (inactive.length === 0) return;
    const target = inactive[Math.floor(Math.random() * inactive.length)];
    target.el.classList.add('sys-window--flicker');
    setTimeout(() => target.el.classList.remove('sys-window--flicker'), 400);
  }, 6000 + Math.random() * 4000);
}

function startUptimeClock() {
  const start = Date.now();
  setInterval(() => {
    const secs = Math.floor((Date.now() - start) / 1000);
    const h = String(Math.floor(secs / 3600)).padStart(2, '0');
    const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    document.querySelectorAll('.sys-uptime').forEach((el) => {
      el.textContent = `${h}:${m}:${s}`;
    });
  }, 1000);
}
