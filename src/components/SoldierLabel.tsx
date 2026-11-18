import { useState, type DragEvent } from 'react';
import type { Row } from '../lib/layout';

interface Props {
  row: Row;
  displayName: string;
  onDragStart: (e: DragEvent) => void;
  onDragEnd: () => void;
  onMoveKey: (dir: -1 | 1) => void;
  onRename: (name: string) => Promise<void>;
}

export function SoldierLabel({ row, displayName, onDragStart, onDragEnd, onMoveKey, onRename }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const count = row.entries.length;
  const aliased = displayName !== row.person.displayName;

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onRename(value.trim());
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="g-label soldier-label" draggable={!editing} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <button
        type="button"
        className="grip"
        aria-label={`Move ${displayName}. Use the up and down arrows`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            onMoveKey(e.key === 'ArrowUp' ? -1 : 1);
          }
        }}
      >
        <svg aria-hidden="true" width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          {[3, 8, 13].map((y) => [2.5, 7.5].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />))}
        </svg>
      </button>
      <span className="avatar" aria-hidden="true">{displayName.charAt(0).toUpperCase()}</span>
      <span className="stack-tight grow min0">
        {editing ? (
          <input
            className="name-input"
            autoFocus
            aria-label={`Display name for ${row.person.displayName}`}
            value={value}
            disabled={saving}
            onChange={(e) => setValue(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                save();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                setEditing(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="name-btn"
            title="Change display name"
            aria-label={`Change the display name of ${displayName}`}
            onClick={() => {
              setValue(displayName);
              setEditing(true);
            }}
          >
            <span className="ellipsis">{displayName}</span>
            <svg className="pen" aria-hidden="true" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 2.5l2.5 2.5L5.5 13H3v-2.5z" />
            </svg>
          </button>
        )}
        <span className="small muted ellipsis">
          {aliased ? `${row.person.id}, ` : ''}
          {count ? `${count} ${count === 1 ? 'item' : 'items'}` : 'No items on the Gantt'}
        </span>
      </span>
    </div>
  );
}
