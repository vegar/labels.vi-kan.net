import type { Font, PathCommand } from "opentype.js";
import type { CrossSection, ManifoldToplevel, Vec2 } from "manifold-3d";

export type Align = "left" | "center" | "right";

export interface TextLayoutOptions {
  lines: string[];
  align: Align;
  /** Area the text must fit in, in mm. */
  areaWidth: number;
  areaHeight: number;
  /** Largest allowed capital-letter height, in mm. Text shrinks below this to fit. */
  maxCapHeight: number;
  /** Distance between baselines, as a multiple of the cap height. */
  lineSpacing?: number;
}

export interface TextLayout {
  shape: CrossSection;
  /** The cap height actually used after fitting, in mm. */
  capHeight: number;
}

const CURVE_STEPS = 8;

/** Convert an opentype.js path (y down) into closed polygons (y up). */
function pathToPolygons(commands: PathCommand[]): Vec2[][] {
  const polygons: Vec2[][] = [];
  let current: Vec2[] = [];
  let x = 0;
  let y = 0;
  const push = (px: number, py: number) => {
    current.push([px, -py]);
    x = px;
    y = py;
  };
  const close = () => {
    if (current.length >= 3) polygons.push(current);
    current = [];
  };

  for (const cmd of commands) {
    switch (cmd.type) {
      case "M":
        close();
        push(cmd.x, cmd.y);
        break;
      case "L":
        push(cmd.x, cmd.y);
        break;
      case "Q": {
        const [x0, y0] = [x, y];
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          const u = 1 - t;
          push(
            u * u * x0 + 2 * u * t * cmd.x1 + t * t * cmd.x,
            u * u * y0 + 2 * u * t * cmd.y1 + t * t * cmd.y,
          );
        }
        break;
      }
      case "C": {
        const [x0, y0] = [x, y];
        for (let i = 1; i <= CURVE_STEPS; i++) {
          const t = i / CURVE_STEPS;
          const u = 1 - t;
          push(
            u * u * u * x0 + 3 * u * u * t * cmd.x1 + 3 * u * t * t * cmd.x2 + t * t * t * cmd.x,
            u * u * u * y0 + 3 * u * u * t * cmd.y1 + 3 * u * t * t * cmd.y2 + t * t * t * cmd.y,
          );
        }
        break;
      }
      case "Z":
        close();
        break;
    }
  }
  close();
  return polygons;
}

export function capHeightRatio(font: Font): number {
  const os2 = font.tables.os2 as { sCapHeight?: number } | undefined;
  return (os2?.sCapHeight || font.unitsPerEm * 0.7) / font.unitsPerEm;
}

/**
 * Lay out one or more lines of text as a 2D shape centered on the origin,
 * scaled down as needed to fit the given area.
 */
export function layoutText(
  wasm: ManifoldToplevel,
  font: Font,
  opts: TextLayoutOptions,
): TextLayout | undefined {
  const lines = opts.lines.map((l) => l.trim());
  if (lines.every((l) => l === "")) return undefined;

  // Lay out at cap height = 1 mm, then scale the whole block.
  const emSize = 1 / capHeightRatio(font);
  const pitch = opts.lineSpacing ?? 1.6;
  const widths = lines.map((l) => font.getAdvanceWidth(l, emSize));
  const blockWidth = Math.max(...widths);

  const polygons: Vec2[][] = [];
  lines.forEach((line, i) => {
    if (!line) return;
    const offset =
      opts.align === "left" ? 0 : opts.align === "right" ? blockWidth - widths[i] : (blockWidth - widths[i]) / 2;
    const path = font.getPath(line, offset, i * pitch, emSize);
    polygons.push(...pathToPolygons(path.commands));
  });
  if (polygons.length === 0) return undefined;

  let shape = new wasm.CrossSection(polygons, "NonZero");
  const bounds = shape.bounds();
  const inkWidth = bounds.max[0] - bounds.min[0];
  const inkHeight = bounds.max[1] - bounds.min[1];

  const scale = Math.min(
    opts.maxCapHeight,
    inkWidth > 0 ? opts.areaWidth / inkWidth : Infinity,
    inkHeight > 0 ? opts.areaHeight / inkHeight : Infinity,
  );

  // Center the block vertically on its ink. Horizontally, align the block to
  // the area edge (or center) using the ink extents.
  const cy = (bounds.min[1] + bounds.max[1]) / 2;
  let tx: number;
  if (opts.align === "left") tx = -opts.areaWidth / 2 / scale - bounds.min[0];
  else if (opts.align === "right") tx = opts.areaWidth / 2 / scale - bounds.max[0];
  else tx = -(bounds.min[0] + bounds.max[0]) / 2;

  shape = shape.translate(tx, -cy).scale(scale);
  return { shape, capHeight: scale };
}
