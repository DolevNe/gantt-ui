import { config } from '../config';
import { UNASSIGNED, type Item, type Person, type Settings, type Sprint } from '../model';
import { weekday, type Day } from './dates';

export interface Range {
  start: Day;
  end: Day;
  days: number;
}

/** From the first selected sprint's start to the last one's end, gaps included. */
export function sprintRange(sprints: Sprint[]): Range | null {
  const starts = sprints.map((s) => s.start).filter((d): d is Day => d != null);
  const ends = sprints.map((s) => s.end).filter((d): d is Day => d != null);
  if (!starts.length || !ends.length) return null;
  const start = Math.min(...starts);
  const end = Math.max(...ends);
  return { start, end, days: end - start + 1 };
}

export interface DayCell {
  day: Day;
  weekend: boolean;
  inSprint: boolean;
  sprintStart: boolean;
}

export function dayCells(range: Range, sprints: Sprint[]): DayCell[] {
  const cells: DayCell[] = [];
  for (let i = 0; i < range.days; i++) {
    const day = range.start + i;
    cells.push({
      day,
      weekend: config.weekend.includes(weekday(day)),
      inSprint: sprints.some((s) => s.start != null && s.end != null && day >= s.start && day <= s.end),
      sprintStart: i > 0 && sprints.some((s) => s.start === day),
    });
  }
  return cells;
}

export interface Span {
  start: Day;
  end: Day;
  /** True when Jira has no start or due date and the bar uses the sprint's dates instead. */
  undated: boolean;
}

/** Where to draw an item. Items without dates fall back to their sprint's dates. */
export function spanOf(item: Item, sprintsById: Map<number, Sprint>, range: Range): Span {
  if (item.start != null && item.due != null) return { start: Math.min(item.start, item.due), end: Math.max(item.start, item.due), undated: false };
  const sprint = item.sprintIds.map((id) => sprintsById.get(id)).find((s) => s?.start != null && s?.end != null);
  const fbStart = sprint?.start ?? range.start;
  const fbEnd = sprint?.end ?? range.end;
  const start = item.start ?? (item.due != null ? Math.min(item.due, fbStart) : fbStart);
  const end = item.due ?? Math.max(start, fbEnd);
  return { start, end, undated: true };
}

export interface Entry {
  item: Item;
  lane: number;
  /** Epic shown in someone else's row because they have work under it. */
  ref: boolean;
}

export interface Row {
  person: Person;
  name: string;
  entries: Entry[];
  lanes: number;
}

export function isShown(item: Item, settings: Settings): boolean {
  return item.isEpic ? !settings.hiddenEpics.includes(item.key) : settings.shown.includes(item.key);
}

/**
 * One row per assignee. In each row, each epic gets its own lane and the
 * items under it are packed into lanes right below it.
 */
export function buildRows(items: Item[], epics: Item[], settings: Settings, span: (i: Item) => Span): Row[] {
  const people = new Map<string, Person>();
  for (const i of [...epics, ...items]) {
    const p = i.assignee ?? UNASSIGNED;
    if (!people.has(p.id)) people.set(p.id, p);
  }
  const ids = [...people.keys()];
  const rank = (id: string) => {
    const k = settings.order.indexOf(id);
    return k < 0 ? 10_000 + ids.indexOf(id) : k;
  };
  ids.sort((a, b) => rank(a) - rank(b));

  const epicKeys = new Set(epics.map((e) => e.key));

  return ids.map((id) => {
    const person = people.get(id)!;
    const mine = items.filter((i) => (i.assignee ?? UNASSIGNED).id === id && isShown(i, settings));
    const entries: Entry[] = [];
    let base = 0;

    const pack = (group: Item[]) => {
      const ends: Day[] = [];
      const sorted = [...group].sort((a, b) => span(a).start - span(b).start || span(b).end - span(a).end);
      for (const item of sorted) {
        const s = span(item);
        let lane = 0;
        while (lane < ends.length && ends[lane] >= s.start) lane++;
        ends[lane] = s.end;
        entries.push({ item, lane: base + lane, ref: false });
      }
      base += ends.length;
    };

    for (const epic of epics) {
      const kids = mine.filter((i) => i.epicKey === epic.key);
      const own = (epic.assignee ?? UNASSIGNED).id === id && isShown(epic, settings);
      if (!own && !kids.length) continue;
      entries.push({ item: epic, lane: base, ref: (epic.assignee ?? UNASSIGNED).id !== id });
      base++;
      pack(kids);
    }
    pack(mine.filter((i) => !i.epicKey || !epicKeys.has(i.epicKey)));

    return { person, name: settings.aliases[id] || person.displayName, entries, lanes: Math.max(1, base) };
  });
}
