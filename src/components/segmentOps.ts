import { isText, symbolSegment, textSegment, type Segment, type SymbolSegment } from "../label";
import { DRIVES, SYMBOLS, symbolInfo, type SymbolKind } from "../symbols";

export function replaceSegment(segments: Segment[], i: number, seg: Segment): Segment[] {
  return segments.map((s, j) => (j === i ? seg : s));
}

export function moveSegment(segments: Segment[], i: number, by: number): Segment[] {
  const next = [...segments];
  const [s] = next.splice(i, 1);
  next.splice(i + by, 0, s);
  return next;
}

export function removeSegment(segments: Segment[], i: number): Segment[] {
  return segments.filter((_, j) => j !== i);
}

/** A new segment of `kind`, styled like the last one of its kind in `segments`. */
export function newSegment(kind: "text" | SymbolKind, segments: Segment[] = []): Segment {
  if (kind === "text") return textSegment("", segments.filter(isText).at(-1));
  const like = segments.filter((s): s is SymbolSegment => !isText(s)).at(-1);
  return symbolSegment(SYMBOLS.find((s) => s.kind === kind)!.defaults, like);
}

/** The segment's name: "Text" or the symbol's name. */
export function segmentName(seg: Segment): string {
  return isText(seg) ? "Text" : symbolInfo(seg.kind).name;
}

export const HEAD_LABELS = {
  pan: "Pan",
  socket: "Socket",
  countersunk: "Countersunk",
  round: "Round",
  wafer: "Wafer",
} as const;

const NUTS: Record<string, string> = { regular: "Hex", lock: "Lock", square: "Square", tnut: "T-nut" };

/** A one-line description, e.g. "“M3 × 12”" or "Countersunk · Phillips". */
export function segmentSummary(seg: Segment): string {
  if (isText(seg)) return seg.text.trim() ? `“${seg.text.trim().replace(/\s*\n\s*/g, " · ")}”` : "(empty)";
  const parts: string[] = [];
  if (seg.kind === "screw") {
    if (seg.style === "cullenect") parts.push("Cullenect");
    if (seg.hexHead) parts.push("Hex head");
    else if (seg.view !== "drive") parts.push(HEAD_LABELS[seg.headShape ?? "pan"]);
    const drive = seg.drives?.find((d) => d !== "security");
    if (drive && !seg.hexHead) parts.push(DRIVES.find((d) => d.value === drive)?.label ?? drive);
  } else if (seg.kind === "bolt") {
    parts.push(HEAD_LABELS[seg.headShape ?? "pan"], `${seg.length ?? 10} mm`);
  } else if (seg.kind === "nut") {
    parts.push(NUTS[seg.nutType ?? "regular"]);
  }
  return parts.join(" · ");
}
