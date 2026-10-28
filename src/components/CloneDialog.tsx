import { useEffect, useRef, useState } from "react";
import { labelTitle, parseCloneTexts, type LabelState } from "../state";

interface Props {
  source: LabelState;
  onClone: (texts: string[]) => void;
  onClose: () => void;
}

/** Make many copies of a label at once, each with its own text. */
export function CloneDialog({ source, onClone, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [input, setInput] = useState("");
  const texts = parseCloneTexts(input);

  useEffect(() => {
    dialog.current?.showModal();
  }, []);

  const submit = () => {
    if (!texts.length) return;
    onClone(texts);
    onClose();
  };

  return (
    <dialog ref={dialog} className="clone-dialog" onClose={onClose}>
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <h2>Clone “{labelTitle(source)}”</h2>
        <label className="field">
          <span>
            Texts <small>(one label per line, | for a line break)</small>
          </span>
          <textarea
            autoFocus
            rows={8}
            spellCheck={false}
            placeholder={"M3 × 16\nM3 × 20\nM4 × 12 | Socket head"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit();
            }}
          />
        </label>
        <p className="hint">Each text replaces the first text on the label. Symbols, size, style and colours stay the same.</p>
        <div className="dialog-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary" disabled={!texts.length}>
            {texts.length > 1 ? `Add ${texts.length} labels` : "Add label"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
