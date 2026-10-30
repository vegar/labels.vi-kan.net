import type { Manifold } from "manifold-3d";

/** A rectangle on the plate, from the plate's front-left corner, in mm. */
export interface Area {
  x: number;
  y: number;
  width: number;
  depth: number;
}

/** A printer's build plate, in mm. */
export interface Bed {
  width: number;
  depth: number;
  /** Parts of the plate to keep clear. */
  exclude?: Area[];
}

export interface Printer {
  id: string;
  vendor: string;
  name: string;
  bed: Bed;
}

/** The corner by the purge chute on P1 and X1 printers. */
const PURGE_CORNER: Area = { x: 0, y: 0, width: 18, depth: 28 };

/** A strip along the left or right edge that only one of two nozzles reaches, so a multi-colour label can't go there. */
function oneNozzleStrip(x: number, width: number, depth: number): Area {
  return { x, y: 0, width, depth };
}

/**
 * Printers to pick from. Print areas and keep-clear zones are from the
 * printer profiles that come with Bambu Studio and OrcaSlicer.
 */
export const PRINTERS: Printer[] = [
  { id: "bbl-a1mini", vendor: "Bambu Lab", name: "A1 mini", bed: { width: 180, depth: 180 } },
  { id: "bbl-a1", vendor: "Bambu Lab", name: "A1", bed: { width: 256, depth: 256 } },
  { id: "bbl-a2l", vendor: "Bambu Lab", name: "A2L", bed: { width: 330, depth: 320 } },
  { id: "bbl-p1p", vendor: "Bambu Lab", name: "P1P", bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] } },
  { id: "bbl-p1s", vendor: "Bambu Lab", name: "P1S", bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] } },
  { id: "bbl-p2s", vendor: "Bambu Lab", name: "P2S", bed: { width: 256, depth: 256 } },
  { id: "bbl-x1c", vendor: "Bambu Lab", name: "X1 Carbon", bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] } },
  { id: "bbl-x1e", vendor: "Bambu Lab", name: "X1E", bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] } },
  {
    id: "bbl-x2d",
    vendor: "Bambu Lab",
    name: "X2D",
    bed: { width: 256, depth: 256, exclude: [oneNozzleStrip(0, 20.5, 256)] },
  },
  { id: "bbl-h2s", vendor: "Bambu Lab", name: "H2S", bed: { width: 340, depth: 320 } },
  {
    id: "bbl-h2c",
    vendor: "Bambu Lab",
    name: "H2C",
    bed: { width: 330, depth: 320, exclude: [oneNozzleStrip(0, 25, 320), oneNozzleStrip(325, 5, 320)] },
  },
  {
    id: "bbl-h2d",
    vendor: "Bambu Lab",
    name: "H2D / H2D Pro",
    bed: { width: 350, depth: 320, exclude: [oneNozzleStrip(0, 25, 320), oneNozzleStrip(325, 25, 320)] },
  },
  { id: "prusa-mini", vendor: "Prusa", name: "MINI+", bed: { width: 180, depth: 180 } },
  { id: "prusa-mk4", vendor: "Prusa", name: "MK4S / MK4", bed: { width: 250, depth: 210 } },
  { id: "prusa-core-one", vendor: "Prusa", name: "Core One", bed: { width: 250, depth: 220 } },
  { id: "prusa-core-one-l", vendor: "Prusa", name: "Core One L", bed: { width: 300, depth: 300 } },
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
 * The part of the plate labels may go on: inside the edge margin, and
 * narrowed by keep-clear strips that run the whole depth of the plate. The
 * other keep-clear zones are left for the packing to avoid.
 */
function usableArea(bed: Bed): { area: Area; blocked: Area[] } {
  let left = PLATE_MARGIN;
  let right = bed.width - PLATE_MARGIN;
  const blocked: Area[] = [];
  for (const z of bed.exclude ?? []) {
    const strip = z.y <= 0 && z.y + z.depth >= bed.depth;
    if (strip && z.x <= 0) left = Math.max(left, z.x + z.width + PLATE_MARGIN);
    else if (strip && z.x + z.width >= bed.width) right = Math.min(right, z.x - PLATE_MARGIN);
    else blocked.push(z);
  }
  return {
    area: { x: left, y: PLATE_MARGIN, width: right - left, depth: bed.depth - 2 * PLATE_MARGIN },
    blocked,
  };
}

/** Whether a footprint with its back-left corner at `x`, `top` comes within a gap of a keep-clear zone. */
function hitsZone(blocked: Area[], x: number, top: number, item: Footprint): Area | undefined {
  return blocked.find(
    (z) =>
      x < z.x + z.width + PLATE_GAP &&
      x + item.width > z.x - PLATE_GAP &&
      top - item.depth < z.y + z.depth + PLATE_GAP &&
      top > z.y - PLATE_GAP,
  );
}

/**
 * Lay footprints out on as many plates as needed, in order: the first at the
 * back left, down a column towards the front, then the next column to the
 * right, then the next plate, keeping clear of the plate's keep-clear zones.
 * Each plate's layout is centred on the plate where that stays clear of
 * them. A footprint too large for the plate gets a plate of its own.
 */
export function packPlates(items: Footprint[], bed: Bed): Placement[] {
  const { area, blocked } = usableArea(bed);
  // Back-left corners from the usable area's back-left corner, with y growing towards the front.
  const placed: { plate: number; x: number; y: number }[] = [];
  let plate = 0;
  let columnX = 0;
  let columnWidth = 0;
  let y = 0;
  let empty = true;
  /** The plate holds something too large to share it with. */
  let full = false;
  const nextColumn = () => {
    columnX += columnWidth + PLATE_GAP;
    columnWidth = 0;
    y = 0;
  };
  const nextPlate = () => {
    plate++;
    columnX = 0;
    columnWidth = 0;
    y = 0;
    empty = true;
  };
  for (const item of items) {
    const alone = tooLarge(item, bed);
    if (!empty && (full || alone)) nextPlate();
    // Each step moves on, so this ends; the bound is only a safeguard.
    for (let tries = 0; !alone && tries < 1000; tries++) {
      if (columnX + item.width > area.width) {
        // Nowhere clear on an empty plate: leave it at the back left.
        if (empty) {
          columnX = 0;
          y = 0;
          break;
        }
        nextPlate();
        continue;
      }
      if (y + item.depth > area.depth) {
        nextColumn();
        continue;
      }
      const zone = hitsZone(blocked, area.x + columnX, area.y + area.depth - y, item);
      if (!zone) break;
      // Skip past the zone: down the column if it starts in an empty column, else to the next column.
      if (columnWidth === 0) {
        const below = area.y + area.depth - (zone.y - PLATE_GAP);
        if (below > y && below + item.depth <= area.depth) y = below;
        else columnX = Math.max(columnX + 1, zone.x + zone.width + PLATE_GAP - area.x);
      } else nextColumn();
    }
    placed.push({ plate, x: columnX, y });
    columnWidth = Math.max(columnWidth, item.width);
    y += item.depth + PLATE_GAP;
    empty = false;
    full = alone;
  }

  const plates = plateCount(placed);
  const shift = Array.from({ length: plates }, (_, p) => {
    const on = placed.map((q, i) => ({ ...q, item: items[i] })).filter((q) => q.plate === p);
    const width = Math.max(0, ...on.map((q) => q.x + q.item.width));
    const depth = Math.max(0, ...on.map((q) => q.y + q.item.depth));
    const dx = Math.max(0, (area.width - width) / 2);
    const dy = Math.max(0, (area.depth - depth) / 2);
    // Centre if that stays clear of the zones; the packed layout always does.
    const candidates: [number, number][] = [
      [dx, dy],
      [dx, 0],
      [0, dy],
    ];
    const clear = ([sx, sy]: [number, number]) =>
      on.every((q) => !hitsZone(blocked, area.x + q.x + sx, area.y + area.depth - q.y - sy, q.item));
    return candidates.find(clear) ?? [0, 0];
  });
  return placed.map((p, i) => {
    const [sx, sy] = shift[p.plate];
    return {
      plate: p.plate,
      x: area.x + sx + p.x + items[i].width / 2,
      y: area.y + area.depth - sy - p.y - items[i].depth / 2,
    };
  });
}

export function plateCount(placements: { plate: number }[]): number {
  return placements.length ? Math.max(...placements.map((p) => p.plate)) + 1 : 1;
}

/** Whether a footprint is larger than the part of the plate it may go on, so it can't be printed as is. */
export function tooLarge(item: Footprint, bed: Bed): boolean {
  const { area } = usableArea(bed);
  return item.width > area.width || item.depth > area.depth;
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
