import { useState, type ReactNode } from "react";

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
  return (
    <span className="number">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={+value.toFixed(2)}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
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
