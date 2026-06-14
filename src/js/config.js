export const BOOT_OPERATOR = 'sothea';
export const BOOT_NODE = '~/portfolio';

export const COLD_BOOT_PHASE = {
  signal: 720,
  sync: 680,
  scan: 560,
  diagGap: 200,
  identityDelay: 320,
  charMs: 58,
  hold: 420,
};

export const BOOT_HANDOFF = {
  revealDelay: 200,
  dissolve: 560,
  crossfade: 920,
  overlayFade: 480,
};

export const COLD_BOOT_DIAG = [
  { tag: 'RF', status: 'NOMINAL' },
  { tag: 'BUF', status: '2048K OK' },
  { tag: 'PHOS', status: 'P3A WARM' },
  { tag: 'SHDR', status: 'LIVE' },
];

/** Main terminal mouse-follow tilt (degrees). */
export const TERM_TILT = { baseX: 1.6, maxYaw: 1.0, maxPitch: 0.75 };

/** Float window mouse-follow tilt — subtler than main panel. */
export const WIN_TILT = { baseX: 2, maxYaw: 1.3, maxPitch: 1, liftZ: 8 };

export const OPEN_OVERLAP_MS = 60;
export const OPEN_PHASE = { wake: 220, expand: 420, reveal: 140 };
export const OPEN_ANIM_MS =
  OPEN_PHASE.wake - OPEN_OVERLAP_MS + OPEN_PHASE.expand + OPEN_PHASE.reveal;
export const CLOSE_ANIM_MS = 340;

/** WebGL background — cap DPR and idle frame rate to save GPU. */
export const PERF = {
  maxDpr: 1.5,
  maxDprCoarse: 1.25,
  fpsActive: 60,
  fpsIdle: 24,
  idleAfterMs: 2500,
};
