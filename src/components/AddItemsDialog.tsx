import { useMemo, useState } from 'react';
import { fmt } from '../lib/dates';
import { isShown } from '../lib/layout';
import type { Item, Settings, Sprint } from '../model';
import { Dialog } from './Dialog';

type Filter = 'all' | 'epic' | 'story' | 'task' | 'sub';
const FILTERS: [Filter, string][] = [['all', 'All'], ['epic', 'Epics'], ['story', 'Stories'], ['task', 'Tasks'], ['sub', 'Sub-tasks']];

function kind(i: Item): Filter {
  if (i.isEpic) return 'epic';
  if (i.isSubtask) return 'sub';
  return i.typeName.toLowerCase() === 'story' ? 'story' : 'task';
}

interface Props {
  items: Item[];
  epics: Item[];
  settings: Settings;
  sprints: Sprint[];
  multiSprint: boolean;
  personName: (i: Item) => string;
  onApply: (shown: Set<string>) => Promise<void>;
  onClose: () => void;
}

export function AddItemsDialog({ items, epics, settings, sprints, multiSprint, personName, onApply, onClose }: Props) {
  const [draft, setDraft] = useState(() => new Set([...epics, ...items].filter((i) => isShown(i, settings)).map((i) => i.key)));
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const sprintName = useMemo(() => new Map(sprints.map((s) => [s.id, s.name])), [sprints]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const match = (i: Item) =>
      (filter === 'all' || kind(i) === filter) && (!needle || i.summary.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle));
    const out: { item: Item; depth: number }[] = [];
    const epicKeys = new Set(epics.map((e) => e.key));
    for (const ep of epics) {
      if (match(ep)) out.push({ item: ep, depth: 0 });
      for (const c of items.filter((i) => i.epicKey === ep.key)) if (match(c)) out.push({ item: c, depth: filter === 'all' ? 1 : 0 });
    }
    for (const c of items.filter((i) => !i.epicKey || !epicKeys.has(i.epicKey))) if (match(c)) out.push({ item: c, depth: 0 });
    return out;
  }, [items, epics, q, filter]);

  const toggle = (key: string) =>
    setDraft((d) => {
      const n = new Set(d);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const apply = async () => {
    setBusy(true);
    setError('');
    try {
      await onApply(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      wide
      title="What should the Gantt show?"
      description="Every item in the selected sprints, grouped by epic. Check to add, uncheck to remove. An epic shows automatically for every soldier who has an item under it."
      onClose={onClose}
      footer={
        <>
          <div className="row-gap">
            <button className="btn btn-primary" onClick={apply} disabled={busy}>{busy ? 'Saving to Jira…' : 'Update Gantt'}</button>
            <button className="btn btn-quiet" onClick={onClose}>Cancel</button>
          </div>
          <span className="small muted push">{draft.size} of {items.length + epics.length} selected</span>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          Search by name or key
          <input className="input" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="For example: vault" />
        </label>
        <div role="group" aria-label="Filter by type" className="row-gap wrap">
          {FILTERS.map(([f, label]) => (
            <button key={f} className={filter === f ? 'chip is-on' : 'chip'} aria-pressed={filter === f} onClick={() => setFilter(f)}>{label}</button>
          ))}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        <div className="pick-list">
          {rows.map(({ item, depth }) => (
            <label key={item.key} className="pick-row" style={{ paddingLeft: 12 + depth * 28 }}>
              <input type="checkbox" checked={draft.has(item.key)} onChange={() => toggle(item.key)} />
              <span className="stack-tight grow min0">
                <span className={item.isEpic ? 'strong ellipsis' : 'ellipsis'}>{item.summary}</span>
                <span className="small muted row-gap wrap">
                  <span>{item.typeName}{multiSprint && item.sprintIds.length ? `, ${item.sprintIds.map((id) => sprintName.get(id)).filter(Boolean).join(', ')}` : ''}</span>
                  <span>{item.key}</span>
                  <span>{personName(item)}</span>
                  <span>{item.start == null && item.due == null ? 'No dates' : `${fmt(item.start)} – ${fmt(item.due)}`}</span>
                </span>
              </span>
            </label>
          ))}
          {rows.length === 0 && <p className="muted empty">No items match. Try another word or a different type.</p>}
        </div>
      </div>
    </Dialog>
  );
}
