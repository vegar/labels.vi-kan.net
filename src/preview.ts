import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Manifold } from "manifold-3d";

export interface PreviewPart {
  manifold: Manifold;
  color: string;
}

function toGeometry(manifold: Manifold): THREE.BufferGeometry {
  const { vertProperties, triVerts, numProp } = manifold.getMesh();
  const positions = new Float32Array((vertProperties.length / numProp) * 3);
  for (let i = 0, j = 0; i < vertProperties.length; i += numProp, j += 3) {
    positions[j] = vertProperties[i];
    positions[j + 1] = vertProperties[i + 1];
    positions[j + 2] = vertProperties[i + 2];
  }
  const indexed = new THREE.BufferGeometry();
  indexed.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  indexed.setIndex(new THREE.BufferAttribute(triVerts, 1));
  // Flat shading: split vertices so each face gets its own normal.
  const geometry = indexed.toNonIndexed();
  geometry.computeVertexNormals();
  indexed.dispose();
  return geometry;
}

export class Preview {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 1, 2000);
  private controls: OrbitControls;
  private group = new THREE.Group();
  private framedWidth = 0;

  constructor(private container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(this.renderer.domElement);

    // Z is up in the label's coordinates, like in a slicer.
    this.camera.up.set(0, 0, 1);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.8);
    key.position.set(-40, -60, 100);
    this.scene.add(key);
    this.scene.add(this.group);

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  setBackground(color: string) {
    this.scene.background = new THREE.Color(color);
  }

  update(parts: PreviewPart[], width: number) {
    for (const child of [...this.group.children]) {
      const mesh = child as THREE.Mesh;
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      this.group.remove(mesh);
    }
    for (const part of parts) {
      const material = new THREE.MeshStandardMaterial({
        color: part.color,
        roughness: 0.65,
        metalness: 0,
      });
      this.group.add(new THREE.Mesh(toGeometry(part.manifold), material));
    }
    if (width !== this.framedWidth) this.frame(width);
  }

  /** Point the camera at a label of the given width, slightly from below the front. */
  private frame(width: number) {
    this.framedWidth = width;
    const distance = Math.max(width, 40) * 2.1;
    this.camera.position.set(0, -distance * 0.55, distance * 0.85);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (w === 0 || h === 0) return;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}
