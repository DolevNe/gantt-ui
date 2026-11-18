import { useState } from 'react';
import { fmtRange, today } from '../lib/dates';
import type { Sprint } from '../model';
import { Dialog } from './Dialog';

interface Props {
  sprints: Sprint[];
  initial: number[];
  canCancel: boolean;
  onApply: (ids: number[]) => void;
  onCancel: () => void;
}

/** Shows active and future sprints plus the last three closed ones. */
export function SprintPicker({ sprints, initial, canCancel, onApply, onCancel }: Props) {
  const closed = sprints.filter((s) => s.state === 'closed').slice(-3);
  const open = sprints.filter((s) => s.state !== 'closed');
  const list = [...closed, ...open];
  const now = today();
  const active = sprints.find((s) => s.state === 'active');
  const [choice, setChoice] = useState<number[]>(initial.length ? initial : active ? [active.id] : []);

  const toggle = (id: number) => setChoice((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
  const label = choice.length > 1 ? `Show ${choice.length} sprints` : choice.length === 1 ? 'Show Gantt' : 'Pick at least one sprint';

  return (
    <Dialog
      title="Which sprints should the Gantt show?"
      description="Pick one or more. Soldiers come from each issue’s assignee, and dates come from the issues themselves."
      onClose={canCancel ? onCancel : undefined}
      footer={
        <>
          <button className="btn btn-primary" disabled={!choice.length} onClick={() => onApply(choice)}>{label}</button>
          {canCancel && <button className="btn btn-quiet" onClick={onCancel}>Cancel</button>}
        </>
      }
    >
      {list.length === 0 && <p className="muted">This board has no sprints yet.</p>}
      <div role="group" aria-label="Sprints" className="option-list">
        {list.map((s) => {
          const on = choice.includes(s.id);
          const current = s.start != null && s.end != null && now >= s.start && now <= s.end;
          return (
            <button key={s.id} type="button" role="checkbox" aria-checked={on} className={on ? 'option is-on' : 'option'} onClick={() => toggle(s.id)}>
              <span className="option-main">
                <span className="checkbox" aria-hidden="true">
                  {on && <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 6.2l2.3 2.3 4.7-5" /></svg>}
                </span>
                <span className="stack-tight">
                  <span className="strong">{s.name}{current ? ' (current)' : ''}</span>
                  <span className="small muted">{s.start != null && s.end != null ? fmtRange(s.start, s.end) : 'No dates set in Jira'}</span>
                </span>
              </span>
              <span className="small muted">{s.state === 'closed' ? 'Closed' : s.state === 'active' ? 'Active' : 'Future'}</span>
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
