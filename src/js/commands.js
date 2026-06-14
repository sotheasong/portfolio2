/* ── Content builders ────────────────────────────────────────────────── */

function buildAboutContent() {
  const el = document.createElement('div');
  el.className = 'win-about';
  el.innerHTML = `
    <dl class="win-about__profile">
      <div class="win-about__row">
        <dt class="win-about__key">OPERATOR</dt>
        <dd class="win-about__val">sothea</dd>
      </div>
      <div class="win-about__row">
        <dt class="win-about__key">LOCATION</dt>
        <dd class="win-about__val win-about__val--dim">— redacted —</dd>
      </div>
      <div class="win-about__row">
        <dt class="win-about__key">FOCUS</dt>
        <dd class="win-about__val">interface at the edge of perception</dd>
      </div>
      <div class="win-about__row">
        <dt class="win-about__key">STACK</dt>
        <dd class="win-about__val">typescript · react · three.js · node</dd>
      </div>
      <div class="win-about__row">
        <dt class="win-about__key">STATUS</dt>
        <dd class="win-about__val win-about__val--active">
          <span class="win-about__dot"></span>active
        </dd>
      </div>
    </dl>
    <div class="win-about__divider"></div>
    <div class="win-about__bio">
      <p>Building digital environments where signal and form converge.</p>
      <p>Interested in real-time rendering, generative systems, and interfaces that feel alive.</p>
    </div>
  `;
  return el;
}

function buildPlaceholderContent(label) {
  const el = document.createElement('div');
  el.innerHTML = `
    <p style="color:var(--term-muted);font-size:.9em;line-height:1.65">${label}</p>
  `;
  return el;
}

/* ── Help lines ──────────────────────────────────────────────────────── */

const HELP_LINES = [
  'available commands:',
  '',
  '  about     operator profile',
  '  projects  project archive',
  '  resume    experience log',
  '  contact   comms channel',
  '',
  '  help      this message',
];

export const COMMAND_NAMES = ['help', 'about', 'projects', 'resume', 'contact'];

/* ── Command registry ────────────────────────────────────────────────── */

const COMMANDS = {
  help: {
    run({ appendOutput }) {
      HELP_LINES.forEach((line) => appendOutput(line));
    },
  },
  about: {
    run({ appendOutput, openWindow }) {
      appendOutput('loading operator profile…');
      openWindow('about', { title: 'about', buildContent: buildAboutContent });
    },
  },
  projects: {
    run({ appendOutput, openWindow }) {
      appendOutput('opening project archive…');
      openWindow('projects', {
        title: 'projects',
        buildContent: () => buildPlaceholderContent('Project archive — signal routing in progress.'),
      });
    },
  },
  resume: {
    run({ appendOutput, openWindow }) {
      appendOutput('mounting experience log…');
      openWindow('resume', {
        title: 'resume',
        buildContent: () => buildPlaceholderContent('Experience log — timeline export pending.'),
      });
    },
  },
  contact: {
    run({ appendOutput, openWindow }) {
      appendOutput('establishing comms channel…');
      openWindow('contact', {
        title: 'contact',
        buildContent: () => buildPlaceholderContent('Comms channel — uplink coordinates pending.'),
      });
    },
  },
};

/* ── Runner ──────────────────────────────────────────────────────────── */

export function runCommand(raw, ctx) {
  const name = raw.trim().toLowerCase();
  if (!name) return;

  const command = COMMANDS[name];
  if (!command) {
    ctx.appendOutput(`command not found: ${raw.trim()}`);
    ctx.appendOutput('type help for available commands');
    return;
  }

  command.run(ctx);
}
