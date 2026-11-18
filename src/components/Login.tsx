import { useState, type FormEvent } from 'react';
import { getSession, login, type Session } from '../jira/auth';

export function Login({ initialError, onSignedIn }: { initialError?: string; onSignedIn: (s: Session) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError ?? '');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(username, password);
      const s = await getSession();
      if (!s) throw new Error('Jira accepted the sign-in but no session was created. Check the proxy cookie settings.');
      onSignedIn(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="center-screen">
      <form className="panel narrow stack" onSubmit={submit}>
        <div className="stack-tight">
          <h1 className="h2">Sign in with your Jira account</h1>
          <p className="muted">Changes you make in the Gantt are saved to Jira under your name.</p>
        </div>
        <label className="field">
          Username
          <input className="input" autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
        </label>
        <label className="field">
          Password
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <div>
          <button className="btn btn-primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        </div>
      </form>
    </main>
  );
}
