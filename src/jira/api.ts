import { config } from '../config';
import { dayFromDateTime, parseDay, toIso, type Day } from '../lib/dates';
import { emptySettings, type Item, type Settings, type Sprint, type Status } from '../model';
import { jira, JiraError } from './client';

/* ------------------------------------------------------------------ fields */

export interface FieldIds {
  start: string;
  sprint: string;
  epicLink: string;
  epicColor: string | null;
}

interface JiraField {
  id: string;
  name: string;
}

/** Custom field ids differ per Jira instance, so look them up by name once. */
export async function resolveFields(): Promise<FieldIds> {
  const fields = await jira.get<JiraField[]>('/rest/api/2/field');
  const find = (names: string[]) =>
    fields.find((f) => names.some((n) => f.name.toLowerCase() === n.toLowerCase()))?.id ?? null;

  const start = find([config.fieldNames.startDate]);
  const sprint = find(config.fieldNames.sprint);
  const epicLink = find(config.fieldNames.epicLink);
  const missing = [
    !start && `"${config.fieldNames.startDate}" (start date, set VITE_JIRA_START_DATE_FIELD)`,
    !sprint && '"Sprint"',
    !epicLink && '"Epic Link"',
  ].filter(Boolean);
  if (missing.length) throw new Error(`These Jira fields were not found: ${missing.join(', ')}.`);

  return { start: start!, sprint: sprint!, epicLink: epicLink!, epicColor: find(config.fieldNames.epicColor) };
}

/* ----------------------------------------------------------------- sprints */

interface JiraSprint {
  id: number;
  name: string;
  state: string;
  startDate?: string;
  endDate?: string;
}

export async function fetchSprints(): Promise<Sprint[]> {
  const out: Sprint[] = [];
  let startAt = 0;
  for (;;) {
    const page = await jira.get<{ values: JiraSprint[]; isLast: boolean }>(
      `/rest/agile/1.0/board/${config.boardId}/sprint?state=active,future,closed&startAt=${startAt}&maxResults=50`,
    );
    for (const s of page.values) {
      out.push({ id: s.id, name: s.name, state: s.state, start: dayFromDateTime(s.startDate), end: dayFromDateTime(s.endDate) });
    }
    if (page.isLast || page.values.length === 0) break;
    startAt += page.values.length;
  }
  return out;
}

/* ------------------------------------------------------------------ issues */

interface RawIssue {
  key: string;
  fields: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

async function searchAll(jql: string, fields: string[]): Promise<RawIssue[]> {
  const out: RawIssue[] = [];
  let startAt = 0;
  for (;;) {
    const page = await jira.post<{ issues: RawIssue[]; total: number }>('/rest/api/2/search', {
      jql,
      fields,
      startAt,
      maxResults: 100,
    });
    out.push(...page.issues);
    startAt += page.issues.length;
    if (page.issues.length === 0 || startAt >= page.total) break;
  }
  return out;
}

function baseFields(F: FieldIds): string[] {
  return ['summary', 'issuetype', 'status', 'assignee', 'duedate', 'parent', F.start, F.epicLink, F.sprint, ...(F.epicColor ? [F.epicColor] : [])];
}

function mapStatus(status: { name: string; statusCategory?: { key: string } }): Status {
  if (config.blockedStatus.test(status.name)) return 'block';
  switch (status.statusCategory?.key) {
    case 'done':
      return 'done';
    case 'indeterminate':
      return 'prog';
    default:
      return 'todo';
  }
}

/**
 * Jira Server returns the Sprint field either as objects or as strings like
 * "com.atlassian.greenhopper.service.sprint.Sprint@1a2b[id=42,rapidViewId=7,state=ACTIVE,name=Sprint 23,…]".
 */
function sprintIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (v && typeof v === 'object' && 'id' in v) return Number((v as { id: unknown }).id);
      const m = typeof v === 'string' ? /\bid=(\d+)/.exec(v) : null;
      return m ? Number(m[1]) : NaN;
    })
    .filter((n) => Number.isFinite(n));
}

function toItem(raw: RawIssue, F: FieldIds): Item {
  const f = raw.fields;
  const isEpic = f.issuetype?.name === config.epicTypeName;
  return {
    key: raw.key,
    typeName: f.issuetype?.name ?? 'Issue',
    isEpic,
    isSubtask: Boolean(f.issuetype?.subtask),
    summary: f.summary ?? raw.key,
    status: mapStatus(f.status ?? { name: '' }),
    statusName: f.status?.name ?? '',
    assignee: f.assignee ? { id: f.assignee.name ?? f.assignee.key, displayName: f.assignee.displayName ?? f.assignee.name } : null,
    start: parseDay(f[F.start]),
    due: parseDay(f.duedate),
    epicKey: isEpic ? null : (f[F.epicLink] ?? null),
    parentKey: f.parent?.key ?? null,
    sprintIds: sprintIds(f[F.sprint]),
    epicColor: isEpic && F.epicColor ? (f[F.epicColor] ?? null) : null,
  };
}

const quote = (keys: string[]) => keys.map((k) => `"${k}"`).join(',');

export interface SprintData {
  items: Item[];
  epics: Item[];
}

/** Everything in the given sprints, plus the epics they belong to. */
export async function fetchSprintData(ids: number[], F: FieldIds): Promise<SprintData> {
  if (!ids.length) return { items: [], epics: [] };
  const fields = baseFields(F);
  const items = (await searchAll(`sprint in (${ids.join(',')}) ORDER BY Rank ASC`, fields))
    .map((r) => toItem(r, F))
    .filter((i) => !i.isEpic);

  // Sub-tasks carry no Epic Link of their own: inherit it from the parent.
  const byKey = new Map(items.map((i) => [i.key, i]));
  const missingParents = [...new Set(items.filter((i) => i.isSubtask && i.parentKey && !byKey.has(i.parentKey)).map((i) => i.parentKey!))];
  const parents = new Map(byKey);
  if (missingParents.length) {
    for (const r of await searchAll(`key in (${quote(missingParents)})`, [F.epicLink])) {
      parents.set(r.key, toItem(r, F));
    }
  }
  for (const i of items) {
    if (i.isSubtask && !i.epicKey && i.parentKey) i.epicKey = parents.get(i.parentKey)?.epicKey ?? null;
  }

  const epicKeys = [...new Set(items.map((i) => i.epicKey).filter((k): k is string => !!k))];
  const epics = epicKeys.length ? (await searchAll(`key in (${quote(epicKeys)})`, fields)).map((r) => toItem(r, F)) : [];
  return { items, epics };
}

export async function fetchIssue(key: string, F: FieldIds): Promise<Item> {
  const raw = await jira.get<RawIssue>(`/rest/api/2/issue/${encodeURIComponent(key)}?fields=${baseFields(F).join(',')}`);
  return toItem(raw, F);
}

export async function updateDates(key: string, F: FieldIds, start: Day | null, due: Day | null): Promise<void> {
  await jira.put(`/rest/api/2/issue/${encodeURIComponent(key)}`, {
    fields: { [F.start]: start == null ? null : toIso(start), duedate: due == null ? null : toIso(due) },
  });
}

export async function updateEpicColor(key: string, F: FieldIds, label: string | null): Promise<void> {
  if (!F.epicColor) throw new Error('The "Epic Colour" field was not found in this Jira.');
  await jira.put(`/rest/api/2/issue/${encodeURIComponent(key)}`, { fields: { [F.epicColor]: label } });
}

/* ---------------------------------------------------------------- settings */

const settingsPath = () =>
  `/rest/api/2/project/${encodeURIComponent(config.projectKey)}/properties/${encodeURIComponent(config.settingsProperty)}`;

export async function fetchSettings(): Promise<Settings> {
  try {
    const res = await jira.get<{ value: Partial<Settings> }>(settingsPath());
    return { ...emptySettings, ...res.value };
  } catch (e) {
    if (e instanceof JiraError && e.status === 404) return { ...emptySettings };
    throw e;
  }
}

/** Writing project properties needs project admin rights in Jira. */
export async function saveSettings(value: Settings): Promise<void> {
  await jira.put(settingsPath(), value);
}
