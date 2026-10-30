import type { Manifold } from "manifold-3d";

/** A printer's build plate, in mm. */
export interface Bed {
  width: number;
  depth: number;
}

export interface Printer {
  id: string;
  vendor: string;
  name: string;
  bed: Bed;
}

/** Printers to pick from, with the area they can print on. */
export const PRINTERS: Printer[] = [
  { id: "bbl-a1mini", vendor: "Bambu Lab", name: "A1 mini", bed: { width: 180, depth: 180 } },
  { id: "bbl-a1", vendor: "Bambu Lab", name: "A1", bed: { width: 256, depth: 256 } },
  { id: "bbl-p1p", vendor: "Bambu Lab", name: "P1P", bed: { width: 256, depth: 256 } },
  { id: "bbl-p1s", vendor: "Bambu Lab", name: "P1S", bed: { width: 256, depth: 256 } },
  { id: "bbl-p2s", vendor: "Bambu Lab", name: "P2S", bed: { width: 256, depth: 256 } },
  { id: "bbl-x1c", vendor: "Bambu Lab", name: "X1 Carbon", bed: { width: 256, depth: 256 } },
  { id: "bbl-x1e", vendor: "Bambu Lab", name: "X1E", bed: { width: 256, depth: 256 } },
  { id: "bbl-h2s", vendor: "Bambu Lab", name: "H2S", bed: { width: 340, depth: 320 } },
  // The area both nozzles reach; a single nozzle reaches 350 mm across.
  { id: "bbl-h2d", vendor: "Bambu Lab", name: "H2D", bed: { width: 325, depth: 320 } },
  { id: "prusa-mini", vendor: "Prusa", name: "MINI+", bed: { width: 180, depth: 180 } },
  { id: "prusa-mk4", vendor: "Prusa", name: "MK4S / MK4", bed: { width: 250, depth: 210 } },
  { id: "prusa-core-one", vendor: "Prusa", name: "Core One", bed: { width: 250, depth: 220 } },
  { id: "prusa-xl", vendor: "Prusa", name: "XL", bed: { width: 360, depth: 360 } },
  { id: "creality-ender3v3", vendor: "Creality", name: "Ender-3 V3", bed: { width: 220, depth: 220 } },
  { id: "creality-k1", vendor: "Creality", name: "K1 / K1C", bed: { width: 220, depth: 220 } },
  { id: "creality-k1max", vendor: "Creality", name: "K1 Max", bed: { width: 300, depth: 300 } },
  { id: "voron-250", vendor: "Voron", name: "2.4 / Trident 250", bed: { width: 250, depth: 250 } },
  { id: "voron-300", vendor: "Voron", name: "2.4 / Trident 300", bed: { width: 300, depth: 300 } },
  { id: "voron-350", vendor: "Voron", name: "2.4 / Trident 350", bed: { width: 350, depth: 350 } },
];

export const CUSTOM_PRINTER = "custom";

/** The plate the export used before there was a choice. */
export const DEFAULT_PRINTER = "bbl-p1s";

/** The chosen printer, or a custom bed size. */
export interface PrinterChoice {
  id: string;
  /** Used when `id` is CUSTOM_PRINTER. */
  custom: Bed;
}

export function printerName(choice: PrinterChoice): string {
  const p = PRINTERS.find((p) => p.id === choice.id);
  return p ? `${p.vendor} ${p.name}` : "custom printer";
}

export function bedOf(choice: PrinterChoice): Bed {
  return PRINTERS.find((p) => p.id === choice.id)?.bed ?? choice.custom;
}

/** Gap between labels on a plate, in mm. */
export const PLATE_GAP = 5;
/** Space kept free along the edges of the plate, in mm. */
export const PLATE_MARGIN = 5;
/** Bambu Studio and OrcaSlicer leave a fifth of a plate between plates. */
const PLATE_SPACING = 1.2;

/** The size of something to place, in mm. */
export interface Footprint {
  width: number;
  depth: number;
}

export interface Bounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** The box around a few solids. */
export function bounds(manifolds: Manifold[]): Bounds {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  for (const m of manifolds) {
    const b = m.boundingBox();
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], b.min[k]);
      max[k] = Math.max(max[k], b.max[k]);
    }
  }
  return { min, max };
}

export function footprint(b: Bounds): Footprint {
  return { width: b.max[0] - b.min[0], depth: b.max[1] - b.min[1] };
}

/** Where a footprint goes: a plate, and its centre on that plate, from the plate's front-left corner. */
export interface Placement {
  plate: number;
  x: number;
  y: number;
}

/**
 * Lay footprints out on as many plates as needed, in order: the first at the
 * back left, down a column towards the front, then the next column to the
 * right, then the next plate. Each plate's layout is centred on the plate. A
 * footprint too large for the plate gets a plate of its own.
 */
export function packPlates(items: Footprint[], bed: Bed): Placement[] {
  const usableWidth = bed.width - 2 * PLATE_MARGIN;
  const usableDepth = bed.depth - 2 * PLATE_MARGIN;
  // Top-left corners, with y growing towards the front.
  const placed: { plate: number; x: number; y: number }[] = [];
  let plate = 0;
  let columnX = 0;
  let columnWidth = 0;
  let y = 0;
  let empty = true;
  /** The plate holds something too large to share it with. */
  let full = false;
  for (const item of items) {
    if (!empty && y + item.depth > usableDepth) {
      columnX += columnWidth + PLATE_GAP;
      columnWidth = 0;
      y = 0;
    }
    const alone = tooLarge(item, bed);
    if (!empty && (full || alone || columnX + item.width > usableWidth)) {
      plate++;
      columnX = 0;
      columnWidth = 0;
      y = 0;
    }
    placed.push({ plate, x: columnX, y });
    columnWidth = Math.max(columnWidth, item.width);
    y += item.depth + PLATE_GAP;
    empty = false;
    full = alone;
  }

  const plates = plateCount(placed);
  const extent = Array.from({ length: plates }, () => ({ width: 0, depth: 0 }));
  placed.forEach((p, i) => {
    extent[p.plate].width = Math.max(extent[p.plate].width, p.x + items[i].width);
    extent[p.plate].depth = Math.max(extent[p.plate].depth, p.y + items[i].depth);
  });
  return placed.map((p, i) => {
    const e = extent[p.plate];
    return {
      plate: p.plate,
      x: (bed.width - e.width) / 2 + p.x + items[i].width / 2,
      y: (bed.depth + e.depth) / 2 - p.y - items[i].depth / 2,
    };
  });
}

export function plateCount(placements: { plate: number }[]): number {
  return placements.length ? Math.max(...placements.map((p) => p.plate)) + 1 : 1;
}

/** Whether a footprint is larger than the plate, so it can't be printed as is. */
export function tooLarge(item: Footprint, bed: Bed): boolean {
  return item.width > bed.width - 2 * PLATE_MARGIN || item.depth > bed.depth - 2 * PLATE_MARGIN;
}

/** Columns in Bambu Studio's grid of plates: the square root of the count, rounded up. */
export function plateColumns(count: number): number {
  return Math.ceil(Math.sqrt(count) - 1e-9);
}

/**
 * Where plate `index`'s front-left corner is, out of `count` plates, the way
 * Bambu Studio and OrcaSlicer place them: a square-ish grid, left to right,
 * then rows towards the front, each a fifth of a plate apart.
 */
export function plateOrigin(index: number, count: number, bed: Bed): [number, number] {
  const cols = plateColumns(count);
  const row = Math.floor(index / cols);
  const col = index % cols;
  return [col * bed.width * PLATE_SPACING, -row * bed.depth * PLATE_SPACING];
}
