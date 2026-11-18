import type { Day } from './lib/dates';

export type Status = 'todo' | 'prog' | 'done' | 'block';

export interface Person {
  /** Jira username (assignee.name) — stable key for rows and settings. */
  id: string;
  /** Jira display name. */
  displayName: string;
}

export interface Item {
  key: string;
  typeName: string;
  isEpic: boolean;
  isSubtask: boolean;
  summary: string;
  status: Status;
  statusName: string;
  assignee: Person | null;
  start: Day | null;
  due: Day | null;
  /** Epic this item belongs to (for sub-tasks: the parent's epic). */
  epicKey: string | null;
  parentKey: string | null;
  sprintIds: number[];
  /** Epic only: Jira epic colour label, e.g. 'ghx-label-4'. */
  epicColor: string | null;
}

export interface Sprint {
  id: number;
  name: string;
  state: 'active' | 'future' | 'closed' | string;
  start: Day | null;
  end: Day | null;
}

/** Shared settings, stored as a Jira project property. */
export interface Settings {
  /** username → display name shown in the Gantt */
  aliases: Record<string, string>;
  /** usernames in row order */
  order: string[];
  /** non-epic issue keys the user added to the Gantt */
  shown: string[];
  /** epic keys the user removed from the Gantt (epics show by default) */
  hiddenEpics: string[];
}

export const emptySettings: Settings = { aliases: {}, order: [], shown: [], hiddenEpics: [] };

export const UNASSIGNED: Person = { id: '__unassigned__', displayName: 'Unassigned' };
