import { config } from '../config';

export class JiraError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(config.apiBase + path, {
      credentials: 'include',
      ...init,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // Tells Jira this is not a form post, so its XSRF check does not block it.
        'X-Atlassian-Token': 'no-check',
        ...init.headers,
      },
    });
  } catch {
    throw new JiraError(0, 'Could not reach Jira. Check the network and the /jira proxy.');
  }

  const text = await res.text();
  if (!res.ok) {
    throw new JiraError(res.status, errorMessage(res, text));
  }
  return (text ? JSON.parse(text) : undefined) as T;
}

function errorMessage(res: Response, text: string): string {
  try {
    const body = JSON.parse(text) as { errorMessages?: string[]; errors?: Record<string, string> };
    const parts = [...(body.errorMessages ?? []), ...Object.values(body.errors ?? {})];
    if (parts.length) return parts.join(' ');
  } catch {
    /* not JSON */
  }
  if (res.status === 401) return 'Your Jira session has ended. Sign in again.';
  if (res.status === 403) return 'Jira refused this action. You may not have permission.';
  return `Jira returned ${res.status} ${res.statusText}`.trim();
}

export const jira = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
