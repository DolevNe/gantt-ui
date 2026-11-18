import { useState } from 'react';
import { EPIC_COLORS, epicHex } from '../lib/colors';
import type { Item } from '../model';

interface Props {
  epics: Item[];
  onPick: (epic: Item, label: string) => Promise<void>;
}

export function EpicColors({ epics, onPick }: Props) {
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!epics.length) return null;

  const pick = async (epic: Item, label: string) => {
    setBusy(true);
    try {
      await onPick(epic, label);
      setOpen(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="group" aria-label="Epic colors" className="row-gap wrap center">
      <span className="small muted">Epic colors</span>
      {epics.map((ep) => {
        const hex = epicHex(ep.epicColor);
        const isOpen = open === ep.key;
        return (
          <div key={ep.key} className="relative">
            <button className="chip" aria-expanded={isOpen} aria-label={`Color for epic ${ep.summary}`} onClick={() => setOpen(isOpen ? null : ep.key)}>
              <span className="dot" aria-hidden="true" style={hex ? { background: hex } : { border: '1.5px dashed #6F7F8C' }} />
              {ep.summary}
            </button>
            {isOpen && (
              <div role="dialog" aria-label={`Color for epic ${ep.summary}`} className="popover" onKeyDown={(e) => e.key === 'Escape' && setOpen(null)}>
                {EPIC_COLORS.map((c) => {
                  const on = ep.epicColor === c.label;
                  return (
                    <button
                      key={c.label}
                      className="swatch"
                      aria-label={c.name}
                      aria-pressed={on}
                      disabled={busy}
                      style={{ background: c.hex, boxShadow: on ? `0 0 0 2px #fff, 0 0 0 4px ${c.hex}` : 'none' }}
                      onClick={() => pick(ep, c.label)}
                    />
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
