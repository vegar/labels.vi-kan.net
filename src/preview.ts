import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { Manifold } from "manifold-3d";

export interface PreviewPart {
  manifold: Manifold;
  color: string;
}

export interface PreviewLabel {
  id: string;
  /** Empty while the label is still building or failed to build. */
  parts: PreviewPart[];
  width: number;
}

/** How the selected label is set apart from the rest of the row, in mm. */
export interface RowLayout {
  /** Lift of the selected label along z. */
  lift: number;
  /** Extra space between the selected label and its neighbours, along x. */
  spread: number;
}

/** Space between neighbouring labels in the row, in mm. */
const GAP = 4;

interface Shown {
  group: THREE.Group;
  manifolds: Manifold[];
  target: THREE.Vector3;
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
  private camera = new THREE.PerspectiveCamera(30, 1, 1, 4000);
  private controls: OrbitControls;
  private shown = new Map<string, Shown>();
  private framed = "";
  private clock = new THREE.Clock();
  private resizeObserver: ResizeObserver;

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

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.setAnimationLoop(() => {
      this.animate(this.clock.getDelta());
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    });
  }

  setBackground(color: string) {
    this.scene.background = new THREE.Color(color);
  }

  /**
   * Show the labels in a row along x. The selected label is lifted and its
   * neighbours pushed aside according to `layout`; labels glide to their
   * new places when the selection or layout changes.
   */
  update(labels: PreviewLabel[], selected: string, layout: RowLayout) {
    for (const [id, shown] of this.shown) {
      if (!labels.some((l) => l.id === id)) this.remove(id, shown);
    }

    // Lay the row out without the spread first, centred on the origin, so the
    // row doesn't shift sideways when another label is selected.
    const rowWidth = labels.reduce((sum, l) => sum + l.width, 0) + GAP * Math.max(0, labels.length - 1);
    const at = labels.findIndex((l) => l.id === selected);
    let x = -rowWidth / 2;
    labels.forEach((label, i) => {
      const center = x + label.width / 2;
      x += label.width + GAP;
      const offset = at < 0 || i === at ? 0 : i < at ? -layout.spread : layout.spread;
      const target = new THREE.Vector3(center + offset, 0, i === at ? layout.lift : 0);
      this.show(label, target);
    });

    const frame = `${labels.length}:${rowWidth}`;
    if (frame !== this.framed) {
      this.framed = frame;
      this.frame(rowWidth + 2 * layout.spread);
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    this.controls.dispose();
    for (const [id, shown] of this.shown) this.remove(id, shown);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  /** Add or refresh one label's meshes, and set where it should move to. */
  private show(label: PreviewLabel, target: THREE.Vector3) {
    let shown = this.shown.get(label.id);
    if (!shown) {
      const group = new THREE.Group();
      group.position.copy(target);
      this.scene.add(group);
      shown = { group, manifolds: [], target };
      this.shown.set(label.id, shown);
    }
    shown.target = target;

    // Only rebuild meshes when the geometry changed; colours update in place.
    const manifolds = label.parts.map((p) => p.manifold);
    const same = manifolds.length === shown.manifolds.length && manifolds.every((m, i) => m === shown.manifolds[i]);
    if (!same) {
      clearGroup(shown.group);
      shown.manifolds = manifolds;
      for (const part of label.parts) {
        const material = new THREE.MeshStandardMaterial({ color: part.color, roughness: 0.65, metalness: 0 });
        shown.group.add(new THREE.Mesh(toGeometry(part.manifold), material));
      }
    } else {
      label.parts.forEach((part, i) => {
        ((shown.group.children[i] as THREE.Mesh).material as THREE.MeshStandardMaterial).color.set(part.color);
      });
    }
  }

  private remove(id: string, shown: Shown) {
    clearGroup(shown.group);
    this.scene.remove(shown.group);
    this.shown.delete(id);
  }

  /** Ease every label towards its target position. */
  private animate(dt: number) {
    const t = 1 - Math.exp(-dt * 12);
    for (const { group, target } of this.shown.values()) {
      group.position.lerp(target, t);
    }
  }

  /** Point the camera at a row of the given width, slightly from below the front. */
  private frame(width: number) {
    // Fit the row across the view, but don't zoom in further than for a 1U label.
    const halfFov = THREE.MathUtils.degToRad(this.camera.fov / 2);
    const fit = (width / 2 / (Math.tan(halfFov) * Math.max(this.camera.aspect, 0.5))) * 1.15;
    const distance = Math.max(Math.max(width, 40) * 2.1, fit);
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

function clearGroup(group: THREE.Group) {
  for (const child of [...group.children]) {
    const mesh = child as THREE.Mesh;
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
    group.remove(mesh);
  }
}
