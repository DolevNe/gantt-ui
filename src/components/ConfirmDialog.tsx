import { useState } from 'react';
import { fmt, type Day } from '../lib/dates';
import type { Item } from '../model';
import { Dialog } from './Dialog';

export interface Proposal {
  item: Item;
  start: Day;
  end: Day;
}

function Change({ label, from, to }: { label: string; from: Day | null; to: Day }) {
  return (
    <>
      <dt className="muted">{label}</dt>
      <dd>
        {from === to ? (
          <>
            {fmt(from)} <span className="muted">No change</span>
          </>
        ) : (
          <>
            {fmt(from)} <span className="muted" aria-label="to">→</span> <strong className="accent">{fmt(to)}</strong>
          </>
        )}
      </dd>
    </>
  );
}

export function ConfirmDialog({ proposal, onConfirm, onCancel }: { proposal: Proposal; onConfirm: () => Promise<void>; onCancel: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { item } = proposal;

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Dialog
      role="alertdialog"
      title="Update Jira?"
      description={`${item.key} ${item.summary}`}
      onClose={busy ? undefined : onCancel}
      footer={
        <>
          <button className="btn btn-primary" onClick={confirm} disabled={busy}>{busy ? 'Updating…' : 'Update in Jira'}</button>
          <button className="btn btn-quiet" onClick={onCancel} disabled={busy}>Undo change</button>
        </>
      }
    >
      <dl className="changes">
        <Change label="Start" from={item.start} to={proposal.start} />
        <Change label="End" from={item.due} to={proposal.end} />
      </dl>
      {error && <p className="error" role="alert">{error}</p>}
    </Dialog>
  );
}
