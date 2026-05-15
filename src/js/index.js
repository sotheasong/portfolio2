import '../css/global.css';

import Three from './three';
import { initOS, initWindowManager } from './windowManager';

window.addEventListener('load', async () => {
  const canvas = document.querySelector('#canvas');
  const workspace = document.querySelector('#workspace');

  const three = new Three(canvas);
  initWindowManager(three);

  const hudClock = document.querySelector('.sys-clock-hud');
  if (hudClock) {
    const tick = () => {
      hudClock.textContent = new Date().toISOString().replace('T', ' ').slice(0, 19);
    };
    tick();
    setInterval(tick, 1000);
  }

  await initOS(workspace);
});
