interface Option<T extends string | number> {
  value: T;
  label: string;
}

interface Props<T extends string | number> {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

/** A row of buttons that behave like radio buttons. */
export function Segmented<T extends string | number>({ value, options, onChange }: Props<T>) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
