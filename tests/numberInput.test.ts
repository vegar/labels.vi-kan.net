import { describe, expect, it } from "vitest";
import { parseNumber } from "../src/sidebar/PropertyGrid";

describe("parseNumber", () => {
  it("accepts a decimal point or comma", () => {
    expect(parseNumber("4.5")).toBe(4.5);
    expect(parseNumber(" 4,5 ")).toBe(4.5);
  });

  it("is NaN for text that isn't a number yet", () => {
    for (const t of ["", "-", ".", "abc"]) expect(parseNumber(t)).toBeNaN();
  });
});
