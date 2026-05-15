import * as T from 'three';

import fragment from '../shaders/fragment.glsl';
import vertex from '../shaders/vertex.glsl';

const MAX_WINDOWS = 8;

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio
};

export default class Three {
  constructor(canvas) {
    this.canvas = canvas;
    this._windowData = [];
    this._activeWindow = -1;

    this.scene = new T.Scene();

    this.camera = new T.OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    this.camera.position.setZ(1);
    this.scene.add(this.camera);

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: false
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    this.clock = new T.Clock();

    this._buildWindowUniforms();
    this.setGeometry();
    this.render();
    this.setResize();
    this.setMouseMove();
  }

  _buildWindowUniforms() {
    // Flat array of vec4 uniforms for the shader
    this._windowUniforms = [];
    for (let i = 0; i < MAX_WINDOWS; i++) {
      this._windowUniforms.push({ value: new T.Vector4(0, 0, 0, 0) });
    }
  }

  // Called by the window manager with array of {cx, cy, w, h} in screen pixels
  updateWindows(windows, activeIndex) {
    this._windowData = windows;
    this._activeWindow = activeIndex ?? -1;
  }

  setGeometry() {
    const geometry = new T.PlaneGeometry(2, 2);

    const windowUniformsObj = {};
    for (let i = 0; i < MAX_WINDOWS; i++) {
      windowUniformsObj[`u_windows`] = {
        value: this._windowUniforms.map((u) => u.value)
      };
    }

    this.planeMaterial = new T.ShaderMaterial({
      fragmentShader: fragment,
      vertexShader: vertex,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: { value: new T.Vector2(device.width, device.height) },
        u_mouse: { value: new T.Vector2(0.5, 0.5) },
        u_windows: { value: Array.from({ length: MAX_WINDOWS }, () => new T.Vector4(0, 0, 0, 0)) },
        u_windowCount: { value: 0 },
        u_activeWindow: { value: -1 }
      }
    });

    this.planeMesh = new T.Mesh(geometry, this.planeMaterial);
    this.scene.add(this.planeMesh);
  }

  render() {
    const elapsed = this.clock.getElapsedTime();
    this.planeMaterial.uniforms.u_time.value = elapsed;

    // Update window influence uniforms
    const wins = this._windowData;
    const count = Math.min(wins.length, MAX_WINDOWS);
    this.planeMaterial.uniforms.u_windowCount.value = count;
    this.planeMaterial.uniforms.u_activeWindow.value = this._activeWindow;

    for (let i = 0; i < MAX_WINDOWS; i++) {
      const vec = this.planeMaterial.uniforms.u_windows.value[i];
      if (i < count) {
        const w = wins[i];
        // Convert screen coords to normalized [0,1]
        vec.x = w.cx / device.width;
        vec.y = 1.0 - w.cy / device.height; // flip Y for GLSL
        vec.z = w.w / device.width;
        vec.w = w.h / device.height;
      } else {
        vec.set(0, 0, 0, 0);
      }
    }

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = window.innerWidth;
    device.height = window.innerHeight;

    this.camera.updateProjectionMatrix();
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));
    this.planeMaterial.uniforms.u_resolution.value.set(device.width, device.height);
  }

  setMouseMove() {
    window.addEventListener('mousemove', (event) => {
      const x = event.clientX / window.innerWidth;
      const y = 1.0 - event.clientY / window.innerHeight;
      this.planeMaterial.uniforms.u_mouse.value.set(x, y);
    });
  }
}
