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
  height: number;
}

/** How the selected label is set apart from the rest, in mm. */
export interface RowLayout {
  /** Lift of the selected label along z. */
  lift: number;
  /** Extra space between the selected label and its neighbours, along y. */
  spread: number;
}

/** Space between neighbouring labels, in mm. */
const GAP = 4;

/** How far the pointer may move, in px, before a press counts as an orbit drag rather than a click. */
const CLICK_SLOP = 5;

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
  private raycaster = new THREE.Raycaster();
  private pressed: { x: number; y: number } | null = null;

  /** Called with a label's id when it is clicked in the view. */
  onPick: ((id: string) => void) | null = null;

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

    const canvas = this.renderer.domElement;
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointermove", this.onPointerMove);

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
   * Show the labels in a column from back to front, the first label furthest
   * away, like cards in a file box. The selected label is lifted and its
   * neighbours pushed aside according to `layout`; labels glide to their
   * new places when the selection or layout changes.
   */
  update(labels: PreviewLabel[], selected: string, layout: RowLayout) {
    for (const [id, shown] of this.shown) {
      if (!labels.some((l) => l.id === id)) this.remove(id, shown);
    }

    // Lay the column out without the spread first, centred on the origin, so
    // it doesn't shift when another label is selected.
    const height = Math.max(0, ...labels.map((l) => l.height));
    const pitch = height + GAP;
    const depth = labels.length * pitch - GAP;
    const width = Math.max(0, ...labels.map((l) => l.width));
    const at = labels.findIndex((l) => l.id === selected);
    labels.forEach((label, i) => {
      const y = depth / 2 - height / 2 - i * pitch;
      const offset = at < 0 || i === at ? 0 : i < at ? layout.spread : -layout.spread;
      this.show(label, new THREE.Vector3(0, y + offset, i === at ? layout.lift : 0));
    });

    const frame = `${labels.length}:${width}`;
    if (frame !== this.framed) {
      this.framed = frame;
      this.frame(width, depth + 2 * layout.spread);
    }
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    const canvas = this.renderer.domElement;
    canvas.removeEventListener("pointerdown", this.onPointerDown);
    canvas.removeEventListener("pointerup", this.onPointerUp);
    canvas.removeEventListener("pointermove", this.onPointerMove);
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
      group.userData.id = label.id;
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

  private onPointerDown = (e: PointerEvent) => {
    this.pressed = e.button === 0 ? { x: e.clientX, y: e.clientY } : null;
  };

  /** A press released close to where it started is a click; anything further was an orbit drag. */
  private onPointerUp = (e: PointerEvent) => {
    const pressed = this.pressed;
    this.pressed = null;
    if (!pressed || Math.hypot(e.clientX - pressed.x, e.clientY - pressed.y) > CLICK_SLOP) return;
    const id = this.pick(e);
    if (id) this.onPick?.(id);
  };

  /** Show a pointer cursor over labels while no button is held. */
  private onPointerMove = (e: PointerEvent) => {
    if (e.buttons !== 0) return;
    this.renderer.domElement.style.cursor = this.pick(e) ? "pointer" : "";
  };

  /** The id of the label under the pointer, if any. */
  private pick(e: PointerEvent): string | undefined {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(ndc, this.camera);
    const groups = [...this.shown.values()].map((s) => s.group);
    const [hit] = this.raycaster.intersectObjects(groups, true);
    return hit?.object.parent?.userData.id;
  }

  /** Ease every label towards its target position. */
  private animate(dt: number) {
    const t = 1 - Math.exp(-dt * 12);
    for (const { group, target } of this.shown.values()) {
      group.position.lerp(target, t);
    }
  }

  /** Point the camera at an area of labels, from above the front. */
  private frame(width: number, depth: number) {
    // Fit the whole column in view, but don't zoom in further than for one 1U label.
    const tan = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const fitWidth = (width / 2 / (tan * Math.max(this.camera.aspect, 0.5))) * 1.15;
    // The camera looks down at about 57°, which foreshortens depth a little.
    const fitDepth = ((depth * 0.85) / 2 / tan) * 1.5;
    const distance = Math.max(Math.max(width, 40) * 2.1, fitWidth, fitDepth);
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
