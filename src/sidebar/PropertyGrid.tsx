import { useEffect, useRef, useState, type ReactNode } from "react";

/** A two-column table of names and editors, in collapsible categories. */
export function PropertyGrid({ children }: { children: ReactNode }) {
  return <table className="property-grid">{children}</table>;
}

export function Category({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <tbody>
      <tr className="category">
        <th colSpan={2}>
          <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "▾" : "▸"} {title}
          </button>
        </th>
      </tr>
      {open && children}
    </tbody>
  );
}

export function Prop({ name, children, title }: { name: string; children: ReactNode; title?: string }) {
  return (
    <tr>
      <th scope="row" title={title}>
        {name}
      </th>
      <td>{children}</td>
    </tr>
  );
}

/** A full-width row, for warnings and notes. */
export function Note({ children, warn }: { children: ReactNode; warn?: boolean }) {
  return (
    <tr className="note">
      <td colSpan={2} className={warn ? "warn" : undefined}>
        {children}
      </td>
    </tr>
  );
}

export function Select<T extends string | number>({
  value,
  options,
  onChange,
  disabled,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <select
      value={String(value)}
      disabled={disabled}
      onChange={(e) => onChange(options.find((o) => String(o.value) === e.target.value)!.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Parses what the user typed, accepting a decimal comma. NaN when it isn't a number yet. */
export function parseNumber(text: string): number {
  const t = text.trim().replace(",", ".");
  return t === "" || t === "-" || t === "." ? NaN : Number(t);
}

/**
 * A number field with - and + buttons. While the field has focus it edits its own text, so it can be
 * emptied and retyped (a controlled number input snaps back to the old value when cleared). Values in
 * range apply as you type; the text is clamped and tidied when the field loses focus or on Enter.
 */
export function NumberInput({
  value,
  min,
  max,
  step,
  unit = "mm",
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = +value.toFixed(2);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const decimals = (String(step).split(".")[1] ?? "").length;
  const nudge = (dir: 1 | -1) => {
    // Snap to the step grid so 2.37 + 0.1 gives 2.4, not 2.47.
    const n = Math.round((Math.round(value / step) + dir) * step * 10 ** decimals) / 10 ** decimals;
    onChange(clamp(n));
  };
  const commit = () => {
    if (draft === null) return;
    const n = parseNumber(draft);
    if (Number.isFinite(n) && clamp(n) !== value) onChange(clamp(n));
    setDraft(null);
  };

  return (
    <span className="number">
      <button type="button" className="step" aria-label="Decrease" disabled={value <= min} onClick={() => nudge(-1)}>
        −
      </button>
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={draft ?? String(shown)}
        onFocus={(e) => {
          setDraft(String(shown));
          e.target.select();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = parseNumber(e.target.value);
          if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
          else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
            e.preventDefault();
            nudge(e.key === "ArrowUp" ? 1 : -1);
            setDraft(null);
          }
        }}
      />
      <button type="button" className="step" aria-label="Increase" disabled={value >= max} onClick={() => nudge(1)}>
        +
      </button>
      <small>{unit}</small>
    </span>
  );
}

export function Check({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />;
}

export interface IconOption<T> {
  value: T;
  label: string;
  icon?: ReactNode;
}

/**
 * A dropdown whose options carry a picture, which a native select can't show.
 * The closed button shows the current option's picture and name.
 */
export function IconSelect<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: IconOption<T>[];
  onChange: (value: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="icon-select" ref={root}>
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="option-icon">{current.icon}</span>
        <span className="option-label">{current.label}</span>
        <span className="caret">▾</span>
      </button>
      {open && (
        <ul role="listbox">
          {options.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                role="option"
                aria-selected={o.value === value}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                <span className="option-icon">{o.icon}</span>
                <span className="option-label">{o.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A checkbox with a picture of what it does. */
export function IconCheck({
  checked,
  onChange,
  icon,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon?: ReactNode;
}) {
  return (
    <label className="icon-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="option-icon">{icon}</span>
    </label>
  );
}
