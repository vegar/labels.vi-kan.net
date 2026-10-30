import { useEffect, useState } from "react";
import { CUSTOM_PRINTER, DEFAULT_PRINTER, PRINTERS, type PrinterChoice } from "../bed";
import { NumberInput } from "../sidebar/PropertyGrid";

const STORAGE_KEY = "gridfinity-labels:printer";
const DEFAULT_CHOICE: PrinterChoice = { id: DEFAULT_PRINTER, custom: { width: 256, depth: 256 } };

function loadChoice(): PrinterChoice {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<PrinterChoice> | null;
    if (!saved) return DEFAULT_CHOICE;
    const known = saved.id === CUSTOM_PRINTER || PRINTERS.some((p) => p.id === saved.id);
    return { id: known ? saved.id! : DEFAULT_PRINTER, custom: { ...DEFAULT_CHOICE.custom, ...saved.custom } };
  } catch {
    // Storage can be unavailable (private windows, blocked site data), or hold something old.
    return DEFAULT_CHOICE;
  }
}

/** The printer the user prints on, remembered between visits. It belongs to the device, not the labels. */
export function usePrinter() {
  const [choice, setChoice] = useState(loadChoice);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(choice));
    } catch {
      // Not critical; the printer just won't be remembered.
    }
  }, [choice]);
  return [choice, setChoice] as const;
}

const vendors = [...new Set(PRINTERS.map((p) => p.vendor))];

interface Props {
  choice: PrinterChoice;
  onChange: (choice: PrinterChoice) => void;
  /** Plates the labels need on this printer. */
  plates: number;
  /** Labels larger than the plate. */
  tooLarge: number;
}

/** Pick the printer, or type in a bed size, and see how many plates the labels take. */
export function PrinterPicker({ choice, onChange, plates, tooLarge }: Props) {
  return (
    <div className="printer">
      <label>
        <span>Printer</span>
        <select value={choice.id} onChange={(e) => onChange({ ...choice, id: e.target.value })}>
          {vendors.map((vendor) => (
            <optgroup key={vendor} label={vendor}>
              {PRINTERS.filter((p) => p.vendor === vendor).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.vendor} {p.name} ({p.bed.width}×{p.bed.depth})
                </option>
              ))}
            </optgroup>
          ))}
          <option value={CUSTOM_PRINTER}>Custom bed size…</option>
        </select>
      </label>
      {choice.id === CUSTOM_PRINTER && (
        <div className="custom-bed">
          <NumberInput
            value={choice.custom.width}
            min={50}
            max={1000}
            step={1}
            onChange={(width) => onChange({ ...choice, custom: { ...choice.custom, width } })}
          />
          ×
          <NumberInput
            value={choice.custom.depth}
            min={50}
            max={1000}
            step={1}
            onChange={(depth) => onChange({ ...choice, custom: { ...choice.custom, depth } })}
          />
        </div>
      )}
      <small className={tooLarge ? "warn" : undefined}>
        {tooLarge
          ? `${tooLarge === 1 ? "One label is" : `${tooLarge} labels are`} larger than the plate.`
          : plates === 1
            ? "Fits on one plate."
            : `Needs ${plates} plates. The 3MF puts the rest beside the first plate, where a slicer adds its next plates.`}
      </small>
    </div>
  );
}
