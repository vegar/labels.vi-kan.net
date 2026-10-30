import { describe, expect, it } from "vitest";
import { packPlates, plateColumns, plateCount, plateOrigin, tooLarge } from "../src/bed";

const bed = { width: 100, depth: 60 };
const item = (width: number, depth = 10) => ({ width, depth });

describe("packPlates", () => {
  it("centres a single item on the plate", () => {
    expect(packPlates([item(40)], bed)).toEqual([{ plate: 0, x: 50, y: 30 }]);
  });

  it("fills a column back to front, then the next column, then the next plate", () => {
    // 50 mm usable depth: three 10 mm items with 5 mm gaps (40 mm), a fourth won't fit.
    const placed = packPlates(
      Array.from({ length: 7 }, () => item(40)),
      bed,
    );
    expect(placed.map((p) => p.plate)).toEqual([0, 0, 0, 0, 0, 0, 1]);
    expect(placed[0].y).toBeGreaterThan(placed[1].y);
    expect(placed[3].x).toBeGreaterThan(placed[0].x);
    expect(placed[3].y).toBe(placed[0].y);
    // The plate's layout is centred: two 40 mm columns 5 mm apart are 85 mm wide.
    expect(placed[0].x).toBeCloseTo(7.5 + 20);
    expect(placed[3].x).toBeCloseTo(7.5 + 65);
    expect(plateCount(placed)).toBe(2);
  });

  it("gives an item too large for the plate a plate of its own", () => {
    const placed = packPlates([item(20), item(200), item(20)], bed);
    expect(placed.map((p) => p.plate)).toEqual([0, 1, 2]);
    expect(tooLarge(item(200), bed)).toBe(true);
    expect(tooLarge(item(90, 50), bed)).toBe(false);
  });
});

describe("plateOrigin", () => {
  it("matches Bambu Studio's grid of plates", () => {
    expect([1, 2, 3, 4, 5, 9, 10].map(plateColumns)).toEqual([1, 2, 2, 2, 3, 3, 4]);
    expect(plateOrigin(0, 3, bed)).toEqual([0, -0]);
    expect(plateOrigin(1, 3, bed)).toEqual([120, -0]);
    expect(plateOrigin(2, 3, bed)).toEqual([0, -72]);
  });
});
