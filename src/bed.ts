import type { Manifold } from "manifold-3d";

/** A rectangle on the plate, from the plate's front-left corner, in mm. */
export interface Area {
  x: number;
  y: number;
  width: number;
  depth: number;
  /** What keeps it clear, when it isn't simply unprintable. */
  kind?: "tower";
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
  /** Where the slicer puts the purge tower by default, its front-left corner, and its width. */
  tower?: { x: number; y: number; width: number };
  /** Bambu Studio's system presets for this printer, to name in a project file. */
  bambu?: BambuPresets;
}

/** The names of Bambu Studio system presets: the printer with a 0.4 mm nozzle, its 0.20mm Standard process, and PLA Basic. */
export interface BambuPresets {
  model: string;
  printer: string;
  process: string;
  filament: string;
  /** Printers with two nozzles name both in their settings. */
  nozzles: 1 | 2;
}

/** Presets named the usual way: "Bambu Lab <model> 0.4 nozzle", "0.20mm Standard @BBL <code>", "Bambu PLA Basic @BBL <code>". */
function bambu(
  model: string,
  code: string,
  opts: { filament?: string; process?: string; nozzles?: 1 | 2 } = {},
): BambuPresets {
  return {
    model: `Bambu Lab ${model}`,
    printer: `Bambu Lab ${model} 0.4 nozzle`,
    process: `0.20mm Standard @BBL ${opts.process ?? code}`,
    filament: `Bambu PLA Basic @BBL ${opts.filament ?? code}`,
    nozzles: opts.nozzles ?? 1,
  };
}

/**
 * Bambu Studio's default purge tower: at x 165, y 250 (x 0 on bedslingers),
 * as wide as the 0.20mm Standard process says, and square.
 */
const TOWER = { x: 165, y: 250, width: 35 };
const WIDE_TOWER = { ...TOWER, width: 60 };
const I3_TOWER = { ...TOWER, x: 0 };
/** Room for the purge tower's brim. */
export const TOWER_BRIM = 3;

/** The corner by the purge chute on P1 and X1 printers. */
const PURGE_CORNER: Area = { x: 0, y: 0, width: 18, depth: 28 };

/** A strip along the left or right edge that only one of two nozzles reaches, so a multi-colour label can't go there. */
function oneNozzleStrip(x: number, width: number, depth: number): Area {
  return { x, y: 0, width, depth };
}

const H2D_BED: Bed = {
  width: 350,
  depth: 320,
  exclude: [oneNozzleStrip(0, 25, 320), oneNozzleStrip(325, 25, 320)],
};

/**
 * Printers to pick from. Print areas and keep-clear zones are from the
 * printer profiles that come with Bambu Studio and OrcaSlicer.
 */
export const PRINTERS: Printer[] = [
  {
    id: "bbl-a1mini",
    vendor: "Bambu Lab",
    name: "A1 mini",
    bed: { width: 180, depth: 180 },
    tower: I3_TOWER,
    bambu: bambu("A1 mini", "A1M"),
  },
  {
    id: "bbl-a1",
    vendor: "Bambu Lab",
    name: "A1",
    bed: { width: 256, depth: 256 },
    tower: I3_TOWER,
    bambu: bambu("A1", "A1"),
  },
  {
    id: "bbl-a2l",
    vendor: "Bambu Lab",
    name: "A2L",
    bed: { width: 330, depth: 320 },
    tower: I3_TOWER,
    bambu: bambu("A2L", "A2L", { filament: "A2L 0.4 nozzle" }),
  },
  {
    id: "bbl-p1p",
    vendor: "Bambu Lab",
    name: "P1P",
    bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] },
    tower: TOWER,
    bambu: bambu("P1P", "P1P"),
  },
  {
    id: "bbl-p1s",
    vendor: "Bambu Lab",
    name: "P1S",
    bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] },
    tower: TOWER,
    bambu: bambu("P1S", "X1C", { filament: "P1S 0.4 nozzle" }),
  },
  {
    id: "bbl-p2s",
    vendor: "Bambu Lab",
    name: "P2S",
    bed: { width: 256, depth: 256 },
    tower: TOWER,
    bambu: bambu("P2S", "P2S"),
  },
  {
    id: "bbl-x1c",
    vendor: "Bambu Lab",
    name: "X1 Carbon",
    bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] },
    tower: TOWER,
    bambu: bambu("X1 Carbon", "X1C"),
  },
  {
    id: "bbl-x1e",
    vendor: "Bambu Lab",
    name: "X1E",
    bed: { width: 256, depth: 256, exclude: [PURGE_CORNER] },
    tower: TOWER,
    bambu: bambu("X1E", "X1C"),
  },
  {
    id: "bbl-x2d",
    vendor: "Bambu Lab",
    name: "X2D",
    bed: { width: 256, depth: 256, exclude: [oneNozzleStrip(0, 20.5, 256)] },
    tower: TOWER,
    bambu: bambu("X2D", "X2D", { filament: "X2D 0.4 nozzle", nozzles: 2 }),
  },
  {
    id: "bbl-h2s",
    vendor: "Bambu Lab",
    name: "H2S",
    bed: { width: 340, depth: 320 },
    tower: WIDE_TOWER,
    bambu: bambu("H2S", "H2S"),
  },
  {
    id: "bbl-h2c",
    vendor: "Bambu Lab",
    name: "H2C",
    bed: { width: 330, depth: 320, exclude: [oneNozzleStrip(0, 25, 320), oneNozzleStrip(325, 5, 320)] },
    tower: WIDE_TOWER,
    bambu: bambu("H2C", "H2C", { nozzles: 2 }),
  },
  {
    id: "bbl-h2d",
    vendor: "Bambu Lab",
    name: "H2D",
    bed: H2D_BED,
    tower: WIDE_TOWER,
    bambu: bambu("H2D", "H2D", { nozzles: 2 }),
  },
  {
    id: "bbl-h2dp",
    vendor: "Bambu Lab",
    name: "H2D Pro",
    bed: H2D_BED,
    tower: WIDE_TOWER,
    bambu: bambu("H2D Pro", "H2DP", { nozzles: 2 }),
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

export function bambuPresets(choice: PrinterChoice): BambuPresets | undefined {
  return PRINTERS.find((p) => p.id === choice.id)?.bambu;
}

export function printerName(choice: PrinterChoice): string {
  const p = PRINTERS.find((p) => p.id === choice.id);
  return p ? `${p.vendor} ${p.name}` : "custom printer";
}

/**
 * The plate to lay labels out on. With more than one colour the slicer adds
 * a purge tower, so its default spot is kept clear too, pulled back onto the
 * plate the way the slicer does on smaller beds.
 */
export function bedOf(choice: PrinterChoice, multiColour = false): Bed {
  const printer = PRINTERS.find((p) => p.id === choice.id);
  if (!printer) return choice.custom;
  const { bed, tower } = printer;
  if (!multiColour || !tower) return bed;
  const size = tower.width + 2 * TOWER_BRIM;
  const zone: Area = {
    x: Math.min(tower.x, bed.width - size),
    y: Math.min(tower.y, bed.depth - size),
    width: size,
    depth: size,
    kind: "tower",
  };
  return { ...bed, exclude: [...(bed.exclude ?? []), zone] };
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
 * Lay footprints out on as many plates as needed, like lines of text: the
 * first at the back left, along a row to the right, then the next row towards
 * the front, then the next plate, keeping clear of the plate's keep-clear
 * zones. A footprint goes at the end of the first row it fits in, so short
 * ones fill the gaps earlier rows left. Labels are all about as deep, so rows
 * waste little space. Each plate's layout is centred on the plate where that
 * stays clear of the zones. A footprint too large for the plate gets a plate
 * of its own.
 */
export function packPlates(items: Footprint[], bed: Bed): Placement[] {
  const { area, blocked } = usableArea(bed);
  const packed = fillPlates(items, bed, area, blocked);
  const placements: Placement[] = new Array(items.length);
  for (let p = 0; p < plateCount(packed); p++) {
    const on = packed.flatMap((q, i) => (q.plate === p ? [i] : []));
    const mine = on.map((i) => items[i]);
    // A plate with room to spare looks tidier packed as if the zones weren't
    // there and then centred, when that happens to stay clear of them.
    const loose = fillPlates(mine, bed, area, []);
    const centred =
      (plateCount(loose) === 1 && centre(loose, mine, area, blocked, true)) ||
      centre(
        on.map((i) => packed[i]),
        mine,
        area,
        blocked,
        false,
      )!;
    on.forEach((i, k) => (placements[i] = { plate: p, ...centred[k] }));
  }
  return placements;
}

/** Back-left corners from the usable area's back-left corner, with y growing towards the front. */
type Packed = { plate: number; x: number; y: number };

/** The packing itself, without centring; see packPlates. */
function fillPlates(items: Footprint[], bed: Bed, area: Area, blocked: Area[]): Packed[] {
  const placed: Packed[] = [];
  let plate = 0;
  /** The current plate's rows, back to front, each with where its next label would go. */
  let rows: { y: number; depth: number; x: number }[] = [];
  /** The plate holds something too large to share it with. */
  let full = false;
  /** Where along a row a footprint fits, clear of the zones, if it does. */
  const fitInRow = (row: { y: number; x: number }, item: Footprint): number | undefined => {
    let x = row.x;
    // Each step moves right, so this ends; the bound is only a safeguard.
    for (let tries = 0; tries < 100 && x + item.width <= area.width; tries++) {
      const zone = hitsZone(blocked, area.x + x, area.y + area.depth - row.y, item);
      if (!zone) return x;
      x = Math.max(x + 1, zone.x + zone.width + PLATE_GAP - area.x);
    }
    return undefined;
  };
  for (const item of items) {
    const alone = tooLarge(item, bed);
    if (rows.length && (full || alone)) {
      plate++;
      rows = [];
    }
    // First fit: the first row with room, so short labels fill the gaps at the end of earlier rows.
    let spot: { row: (typeof rows)[number]; x: number } | undefined;
    for (const row of rows) {
      const x = item.depth <= row.depth ? fitInRow(row, item) : undefined;
      if (x !== undefined) {
        spot = { row, x };
        break;
      }
    }
    if (!spot) {
      const last = rows.at(-1);
      const y = last ? last.y + last.depth + PLATE_GAP : 0;
      if (rows.length && y + item.depth > area.depth) {
        plate++;
        rows = [];
      }
      const row = { y: rows.length ? y : 0, depth: item.depth, x: 0 };
      rows.push(row);
      // A row clear of the zones somewhere, or failing that, the left end.
      spot = { row, x: fitInRow(row, item) ?? 0 };
    }
    placed.push({ plate, x: spot.x, y: spot.row.y });
    spot.row.x = spot.x + item.width + PLATE_GAP;
    full = alone;
  }
  return placed;
}

/**
 * Centre one plate's packed layout on the plate, as far as that stays clear
 * of the zones, as centres from the plate's front-left corner. When `strict`,
 * give up rather than leave it uncentred or on a zone.
 */
function centre(
  packed: Packed[],
  items: Footprint[],
  area: Area,
  blocked: Area[],
  strict: boolean,
): { x: number; y: number }[] | undefined {
  const width = Math.max(0, ...packed.map((q, i) => q.x + items[i].width));
  const depth = Math.max(0, ...packed.map((q, i) => q.y + items[i].depth));
  const dx = Math.max(0, (area.width - width) / 2);
  const dy = Math.max(0, (area.depth - depth) / 2);
  const candidates: [number, number][] = strict
    ? [[dx, dy]]
    : [
        [dx, dy],
        [dx, 0],
        [0, dy],
        [0, 0],
      ];
  const clear = ([sx, sy]: [number, number]) =>
    packed.every((q, i) => !hitsZone(blocked, area.x + q.x + sx, area.y + area.depth - q.y - sy, items[i]));
  const shift = candidates.find(clear) ?? (strict ? undefined : [0, 0]);
  if (!shift) return undefined;
  return packed.map((q, i) => ({
    x: area.x + shift[0] + q.x + items[i].width / 2,
    y: area.y + area.depth - shift[1] - q.y - items[i].depth / 2,
  }));
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
