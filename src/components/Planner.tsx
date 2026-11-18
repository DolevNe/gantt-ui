import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGantt } from '../hooks/useGantt';
import { fmtRange } from '../lib/dates';
import { buildRows, dayCells, isShown, spanOf, sprintRange } from '../lib/layout';
import type { Item } from '../model';
import { AddItemsDialog } from './AddItemsDialog';
import { ConfirmDialog, type Proposal } from './ConfirmDialog';
import { EpicColors } from './EpicColors';
import { Gantt } from './Gantt';
import { Legend } from './Legend';
import { SprintPicker } from './SprintPicker';

function useToast() {
  const [text, setText] = useState<string | null>(null);
  const timer = useRef<number>();
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const show = useCallback((t: string) => {
    window.clearTimeout(timer.current);
    setText(t);
    timer.current = window.setTimeout(() => setText(null), 4000);
  }, []);
  return [text, show] as const;
}

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function Planner({ user, onSignOut }: { user: string; onSignOut: () => void }) {
  const g = useGantt();
  const [picker, setPicker] = useState(true);
  const [adding, setAdding] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [toast, showToast] = useToast();

  const selectedSprints = useMemo(() => g.sprints.filter((s) => g.selected.includes(s.id)), [g.sprints, g.selected]);
  const sprintsById = useMemo(() => new Map(g.sprints.map((s) => [s.id, s])), [g.sprints]);
  const range = useMemo(() => sprintRange(selectedSprints), [selectedSprints]);
  const cells = useMemo(() => (range ? dayCells(range, selectedSprints) : []), [range, selectedSprints]);
  const span = useCallback((i: Item) => spanOf(i, sprintsById, range!), [sprintsById, range]);
  const rows = useMemo(() => (range ? buildRows(g.items, g.epics, g.settings, span) : []), [range, g.items, g.epics, g.settings, span]);

  const personName = useCallback((id: string, fallback: string) => g.settings.aliases[id] || fallback, [g.settings.aliases]);
  const itemPerson = useCallback((i: Item) => (i.assignee ? personName(i.assignee.id, i.assignee.displayName) : 'Unassigned'), [personName]);

  const shownCount = new Set(rows.flatMap((r) => r.entries.map((e) => e.item.key))).size;
  const total = g.items.length + g.epics.length;

  const title =
    selectedSprints.length === 0 ? 'Sprint Gantt' : selectedSprints.length === 1 ? selectedSprints[0].name : `${selectedSprints.length} sprints`;

  const settingsError = (e: unknown) =>
    showToast(`Not saved: ${message(e)}${/permission|refused|403/i.test(message(e)) ? ' Saving shared settings needs project admin rights.' : ''}`);

  if (g.boot.state === 'loading') return <main className="center-screen muted">Loading sprints and fields from Jira…</main>;
  if (g.boot.state === 'error') {
    return (
      <main className="center-screen">
        <div className="panel narrow stack">
          <h1 className="h2">Could not load from Jira</h1>
          <p className="error">{g.boot.message}</p>
          <div><button className="btn btn-quiet" onClick={() => window.location.reload()}>Try again</button></div>
        </div>
      </main>
    );
  }

  return (
    <div className="page">
      <div className="container stack">
        <header className="topbar">
          <div className="stack-tight">
            <h1 className="h1">{title}</h1>
            <div className="row-gap wrap muted">
              {range && <span>{fmtRange(range.start, range.end)}</span>}
              {g.issues.state === 'ready' && <span>{rows.length} soldiers, {shownCount} of {total} items shown</span>}
            </div>
          </div>
          <div className="row-gap wrap center">
            {g.selected.length > 0 && (
              <button className="btn btn-primary" onClick={() => setAdding(true)} disabled={g.issues.state !== 'ready'}>
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M8 3v10M3 8h10" /></svg>
                Add items
              </button>
            )}
            <button className="btn btn-outline" onClick={() => setPicker(true)}>Change sprints</button>
            {g.selected.length > 0 && <button className="btn btn-outline" onClick={g.reload} disabled={g.issues.state === 'loading'}>Refresh from Jira</button>}
            <button className="btn btn-link" onClick={onSignOut} title={`Signed in as ${user}`}>Sign out</button>
          </div>
        </header>

        {g.issues.state === 'idle' && (
          <section className="panel empty-state">
            <p className="muted">Choose sprints to build the Gantt from their issues.</p>
            <button className="btn btn-primary" onClick={() => setPicker(true)}>Choose sprints</button>
          </section>
        )}
        {g.issues.state === 'loading' && <section className="panel empty-state muted">Loading issues from Jira…</section>}
        {g.issues.state === 'error' && (
          <section className="panel empty-state">
            <p className="error">{g.issues.message}</p>
            <button className="btn btn-quiet" onClick={g.reload}>Try again</button>
          </section>
        )}
        {g.issues.state === 'ready' && !range && (
          <section className="panel empty-state muted">The selected sprints have no start or end dates in Jira. Set them on the board, then refresh.</section>
        )}

        {g.issues.state === 'ready' && range && (
          <>
            <div className="row-between wrap">
              <p className="small muted hint">
                Epics show by default. Drag a bar to move it, or drag an edge to change its start or end. Drag a soldier to reorder the rows.
                Nothing is sent to Jira until you confirm.
              </p>
              <Legend />
            </div>
            {g.canColorEpics && (
              <EpicColors
                epics={g.epics.filter((e) => rows.some((r) => r.entries.some((en) => en.item.key === e.key)))}
                onPick={async (epic, label) => {
                  try {
                    await g.saveEpicColor(epic.key, label);
                    showToast(`${epic.key} color updated in Jira`);
                  } catch (e) {
                    showToast(`Not saved: ${message(e)}`);
                  }
                }}
              />
            )}
            <Gantt
              range={range}
              cells={cells}
              sprints={selectedSprints}
              rows={rows}
              span={span}
              pending={proposal ? { key: proposal.item.key, start: proposal.start, end: proposal.end } : null}
              onPropose={(item, start, end) => setProposal({ item, start, end })}
              personName={personName}
              onReorder={(order) =>
                g.updateSettings((s) => ({ ...s, order })).catch(settingsError)
              }
              onRename={async (id, name) => {
                try {
                  await g.updateSettings((s) => {
                    const aliases = { ...s.aliases };
                    const original = rows.find((r) => r.person.id === id)?.person.displayName;
                    if (!name || name === original) delete aliases[id];
                    else aliases[id] = name;
                    return { ...s, aliases };
                  });
                  showToast(name ? 'Display name saved to Jira' : 'Back to the Jira name');
                } catch (e) {
                  settingsError(e);
                }
              }}
            />
          </>
        )}
      </div>

      {picker && (
        <SprintPicker
          sprints={g.sprints}
          initial={g.selected}
          canCancel={g.selected.length > 0}
          onCancel={() => setPicker(false)}
          onApply={(ids) => {
            setPicker(false);
            g.load(ids);
          }}
        />
      )}

      {adding && (
        <AddItemsDialog
          items={g.items}
          epics={g.epics}
          settings={g.settings}
          sprints={g.sprints}
          multiSprint={g.selected.length > 1}
          personName={itemPerson}
          onClose={() => setAdding(false)}
          onApply={async (draft) => {
            const visible = [...g.items, ...g.epics];
            let added = 0;
            let removed = 0;
            for (const i of visible) {
              const was = isShown(i, g.settings);
              if (draft.has(i.key) && !was) added++;
              if (!draft.has(i.key) && was) removed++;
            }
            await g.updateSettings((s) => {
              const keys = new Set(visible.map((i) => i.key));
              const shown = s.shown.filter((k) => !keys.has(k)).concat(g.items.filter((i) => draft.has(i.key)).map((i) => i.key));
              const hiddenEpics = s.hiddenEpics.filter((k) => !keys.has(k)).concat(g.epics.filter((e) => !draft.has(e.key)).map((e) => e.key));
              return { ...s, shown, hiddenEpics };
            });
            setAdding(false);
            const parts = [added && `${added} added`, removed && `${removed} removed`].filter(Boolean);
            showToast(parts.length ? `Gantt updated: ${parts.join(', ')}` : 'No changes to the Gantt');
          }}
        />
      )}

      {proposal && (
        <ConfirmDialog
          proposal={proposal}
          onCancel={() => setProposal(null)}
          onConfirm={async () => {
            await g.saveDates(proposal.item.key, proposal.start, proposal.end);
            setProposal(null);
            showToast(`${proposal.item.key} updated in Jira`);
          }}
        />
      )}

      <div role="status" aria-live="polite" className="toast-wrap">
        {toast && <div className="toast">{toast}</div>}
      </div>
    </div>
  );
}
