import type { Font, PathCommand } from "opentype.js";
import type { CrossSection, ManifoldToplevel, Vec2 } from "manifold-3d";

export type Align = "left" | "center" | "right";

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
 * Lay out one or more lines of text as a 2D shape with a cap height of 1 mm,
 * centered on its ink. Lines are aligned to each other by `align`.
 * Undefined when there is nothing to draw.
 */
export function textBlock(
  wasm: ManifoldToplevel,
  font: Font,
  text: string,
  align: Align,
  /** Distance between baselines, as a multiple of the cap height. */
  lineSpacing = 1.6,
): CrossSection | undefined {
  const lines = text.split("\n").map((l) => l.trim());
  if (lines.every((l) => l === "")) return undefined;

  const emSize = 1 / capHeightRatio(font);
  const widths = lines.map((l) => font.getAdvanceWidth(l, emSize));
  const blockWidth = Math.max(...widths);

  const polygons: Vec2[][] = [];
  lines.forEach((line, i) => {
    if (!line) return;
    const offset = align === "left" ? 0 : align === "right" ? blockWidth - widths[i] : (blockWidth - widths[i]) / 2;
    const path = font.getPath(line, offset, i * lineSpacing, emSize);
    polygons.push(...pathToPolygons(path.commands));
  });
  if (polygons.length === 0) return undefined;

  const shape = new wasm.CrossSection(polygons, "NonZero");
  const { min, max } = shape.bounds();
  return shape.translate(-(min[0] + max[0]) / 2, -(min[1] + max[1]) / 2);
}
