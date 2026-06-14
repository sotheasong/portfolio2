import * as T from 'three';

import fragment from '../shaders/fragment.glsl';
import vertex from '../shaders/vertex.glsl';
import { PERF } from './config.js';

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio,
};

const RIPPLE_SLOTS = 16;
const RIPPLE_DURATION_SEC = 6.5;
const TRAIL_SLOTS = 12;
const TRAIL_DURATION_SEC = 2.35;
/** Normalized UV distance before spawning another ripple while dragging */
const DRAG_RIPPLE_INTERVAL_NORM = 0.03;
const DRAG_TRAIL_INTERVAL_NORM = 0.036;

/** DOM rect sync only — shader no longer warps/colors by UI rect (avoids edge artifacts). */
const PUSH_UI_PANELS_TO_SHADER = false;

function maxDevicePixelRatio() {
  const cap = window.matchMedia('(pointer: coarse)').matches
    ? PERF.maxDprCoarse
    : PERF.maxDpr;
  return Math.min(window.devicePixelRatio, cap);
}

export default class Three {
  constructor(canvas) {
    if (!canvas) {
      throw new Error('Three: canvas element is required');
    }
    this.canvas = canvas;

    this._render = this.render.bind(this);
    this._frameId = null;
    this._paused = false;
    this._lastFrameMs = 0;
    this._lastPointerMs = 0;

    this.scene = new T.Scene();

    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.setZ(1);
    this.scene.add(this.camera);

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(maxDevicePixelRatio());

    this.clock = new T.Clock();

    this._dragPrevNorm = null;
    this._dragDistAccum = 0;
    this._dragTrailAccum = 0;

    this._uiRoot =
      typeof document !== 'undefined' ? document.getElementById('portfolio-terminal') : null;

    this.setGeometry();
    this.setupUiPanelSync();
    this.syncUiPanels();
    this.setupVisibility();
    this.render();
    this.setResize();
    this.setupPointerInteractions();
  }

  setGeometry() {
    const geometry = new T.PlaneGeometry(2, 2);

    this.planeMaterial = new T.ShaderMaterial({
      fragmentShader: fragment,
      vertexShader: vertex,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new T.Vector2(device.width, device.height) },
        u_mouse: { value: new T.Vector2(0.5, 0.5) },
        u_ripple: {
          value: Array.from({ length: RIPPLE_SLOTS }, () => new T.Vector4(0, 0, 0, 0)),
        },
        u_trail: {
          value: Array.from({ length: TRAIL_SLOTS }, () => new T.Vector4(0, 0, 0, 0)),
        },
      },
    });

    this.planeMesh = new T.Mesh(geometry, this.planeMaterial);
    this.scene.add(this.planeMesh);

    if (this.planeMaterial.uniforms === undefined) {
      console.error('Shader material failed to compile');
    }
  }

  setupUiPanelSync() {
    if (!this._uiRoot || !PUSH_UI_PANELS_TO_SHADER) return;
    const ro = new ResizeObserver(() => this.syncUiPanels());
    ro.observe(this._uiRoot);
    window.addEventListener('scroll', () => this.syncUiPanels(), { passive: true, capture: true });
  }

  setupVisibility() {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._paused = true;
        if (this._frameId !== null) {
          cancelAnimationFrame(this._frameId);
          this._frameId = null;
        }
        return;
      }
      this._paused = false;
      this._lastFrameMs = 0;
      if (this._frameId === null) this.render();
    });
  }

  /** Reserved for future UI-aware effects; currently clears when PUSH is false. */
  syncUiPanels() {
    if (PUSH_UI_PANELS_TO_SHADER) return;
  }

  _hasActiveRipplesOrTrails(elapsed) {
    const ripples = this.planeMaterial.uniforms.u_ripple.value;
    for (let i = 0; i < ripples.length; i++) {
      if (ripples[i].w > 0.5) return true;
    }
    const trails = this.planeMaterial.uniforms.u_trail.value;
    for (let i = 0; i < trails.length; i++) {
      if (trails[i].w > 0.5 && elapsed - trails[i].z < TRAIL_DURATION_SEC) return true;
    }
    return false;
  }

  _targetFrameMs(elapsed) {
    const pointerRecent = performance.now() - this._lastPointerMs < PERF.idleAfterMs;
    const busy = pointerRecent || this._hasActiveRipplesOrTrails(elapsed);
    const fps = busy ? PERF.fpsActive : PERF.fpsIdle;
    return 1000 / fps;
  }

  render() {
    if (this._paused) return;

    const now = performance.now();
    const elapsed = this.clock.getElapsedTime();
    const frameMs = this._targetFrameMs(elapsed);

    if (this._lastFrameMs > 0 && now - this._lastFrameMs < frameMs) {
      this._frameId = requestAnimationFrame(this._render);
      return;
    }
    this._lastFrameMs = now;

    this.planeMaterial.uniforms.u_time.value = elapsed;

    const ripples = this.planeMaterial.uniforms.u_ripple.value;
    for (let i = 0; i < ripples.length; i++) {
      const r = ripples[i];
      if (r.w > 0.5 && elapsed - r.z > RIPPLE_DURATION_SEC) r.w = 0;
    }

    const trails = this.planeMaterial.uniforms.u_trail.value;
    for (let i = 0; i < trails.length; i++) {
      const t = trails[i];
      if (t.w > 0.5 && elapsed - t.z > TRAIL_DURATION_SEC) t.w = 0;
    }

    this.renderer.render(this.scene, this.camera);
    this._frameId = requestAnimationFrame(this._render);
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = window.innerWidth;
    device.height = window.innerHeight;

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(maxDevicePixelRatio());
    this.planeMaterial.uniforms.u_resolution.value.set(device.width, device.height);
    this.syncUiPanels();
  }

  _isPointerOverCanvas(event) {
    const rect = this.canvas.getBoundingClientRect();
    return (
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom
    );
  }

  setupPointerInteractions() {
    const normFromEvent = (event) => ({
      x: event.clientX / window.innerWidth,
      y: 1.0 - event.clientY / window.innerHeight,
    });

    const touchPointer = () => {
      this._lastPointerMs = performance.now();
    };

    const onMove = (event) => {
      const dragging = (event.buttons & 1) !== 0;
      if (!dragging && !this._isPointerOverCanvas(event)) return;

      touchPointer();
      const { x, y } = normFromEvent(event);
      this.planeMaterial.uniforms.u_mouse.value.set(x, y);

      if (!dragging) return;

      if (this._dragPrevNorm !== null) {
        const step = Math.hypot(x - this._dragPrevNorm.x, y - this._dragPrevNorm.y);
        this._dragDistAccum += step;
        this._dragTrailAccum += step;
        while (this._dragDistAccum >= DRAG_RIPPLE_INTERVAL_NORM) {
          this._dragDistAccum -= DRAG_RIPPLE_INTERVAL_NORM;
          this.spawnRipple(x, y);
        }
        while (this._dragTrailAccum >= DRAG_TRAIL_INTERVAL_NORM) {
          this._dragTrailAccum -= DRAG_TRAIL_INTERVAL_NORM;
          this.spawnTrail(x, y);
        }
      }

      this._dragPrevNorm = { x, y };
    };

    const onDown = (event) => {
      if (event.button !== 0) return;
      touchPointer();
      const { x, y } = normFromEvent(event);
      this.planeMaterial.uniforms.u_mouse.value.set(x, y);
      this.spawnRipple(x, y);
      this.spawnTrail(x, y);
      this._dragPrevNorm = { x, y };
      this._dragDistAccum = 0;
      this._dragTrailAccum = 0;
    };

    const endDrag = () => {
      this._dragPrevNorm = null;
      this._dragDistAccum = 0;
      this._dragTrailAccum = 0;
    };

    const canvas = this.canvas ?? document.body;
    canvas.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', endDrag, { passive: true });
    window.addEventListener('pointercancel', endDrag, { passive: true });
  }

  spawnRipple(normX, normY) {
    this._lastPointerMs = performance.now();
    const elapsed = this.clock.getElapsedTime();
    const ripples = this.planeMaterial.uniforms.u_ripple.value;

    let slot = -1;
    for (let i = 0; i < RIPPLE_SLOTS; i++) {
      if (ripples[i].w < 0.5) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      let oldestAge = -1;
      slot = 0;
      for (let i = 0; i < RIPPLE_SLOTS; i++) {
        const age = elapsed - ripples[i].z;
        if (age > oldestAge) {
          oldestAge = age;
          slot = i;
        }
      }
    }

    ripples[slot].set(normX, normY, elapsed, 1);
  }

  spawnTrail(normX, normY) {
    this._lastPointerMs = performance.now();
    const elapsed = this.clock.getElapsedTime();
    const trails = this.planeMaterial.uniforms.u_trail.value;

    let slot = -1;
    for (let i = 0; i < TRAIL_SLOTS; i++) {
      if (trails[i].w < 0.5) {
        slot = i;
        break;
      }
    }
    if (slot < 0) {
      let oldestAge = -1;
      slot = 0;
      for (let i = 0; i < TRAIL_SLOTS; i++) {
        const age = elapsed - trails[i].z;
        if (age > oldestAge) {
          oldestAge = age;
          slot = i;
        }
      }
    }

    trails[slot].set(normX, normY, elapsed, 1);
  }
}
