import { labelTitle, type LabelState } from "../state";

interface Props {
  labels: LabelState[];
  selected: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onDuplicate: (id: string) => void;
  onRemove: (id: string) => void;
}

/** All labels in this session. Click one to edit it. */
export function LabelList({ labels, selected, onSelect, onAdd, onDuplicate, onRemove }: Props) {
  return (
    <section>
      <h2>
        Labels <small>({labels.length})</small>
      </h2>
      <ul className="label-list">
        {labels.map((label) => (
          <li key={label.id} aria-current={label.id === selected}>
            <button type="button" className="label-pick" onClick={() => onSelect(label.id)}>
              <span className="swatch" style={{ background: label.baseColor, color: label.textColor }}>
                {label.units}U
              </span>
              <span className="label-title">{labelTitle(label)}</span>
            </button>
            <div className="symbol-actions">
              <button type="button" title="Duplicate" aria-label="Duplicate" onClick={() => onDuplicate(label.id)}>
                ⧉
              </button>
              <button
                type="button"
                title="Remove"
                aria-label="Remove"
                disabled={labels.length === 1}
                onClick={() => onRemove(label.id)}
              >
                ✕
              </button>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="add-label" onClick={onAdd}>
        + Add label
      </button>
    </section>
  );
}
