import type { CrossSection, ManifoldToplevel, Vec2 } from "manifold-3d";

/**
 * Fastener symbols, ported from gflabel's fragments:
 * https://github.com/ndevenish/gflabel/blob/main/src/gflabel/fragments.py
 *
 * Every symbol is a 2D shape centered on the origin, drawn for a given row
 * height in mm. Some symbols (the Cullenect bolt) are taller than the row,
 * like in gflabel, and the layout scales them down to fit.
 */

export type SymbolKind =
  | "head"
  | "hexhead"
  | "bolt"
  | "cullbolt"
  | "nut"
  | "nutProfile"
  | "locknutProfile"
  | "squareNut"
  | "tnut"
  | "washer"
  | "lockwasher"
  | "insert";

export type Drive =
  | "phillips"
  | "pozidrive"
  | "slot"
  | "hex"
  | "cross"
  | "square"
  | "triangle"
  | "torx"
  | "security"
  | "phillipsslot";

export type HeadShape = "pan" | "socket" | "countersunk" | "round" | "wafer";

export interface LabelSymbol {
  kind: SymbolKind;
  /** Drive recesses, for heads and the Cullenect bolt. */
  drives?: Drive[];
  /** Head profile, for bolts. */
  headShape?: HeadShape;
  /** Bolt length in mm, for the variable-length bolt. */
  length?: number;
  /** Pointed self-tapping tip. */
  tapping?: boolean;
  /** Point the bolt the other way. */
  flip?: boolean;
  /** Partly threaded (Cullenect bolt). */
  partial?: boolean;
  /** Slotted head (bolt). */
  slotted?: boolean;
  /** Flanged head (bolt). */
  flanged?: boolean;
}

export interface SymbolInfo {
  kind: SymbolKind;
  name: string;
  /** Which options apply to this symbol. */
  drives?: boolean;
  headShapes?: HeadShape[];
  length?: boolean;
  modifiers?: ("tapping" | "flip" | "partial" | "slotted" | "flanged")[];
  defaults: LabelSymbol;
}

export const SYMBOLS: SymbolInfo[] = [
  {
    kind: "cullbolt",
    name: "Bolt",
    drives: true,
    headShapes: ["pan", "socket", "countersunk", "round"],
    modifiers: ["tapping", "partial", "flip"],
    defaults: { kind: "cullbolt", headShape: "socket", drives: ["hex"] },
  },
  {
    kind: "bolt",
    name: "Bolt (length)",
    headShapes: ["pan", "socket", "countersunk", "round", "wafer"],
    length: true,
    modifiers: ["tapping", "slotted", "flanged", "flip"],
    defaults: { kind: "bolt", headShape: "socket", length: 12 },
  },
  { kind: "head", name: "Head", drives: true, defaults: { kind: "head", drives: ["hex"] } },
  { kind: "hexhead", name: "Hex head", drives: true, defaults: { kind: "hexhead", drives: [] } },
  { kind: "nut", name: "Nut", defaults: { kind: "nut" } },
  { kind: "nutProfile", name: "Nut (side)", defaults: { kind: "nutProfile" } },
  { kind: "locknutProfile", name: "Lock nut (side)", defaults: { kind: "locknutProfile" } },
  { kind: "squareNut", name: "Square nut", defaults: { kind: "squareNut" } },
  { kind: "tnut", name: "T-nut", defaults: { kind: "tnut" } },
  { kind: "washer", name: "Washer", defaults: { kind: "washer" } },
  { kind: "lockwasher", name: "Lock washer", defaults: { kind: "lockwasher" } },
  { kind: "insert", name: "Threaded insert", defaults: { kind: "insert" } },
];

export const DRIVES: { value: Drive; label: string }[] = [
  { value: "hex", label: "Hex" },
  { value: "phillips", label: "Phillips" },
  { value: "pozidrive", label: "Pozidriv" },
  { value: "torx", label: "Torx" },
  { value: "slot", label: "Slot" },
  { value: "square", label: "Square" },
  { value: "cross", label: "Cross" },
  { value: "triangle", label: "Triangle" },
  { value: "phillipsslot", label: "Phillips/slot" },
  { value: "security", label: "Security pin" },
];

export function symbolInfo(kind: SymbolKind): SymbolInfo {
  return SYMBOLS.find((s) => s.kind === kind)!;
}

/** True for symbols that grow to fill the space they are given. */
export function isVariableWidth(symbol: LabelSymbol): boolean {
  return symbol.kind === "bolt";
}

const SEGMENTS = 48;

/** Points along a circular or elliptical arc, from `start` to `end` degrees. */
function arc(cx: number, cy: number, rx: number, ry: number, start: number, end: number, steps = 12): Vec2[] {
  const pts: Vec2[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = ((start + ((end - start) * i) / steps) * Math.PI) / 180;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

class Sketcher {
  constructor(private wasm: ManifoldToplevel) {}

  poly(...contours: Vec2[][]): CrossSection {
    return new this.wasm.CrossSection(contours, "NonZero");
  }

  rect(w: number, h: number, x = 0, y = 0, rotation = 0): CrossSection {
    return this.wasm.CrossSection.square([w, h], true).rotate(rotation).translate(x, y);
  }

  circle(r: number, x = 0, y = 0): CrossSection {
    return this.wasm.CrossSection.circle(r, SEGMENTS).translate(x, y);
  }

  /** Regular polygon with the given circumradius and a vertex on the +X axis. */
  ngon(r: number, sides: number): CrossSection {
    const pts: Vec2[] = [];
    for (let i = 0; i < sides; i++) {
      const a = (2 * Math.PI * i) / sides;
      pts.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    return this.poly(pts);
  }

  /** Stadium shape: two circles `distance` apart joined by a band. */
  slot(distance: number, width: number, rotation: number): CrossSection {
    const r = width / 2;
    return this.rect(distance, width)
      .add(this.circle(r, -distance / 2))
      .add(this.circle(r, distance / 2))
      .rotate(rotation);
  }

  union(shapes: CrossSection[]): CrossSection {
    return this.wasm.CrossSection.union(shapes);
  }
}

/**
 * A single drive recess, drawn to `radius`. The returned `positive` flag
 * marks shapes (the security pin) that are left standing inside the others.
 */
function driveShape(s: Sketcher, drive: Drive, radius: number, outerRadius: number) {
  const cut = Math.max(radius, outerRadius) / radius;
  let shape: CrossSection;
  let positive = false;
  const phillips = () => s.union([s.rect(1, 0.2), s.rect(0.2, 1), s.rect(0.4, 0.4, 0, 0, 45)]);
  switch (drive) {
    case "phillips":
      shape = phillips();
      break;
    case "pozidrive":
      shape = s.union([phillips(), s.rect(1, 0.1, 0, 0, 45), s.rect(1, 0.1, 0, 0, -45)]);
      break;
    case "slot":
      shape = s.rect(cut, 0.2);
      break;
    case "hex":
      shape = s.ngon(0.5, 6);
      break;
    case "cross":
      shape = s.union([s.rect(1, 0.2), s.rect(0.2, 1)]);
      break;
    case "phillipsslot":
      shape = phillips().add(s.rect(cut, 0.2));
      break;
    case "square":
      shape = s.rect(0.6, 0.6, 0, 0, 45);
      break;
    case "triangle": {
      // Equilateral, pointing up, centered on its bounding box.
      const side = 0.95;
      const h = (side * Math.sqrt(3)) / 2;
      shape = s.poly([
        [-side / 2, -h / 2],
        [side / 2, -h / 2],
        [0, h / 2],
      ]);
      break;
    }
    case "torx": {
      shape = s.union([s.circle(0.74 / 2), ...[0, 120, 240].map((a) => s.slot(0.82, 0.19, a))]);
      for (let i = 0; i < 6; i++) {
        const a = ((30 + i * 60) * Math.PI) / 180;
        shape = shape.subtract(s.circle(0.11, 0.41 * Math.cos(a), 0.41 * Math.sin(a)));
      }
      break;
    }
    case "security":
      shape = s.circle(0.1);
      positive = true;
      break;
  }
  return { shape: shape.scale(2 * radius), positive };
}

/** Several drives combined into one recess, e.g. Torx with a security pin. */
function compoundDrive(s: Sketcher, drives: Drive[], radius: number, outerRadius: number): CrossSection | undefined {
  const shapes = drives.map((d) => driveShape(s, d, radius, outerRadius));
  const plus = shapes.filter((d) => !d.positive).map((d) => d.shape);
  const minus = shapes.filter((d) => d.positive).map((d) => d.shape);
  if (plus.length === 0) return undefined;
  return minus.reduce((acc, m) => acc.subtract(m), s.union(plus));
}

function withDrives(s: Sketcher, shape: CrossSection, drives: Drive[] | undefined, radius: number, outer: number) {
  const recess = drives?.length ? compoundDrive(s, drives, radius, outer) : undefined;
  return recess ? shape.subtract(recess) : shape;
}

/** Variable-length bolt in the style of pred-box labels. Breaks the shaft when longer than `maxWidth`. */
function bolt(s: Sketcher, sym: LabelSymbol, height: number, maxWidth: number): CrossSection {
  const head = sym.headShape ?? "pan";
  let length = sym.length ?? 10;
  const lw = height / 2.25;
  const halfSplit = 0.75;

  // With countersunk bolts, the length includes the head.
  if (head === "countersunk") length -= lw;

  const maxsize = Math.max(maxWidth, lw * 2 + halfSplit * 2 + 0.1);
  const split = length + lw > maxsize;
  const hw = split ? maxsize / 2 : (length + lw) / 2;

  let headH = height / 2;
  if (sym.flanged) headH -= lw / 3;

  const tip: Vec2[] = sym.tapping
    ? [
        [hw - lw / 2, lw / 2],
        [hw, 0],
        [hw - lw / 2, -lw / 2],
      ]
    : [
        [hw, lw / 2],
        [hw, -lw / 2],
      ];

  // Head outline, from where it meets the top of the shaft round to the bottom.
  let headPts: Vec2[];
  switch (head) {
    case "pan": {
      const r = Math.min(2, lw / 2);
      headPts = [
        [-hw + lw, headH],
        ...arc(-hw + r, headH - r, r, r, 90, 180),
        ...arc(-hw + r, -headH + r, r, r, 180, 270),
        [-hw + lw, -headH],
      ];
      break;
    }
    case "socket":
      headPts = [
        [-hw + lw, headH],
        [-hw, headH],
        [-hw, -headH],
        [-hw + lw, -headH],
      ];
      break;
    case "wafer":
      headPts = [
        [-hw + lw, headH],
        [-hw + (lw * 2) / 3, headH],
        [-hw + (lw * 2) / 3, -headH],
        [-hw + lw, -headH],
      ];
      break;
    case "countersunk":
      headPts = [
        [-hw, headH],
        [-hw, -headH],
      ];
      break;
    case "round":
      headPts = arc(-hw + lw, 0, lw, headH, 90, 270, 24);
      break;
  }

  let shape: CrossSection;
  if (!split) {
    shape = s.poly([...headPts, [-hw + lw, -lw / 2], ...[...tip].reverse(), [-hw + lw, lw / 2]]);
  } else {
    const xm = lw + (maxsize - lw) / 2 - hw;
    const front = s.poly([
      ...headPts,
      [-hw + lw, -lw / 2],
      [xm - lw / 2 - halfSplit, -lw / 2],
      [xm + lw / 2 - halfSplit, lw / 2],
      [-hw + lw, lw / 2],
    ]);
    const back = s.poly([[xm + lw / 2 + halfSplit, lw / 2], ...tip, [xm - lw / 2 + halfSplit, -lw / 2]]);
    shape = front.add(back);
  }

  if (sym.slotted) shape = shape.subtract(s.rect(lw / 2, lw / 2, -hw + lw / 4, 0));
  if (sym.flanged) shape = shape.add(s.rect(lw / 4, height, -hw + lw - lw / 8, 0));
  return sym.flip ? shape.scale(-1) : shape;
}

/** Cullenect-style fixed-length bolt with a visible drive. Drawn 1.6× the row height. */
function cullbolt(s: Sketcher, sym: LabelSymbol, rowHeight: number): CrossSection {
  const head = sym.headShape ?? "pan";
  const height = rowHeight * 1.6;
  const width = 1.456 * height;
  const bodyW = 0.856 * height;
  let threads = 6;
  const threadDepth = 0.0707 * height;

  const headW = width - bodyW;
  const xHead = bodyW - width / 2;
  let x0 = -width / 2;
  const pitch = bodyW / threads;
  const tipY = height / 4 + threadDepth;
  const rootY = tipY - threadDepth;

  // The top half of the outline, from the tip of the thread to the head.
  const top: Vec2[] = [[x0, 0]];
  if (sym.tapping) {
    top.push([x0 + pitch * 2 - 0.2, rootY]);
    threads -= 2;
    x0 += pitch * 2;
  }
  if (sym.partial) threads = 3;
  for (let i = 0; i < threads; i++) {
    top.push([x0 + i * pitch, rootY], [x0 + (i + 0.5) * pitch, tipY]);
  }
  if (sym.partial) top.push([x0 + threads * pitch, rootY]);
  top.push([xHead, rootY]);

  switch (head) {
    case "pan": {
      const r = Math.min(2, height / 4);
      top.push([xHead, height / 2], ...arc(width / 2 - r, height / 2 - r, r, r, 90, 0));
      break;
    }
    case "countersunk":
      top.push([width / 2, height / 2]);
      break;
    case "socket":
      top.push([xHead, height / 2], [width / 2, height / 2]);
      break;
    case "round": {
      const xRound = width / 2 - height / 2;
      top.push([xHead, height / 2], ...arc(xRound, 0, height / 2, height / 2, 90, 0, 24));
      break;
    }
    case "wafer":
      top.push([xHead, height / 2], [width / 2, height / 2]);
      break;
  }
  top.push([width / 2, 0]);

  // Mirror the top half to close the outline.
  const bottom = top
    .slice(1, -1)
    .reverse()
    .map(([x, y]): Vec2 => [x, -y]);
  let shape = s.poly([...top, ...bottom]);

  if (sym.drives?.length) {
    const recess = compoundDrive(s, sym.drives, (headW * 0.9) / 2, headW / 2);
    if (recess) shape = shape.subtract(recess.translate(width / 2 - headW / 2 - threadDepth / 2, 0));
  }
  return sym.flip ? shape.scale(-1) : shape;
}

function threadedInsert(s: Sketcher, height: number): CrossSection {
  // Body: wide at the ends, narrow in the middle, with slightly rounded corners.
  const quarter: Vec2[] = [
    [0, 3.75],
    [-4, 3.75],
    [-4, 1.25],
    [-3, 1.25],
  ];
  const outline: Vec2[] = [
    ...quarter,
    ...[...quarter].reverse().map(([x, y]): Vec2 => [x, -y]),
    ...quarter.map(([x, y]): Vec2 => [-x, -y]),
    ...[...quarter].reverse().map(([x, y]): Vec2 => [-x, y]),
  ];
  const body = s
    .poly(outline)
    .offset(-0.2, "Round", 2, SEGMENTS)
    .offset(0.4, "Round", 2, SEGMENTS)
    .offset(-0.2, "Round", 2, SEGMENTS);
  let shape = body.add(s.rect(6, 2.5, 0, -3.76 - 2.5 / 2));

  // Knurling: slanted cuts across the wide parts.
  const trapezoid: Vec2[] = [
    [-1.074, 0.65],
    [-0.226, 0.65],
    [1.074, -0.65],
    [0.226, -0.65],
  ];
  for (const x of [-2.4375, -0.8125, 0.8125, 2.4375]) {
    for (const y of [-2.5, 2.5]) {
      shape = shape.subtract(s.poly(trapezoid).translate(x, y));
    }
  }
  return shape.translate(0, 2.5 / 2).scale(height / 10);
}

/**
 * Draw a symbol for a row `height` mm tall. `maxWidth` limits variable-width
 * symbols (the bolt); fixed-size symbols ignore it.
 */
export function renderSymbol(
  wasm: ManifoldToplevel,
  sym: LabelSymbol,
  height: number,
  maxWidth = Infinity,
): CrossSection {
  const s = new Sketcher(wasm);
  const h = height;
  const r = h / 2;
  switch (sym.kind) {
    case "head":
      return withDrives(s, s.circle(r), sym.drives, r * 0.7, r);
    case "hexhead":
      return withDrives(s, s.ngon(r, 6), sym.drives, r * 0.6, r);
    case "bolt":
      return bolt(s, sym, h, maxWidth);
    case "cullbolt":
      return cullbolt(s, sym, h);
    case "nut":
      return s.ngon(r, 6).subtract(s.circle(r * 0.4));
    case "nutProfile": {
      const w = h / 2.25;
      return s.rect(w, h).subtract(s.rect(w, h / 10, 0, h / 4)).subtract(s.rect(w, h / 10, 0, -h / 4));
    }
    case "locknutProfile": {
      const w = (h / 2.25) * 1.5;
      const cy = h * 0.2;
      return s
        .union([
          s.rect((w * 2) / 3, h),
          s.circle(w / 3, -w / 3, cy),
          s.circle(w / 3, -w / 3, -cy),
          s.rect(w / 3, 2 * cy, -w / 2, 0),
        ])
        .subtract(s.rect((w * 2) / 3, h / 10, 0, h / 4))
        .subtract(s.rect((w * 2) / 3, h / 10, 0, -h / 4));
    }
    case "squareNut":
      return s.rect(h, h).subtract(s.circle(r * 0.55));
    case "tnut":
      return s
        .rect(h * 0.6 - (2 * h) / 7, h - (2 * h) / 7)
        .offset(h / 7, "Round", 2, SEGMENTS)
        .subtract(s.circle(h * 0.2));
    case "washer":
      return s.circle(r).subtract(s.circle(r * 0.55));
    case "lockwasher": {
      const yCut = (r * 1.55) / 2;
      const cut = s.rect((r * 0.55) / 2, yCut * 2, h * 0.1, yCut).rotate(45);
      return s.circle(r).subtract(s.circle(r * 0.55)).subtract(cut);
    }
    case "insert":
      return threadedInsert(s, h);
  }
}

/** SVG path data for a shape, in its own coordinates with y flipped for screen. */
export function toSvgPath(shape: CrossSection): string {
  return shape
    .toPolygons()
    .map((poly) => "M" + poly.map(([x, y]) => `${x.toFixed(3)} ${(-y).toFixed(3)}`).join("L") + "Z")
    .join("");
}
