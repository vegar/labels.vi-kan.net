import * as THREE from "three";
import type { Area, Bed } from "./bed";

/** How far the sheet reaches past the print area, in mm. */
const BORDER = 6;
/** The sheet sticks out further at the front, for the handle. */
const FRONT_BORDER = 10;
const CORNER_RADIUS = 8;
const SHEET_THICKNESS = 1.2;
/** A tab in the middle of the front edge to lift the sheet by. */
const TAB_WIDTH = 60;
const TAB_DEPTH = 9;
/** Two notches in the back edge, where the sheet sits on its alignment pins. */
const NOTCH_RADIUS = 4;
/** Grid lines in the print area, in mm. */
const GRID = 10;

const SHEET_EDGE_COLOR = 0x3a3d42;
const GRID_COLOR = 0x8a6d3f;
const OUTLINE_COLOR = 0xe8d2a6;

/** One plate: a spring-steel sheet with a textured PEI top, its print area and keep-clear zones, and its number. */
export function plateModel(bed: Bed, index: number): THREE.Group {
  const plate = new THREE.Group();

  const sheet = new THREE.Mesh(
    new THREE.ExtrudeGeometry(sheetOutline(bed), { depth: SHEET_THICKNESS, bevelEnabled: false, curveSegments: 12 }),
    [
      new THREE.MeshStandardMaterial({ map: peiTexture(), roughness: 0.95, metalness: 0.1 }),
      new THREE.MeshStandardMaterial({ color: SHEET_EDGE_COLOR, roughness: 0.5, metalness: 0.6 }),
    ],
  );
  // The top face sits just under z = 0, where the labels stand.
  sheet.position.z = -SHEET_THICKNESS - 0.02;
  plate.add(sheet);

  const lines: number[] = [];
  for (let x = GRID; x < bed.width; x += GRID) lines.push(x, 0, 0.01, x, bed.depth, 0.01);
  for (let y = GRID; y < bed.depth; y += GRID) lines.push(0, y, 0.01, bed.width, y, 0.01);
  plate.add(lineSegments(lines, GRID_COLOR));
  const { width: w, depth: d } = bed;
  plate.add(
    lineSegments(
      [0, 0, 0.02, w, 0, 0.02, w, 0, 0.02, w, d, 0.02, w, d, 0.02, 0, d, 0.02, 0, d, 0.02, 0, 0, 0.02],
      OUTLINE_COLOR,
    ),
  );

  for (const zone of bed.exclude ?? []) {
    if (zone.kind === "tower") {
      plate.add(towerModel(zone));
      continue;
    }
    const shade = new THREE.Mesh(
      new THREE.PlaneGeometry(zone.width, zone.depth),
      new THREE.MeshBasicMaterial({ map: hatchTexture(zone.width, zone.depth), transparent: true, depthWrite: false }),
    );
    shade.position.set(zone.x + zone.width / 2, zone.y + zone.depth / 2, 0.03);
    plate.add(shade);
  }

  // The plate's number on the front tab, as the slicer numbers them.
  const number = new THREE.Mesh(
    new THREE.PlaneGeometry(TAB_DEPTH * 1.6, TAB_DEPTH),
    new THREE.MeshBasicMaterial({ map: numberTexture(index + 1), transparent: true, depthWrite: false }),
  );
  number.position.set(bed.width / 2, -FRONT_BORDER - TAB_DEPTH / 2 + 2, 0.03);
  plate.add(number);
  return plate;
}

/** How tall to draw the purge tower: only a hint, the real one is as tall as the labels. */
const TOWER_HEIGHT = 6;
const TOWER_COLOR = 0x9aa3ad;

/** A translucent block where the slicer will put the purge tower. */
function towerModel(zone: Area): THREE.Group {
  const group = new THREE.Group();
  const box = new THREE.BoxGeometry(zone.width, zone.depth, TOWER_HEIGHT);
  const block = new THREE.Mesh(
    box,
    new THREE.MeshStandardMaterial({ color: TOWER_COLOR, transparent: true, opacity: 0.45, depthWrite: false }),
  );
  group.add(block);
  group.add(new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: TOWER_COLOR })));
  group.position.set(zone.x + zone.width / 2, zone.y + zone.depth / 2, TOWER_HEIGHT / 2);
  return group;
}

function lineSegments(points: number[], color: number): THREE.LineSegments {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color }));
}

/** The sheet's outline, from the print area's front-left corner: rounded corners, a front tab, two back notches. */
function sheetOutline(bed: Bed): THREE.Shape {
  const x0 = -BORDER;
  const x1 = bed.width + BORDER;
  const y0 = -FRONT_BORDER;
  const y1 = bed.depth + BORDER;
  const r = CORNER_RADIUS;
  const mid = bed.width / 2;
  const s = new THREE.Shape();
  s.moveTo(x0 + r, y0);
  s.lineTo(mid - TAB_WIDTH / 2, y0);
  s.lineTo(mid - TAB_WIDTH / 2 + TAB_DEPTH, y0 - TAB_DEPTH);
  s.lineTo(mid + TAB_WIDTH / 2 - TAB_DEPTH, y0 - TAB_DEPTH);
  s.lineTo(mid + TAB_WIDTH / 2, y0);
  s.lineTo(x1 - r, y0);
  s.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0, false);
  s.lineTo(x1, y1 - r);
  s.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2, false);
  // Back edge, right to left, with the notches cut into the sheet.
  for (const nx of [bed.width * 0.75, bed.width * 0.25]) {
    s.lineTo(nx + NOTCH_RADIUS, y1);
    s.absarc(nx, y1, NOTCH_RADIUS, 0, Math.PI, true);
  }
  s.lineTo(x0 + r, y1);
  s.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI, false);
  s.lineTo(x0, y0 + r);
  s.absarc(x0 + r, y0 + r, r, Math.PI, (Math.PI * 3) / 2, false);
  return s;
}

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  return [c, c.getContext("2d")!];
}

let pei: THREE.Texture | undefined;

/** Speckled gold, like a textured PEI sheet. Shared by every plate, so never freed. */
function peiTexture(): THREE.Texture {
  if (pei) return pei;
  const size = 256;
  const [c, ctx] = canvas(size, size);
  ctx.fillStyle = "#a8844f";
  ctx.fillRect(0, 0, size, size);
  const image = ctx.getImageData(0, 0, size, size);
  // A fixed pseudo-random speckle, so the plate looks the same every time.
  let seed = 1;
  const random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < image.data.length; i += 4) {
    const v = (random() - 0.5) * 34;
    image.data[i] += v;
    image.data[i + 1] += v * 0.85;
    image.data[i + 2] += v * 0.6;
  }
  ctx.putImageData(image, 0, 0);
  pei = new THREE.CanvasTexture(c);
  pei.colorSpace = THREE.SRGBColorSpace;
  pei.wrapS = pei.wrapT = THREE.RepeatWrapping;
  // Extruded caps use mm as texture coordinates: one tile per 40 mm.
  pei.repeat.set(1 / 40, 1 / 40);
  return pei;
}

const hatches = new Map<string, THREE.Texture>();

/** Diagonal stripes for a keep-clear zone of this size. Cached per size, so never freed. */
function hatchTexture(width: number, depth: number): THREE.Texture {
  const key = `${width}x${depth}`;
  const cached = hatches.get(key);
  if (cached) return cached;
  // 4 px per mm, with stripes every 4 mm.
  const scale = 4;
  const [c, ctx] = canvas(Math.max(4, Math.round(width * scale)), Math.max(4, Math.round(depth * scale)));
  ctx.fillStyle = "rgba(20, 20, 24, 0.45)";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.strokeStyle = "rgba(230, 70, 50, 0.7)";
  ctx.lineWidth = scale * 0.8;
  const step = 4 * scale;
  for (let x = -c.height; x < c.width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, c.height);
    ctx.lineTo(x + c.height, 0);
    ctx.stroke();
  }
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  hatches.set(key, texture);
  return texture;
}

const numbers = new Map<number, THREE.Texture>();

/** A plate number, light on transparent. Cached per number, so never freed. */
function numberTexture(n: number): THREE.Texture {
  const cached = numbers.get(n);
  if (cached) return cached;
  const [c, ctx] = canvas(160, 100);
  ctx.fillStyle = "#f4ecdc";
  ctx.font = "bold 72px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 80, 54);
  const texture = new THREE.CanvasTexture(c);
  texture.colorSpace = THREE.SRGBColorSpace;
  numbers.set(n, texture);
  return texture;
}
