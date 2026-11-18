import { jira, JiraError } from './client';

export interface Session {
  name: string;
}

/** Returns the current session, or null if not signed in. */
export async function getSession(): Promise<Session | null> {
  try {
    return await jira.get<Session>('/rest/auth/1/session');
  } catch (e) {
    if (e instanceof JiraError && e.status === 401) return null;
    throw e;
  }
}

/** Cookie-based login. The JSESSIONID cookie is set by Jira through the proxy. */
export async function login(username: string, password: string): Promise<void> {
  await jira.post('/rest/auth/1/session', { username, password });
}

export async function logout(): Promise<void> {
  try {
    await jira.del('/rest/auth/1/session');
  } catch {
    /* already gone */
  }
}
