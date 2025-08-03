import * as T from 'three';
// eslint-disable-next-line import/no-unresolved
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import fragment from '../shaders/fragment.glsl';
import vertex from '../shaders/vertex.glsl';

const device = {
  width: window.innerWidth,
  height: window.innerHeight,
  pixelRatio: window.devicePixelRatio
};

export default class Three {
  constructor(canvas) {
    this.canvas = document.querySelector('#canvas');

    this.scene = new T.Scene();

    this.camera = new T.PerspectiveCamera(
      75,
      device.width / device.height,
      0.1,
      1000
    );
    this.camera.position.setZ(30);
    this.scene.add(this.camera);

    this.renderer = new T.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    // mouse controls
    //this.controls = new OrbitControls(this.camera, this.canvas);

    this.clock = new T.Clock();

    this.setLights();
    this.setGeometry();
    this.render();
    this.setResize();
    this.setMouseMove();
  }

  setLights() {
    this.ambientLight = new T.AmbientLight(new T.Color(1, 1, 1, 1));
    this.scene.add(this.ambientLight);
  }

  setGeometry() {
    const geometry = new T.PlaneGeometry(2, 2); // Fullscreen quad
    const textureLoader = new T.TextureLoader();
    const grainTexture = textureLoader.load(
      "../assets/noise.png"
    );

    this.planeMaterial = new T.ShaderMaterial({
      fragmentShader: fragment,
      vertexShader: vertex,
      uniforms: {
        u_time: { value: 0 },
        u_resolution: {
          value: new T.Vector2(device.width, device.height)
        },
        u_grainTexture: {
          value: grainTexture
        },
        u_mouse: {
          value: new T.Vector2(0.5, 0.5) // Centered by default
        }
      },
    });

    this.planeMesh = new T.Mesh(geometry, this.planeMaterial);
    this.scene.add(this.planeMesh);
  }

  render() {
    const elapsed = this.clock.getElapsedTime();
    this.planeMaterial.uniforms.u_time.value = elapsed;

    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.render.bind(this));
  }

  setResize() {
    window.addEventListener('resize', this.onResize.bind(this));
  }

  onResize() {
    device.width = window.innerWidth;
    device.height = window.innerHeight;

    this.camera.left = -1;
    this.camera.right = 1;
    this.camera.top = 1;
    this.camera.bottom = -1;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(device.width, device.height);
    this.renderer.setPixelRatio(Math.min(device.pixelRatio, 2));

    this.planeMaterial.uniforms.u_resolution.value.set(device.width, device.height);
  }

  setMouseMove() {
    window.addEventListener('mousemove', (event) => {
      const x = event.clientX / window.innerWidth;
      const y = 1.0 - event.clientY / window.innerHeight; // Invert Y for GLSL

      if (this.planeMaterial.uniforms.u_mouse) {
        this.planeMaterial.uniforms.u_mouse.value.set(x, y);
      }
    });
  }
}
