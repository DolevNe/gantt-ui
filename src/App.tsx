import { useEffect, useState } from 'react';
import { Login } from './components/Login';
import { Planner } from './components/Planner';
import { configProblems } from './config';
import { getSession, logout, type Session } from './jira/auth';

type Auth = { state: 'checking' } | { state: 'out'; error?: string } | { state: 'in'; session: Session };

export function App() {
  const [auth, setAuth] = useState<Auth>({ state: 'checking' });
  const problems = configProblems();

  useEffect(() => {
    getSession()
      .then((s) => setAuth(s ? { state: 'in', session: s } : { state: 'out' }))
      .catch((e: Error) => setAuth({ state: 'out', error: e.message }));
  }, []);

  if (problems.length) {
    return (
      <main className="center-screen">
        <div className="panel narrow">
          <h1 className="h2">The app is not configured</h1>
          <ul className="muted">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
          <p className="muted">Copy .env.example to .env, fill it in and restart.</p>
        </div>
      </main>
    );
  }

  if (auth.state === 'checking') return <main className="center-screen muted">Connecting to Jira…</main>;
  if (auth.state === 'out') return <Login initialError={auth.error} onSignedIn={(session) => setAuth({ state: 'in', session })} />;

  return (
    <Planner
      user={auth.session.name}
      onSignOut={async () => {
        await logout();
        setAuth({ state: 'out' });
      }}
    />
  );
}
