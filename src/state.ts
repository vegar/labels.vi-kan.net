import { DEFAULT_OPTIONS, isText, type LabelOptions, type Segment } from "./label";
import { migrateSymbol, symbolInfo, type LabelSymbol } from "./symbols";

export type Weight = "regular" | "bold";

export interface LabelState extends LabelOptions {
  /** Stable key for the label list; not part of the geometry. */
  id: string;
  weight: Weight;
  baseColor: string;
  textColor: string;
  symbolColor: string;
}

/** Every label being worked on, and the one open in the editor. */
export interface Session {
  labels: LabelState[];
  selected: string;
}

/** A single label, from the first releases. */
const LEGACY_STORAGE_KEY = "gridfinity-labels:v1";
const STORAGE_KEY = "gridfinity-labels:v2";

export const DEFAULT_STATE: Omit<LabelState, "id"> = {
  ...DEFAULT_OPTIONS,
  weight: "bold",
  baseColor: "#1f2328",
  textColor: "#f4f4f0",
  symbolColor: "#f4f4f0",
  segments: [
    { kind: "screw", headShape: "countersunk", drives: ["phillips"] },
    { kind: "text", text: "M3 × 12" },
  ],
};

/** The first release started with this bolt; swap it for the new default. */
const OLD_DEFAULT_SYMBOLS = JSON.stringify([{ kind: "cullbolt", headShape: "socket", drives: ["hex"] }]);

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

/** How labels were saved before text and symbols became segments. */
interface LegacyFields {
  text?: string;
  symbols?: LabelSymbol[];
  symbolPosition?: "left" | "right";
}

/** One text with a row of symbols beside it, as segments in the same order. */
function legacySegments({ text, symbols, symbolPosition }: LegacyFields): Segment[] {
  if (!Array.isArray(symbols) || JSON.stringify(symbols) === OLD_DEFAULT_SYMBOLS) {
    symbols = DEFAULT_STATE.segments.filter((s): s is LabelSymbol => !isText(s));
  }
  const textSegments: Segment[] = text?.trim() || !symbols.length ? [{ kind: "text", text: text ?? "" }] : [];
  return symbolPosition === "right" ? [...textSegments, ...symbols] : [...symbols, ...textSegments];
}

/** Fill in missing fields and migrate old symbols in a saved label. */
function restoreLabel(saved: Partial<LabelState> & LegacyFields): LabelState {
  const { text, symbols, symbolPosition, ...rest } = saved;
  const state: LabelState = { ...DEFAULT_STATE, id: newId(), ...rest };
  if (!Array.isArray(saved.segments)) state.segments = legacySegments({ text, symbols, symbolPosition });
  state.segments = state.segments.map((s) => (isText(s) ? s : migrateSymbol(s)));
  return state;
}

function singleLabel(label: LabelState): Session {
  return { labels: [label], selected: label.id };
}

/**
 * Restore a session from storage. Falls back to the single label saved by
 * earlier versions, and then to one default label.
 */
export function parseSession(saved: string | null, legacy: string | null): Session {
  try {
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<Session>;
      const labels = (parsed.labels ?? []).map(restoreLabel);
      if (labels.length) {
        const selected = labels.some((l) => l.id === parsed.selected) ? parsed.selected! : labels[0].id;
        return { labels, selected };
      }
    }
    if (legacy) return singleLabel(restoreLabel(JSON.parse(legacy)));
  } catch {
    // Corrupt storage: start over rather than fail to load.
  }
  return singleLabel({ ...DEFAULT_STATE, id: newId() });
}

export function loadSession(): Session {
  try {
    return parseSession(localStorage.getItem(STORAGE_KEY), localStorage.getItem(LEGACY_STORAGE_KEY));
  } catch {
    // Storage can be unavailable (private windows, blocked site data).
    return parseSession(null, null);
  }
}

export function saveSession(session: Session) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch {
    // Not critical; the labels just won't be remembered.
  }
}

/**
 * A blank label that keeps the size, print style and colours of `template`,
 * so a batch of labels comes out consistent.
 */
export function blankLabel(template: LabelState): LabelState {
  const { units, ribs, align, maxCapHeight, margin, style, textDepth, symbolSize } = template;
  const { weight, baseColor, textColor, symbolColor } = template;
  return {
    ...DEFAULT_STATE,
    id: newId(),
    segments: [{ kind: "text", text: "" }],
    ...{ units, ribs, align, maxCapHeight, margin, style, textDepth, symbolSize },
    ...{ weight, baseColor, textColor, symbolColor },
  };
}

/**
 * Texts typed into the clone dialog: one label per line, with "|" starting a
 * new line on the label. Blank lines are skipped.
 */
export function parseCloneTexts(input: string): string[] {
  return input
    .split("\n")
    .map((line) =>
      line
        .split("|")
        .map((part) => part.trim())
        .join("\n")
        .trim(),
    )
    .filter(Boolean);
}

/**
 * The segments with the first text replaced by `text`. A label with symbols
 * only gets the text added at the end.
 */
export function withText(segments: Segment[], text: string): Segment[] {
  const at = segments.findIndex(isText);
  if (at < 0) return [...segments, { kind: "text", text }];
  return segments.map((s, i) => (i === at ? { kind: "text", text } : s));
}

/**
 * Copies of label `id` with each of `texts`, inserted after it. Everything but
 * the first text is kept. Selects the first copy.
 */
export function cloneLabel(session: Session, id: string, texts: string[]): Session {
  const at = session.labels.findIndex((l) => l.id === id);
  if (at < 0 || !texts.length) return session;
  const source = session.labels[at];
  const copies = texts.map((text) => ({ ...source, id: newId(), segments: withText(source.segments, text) }));
  const labels = [...session.labels.slice(0, at + 1), ...copies, ...session.labels.slice(at + 1)];
  return { labels, selected: copies[0].id };
}

/** Insert `label` after the selected one and select it. */
export function addLabel(session: Session, label: LabelState): Session {
  const at = session.labels.findIndex((l) => l.id === session.selected) + 1;
  const labels = [...session.labels.slice(0, at), label, ...session.labels.slice(at)];
  return { labels, selected: label.id };
}

/** Remove a label, selecting its neighbour. The last label can't be removed. */
export function removeLabel(session: Session, id: string): Session {
  const at = session.labels.findIndex((l) => l.id === id);
  if (at < 0 || session.labels.length === 1) return session;
  const labels = session.labels.filter((l) => l.id !== id);
  const selected = session.selected === id ? labels[Math.min(at, labels.length - 1)].id : session.selected;
  return { labels, selected };
}

export function updateLabel(session: Session, id: string, patch: Partial<LabelState>): Session {
  return { ...session, labels: session.labels.map((l) => (l.id === id ? { ...l, ...patch } : l)) };
}

/** All the text on the label, on one line, with `lineBreak` between its lines. */
function textLine(state: LabelState, lineBreak: string): string {
  return state.segments
    .filter(isText)
    .map((s) => s.text.trim().replace(/\s*\n\s*/g, lineBreak))
    .filter(Boolean)
    .join(" ");
}

/** A short name for the label list: the text on one line, or its symbols. */
export function labelTitle(state: LabelState): string {
  const text = textLine(state, " · ");
  if (text) return text;
  const symbols = state.segments.filter((s): s is LabelSymbol => !isText(s));
  if (symbols.length === 1) return symbolInfo(symbols[0].kind).name;
  return symbols.length ? `${symbols.length} symbols` : "Blank";
}

/** A file name based on the label text, e.g. "label-M3-12-1u". */
export function fileName(state: LabelState): string {
  const slug = textLine(state, " ")
    .replace(/\s+/g, "-")
    .replace(/[^\p{L}\p{N}._-]+/gu, "")
    .slice(0, 40);
  return `label-${slug || "blank"}-${state.units}u`;
}
