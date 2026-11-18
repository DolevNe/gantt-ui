import { useCallback, useEffect, useState } from 'react';
import {
  fetchIssue,
  fetchSettings,
  fetchSprintData,
  fetchSprints,
  resolveFields,
  saveSettings as putSettings,
  updateDates,
  updateEpicColor,
  type FieldIds,
} from '../jira/api';
import type { Day } from '../lib/dates';
import { emptySettings, type Item, type Settings, type Sprint } from '../model';

export type Load = { state: 'idle' } | { state: 'loading' } | { state: 'error'; message: string } | { state: 'ready' };

const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * All Gantt data, read from Jira. Nothing is cached beyond this component's
 * memory: every write goes to Jira first, then the changed issue is re-read
 * from Jira so the screen always shows what Jira has.
 */
export function useGantt() {
  const [boot, setBoot] = useState<Load>({ state: 'loading' });
  const [fields, setFields] = useState<FieldIds | null>(null);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [settings, setSettings] = useState<Settings>(emptySettings);

  const [selected, setSelected] = useState<number[]>([]);
  const [issues, setIssues] = useState<Load>({ state: 'idle' });
  const [items, setItems] = useState<Item[]>([]);
  const [epics, setEpics] = useState<Item[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [f, s, st] = await Promise.all([resolveFields(), fetchSprints(), fetchSettings()]);
        if (!alive) return;
        setFields(f);
        setSprints(s.sort((a, b) => (a.start ?? 0) - (b.start ?? 0)));
        setSettings(st);
        setBoot({ state: 'ready' });
      } catch (e) {
        if (alive) setBoot({ state: 'error', message: message(e) });
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const load = useCallback(
    async (ids: number[]) => {
      if (!fields) return;
      setSelected(ids);
      setIssues({ state: 'loading' });
      try {
        const [data, st] = await Promise.all([fetchSprintData(ids, fields), fetchSettings()]);
        setItems(data.items);
        setEpics(data.epics);
        setSettings(st);
        setIssues({ state: 'ready' });
      } catch (e) {
        setIssues({ state: 'error', message: message(e) });
      }
    },
    [fields],
  );

  const reload = useCallback(() => load(selected), [load, selected]);

  const replace = (fresh: Item) => {
    const swap = (list: Item[]) => list.map((i) => (i.key === fresh.key ? { ...fresh, epicKey: fresh.epicKey ?? i.epicKey } : i));
    if (fresh.isEpic) setEpics(swap);
    else setItems(swap);
  };

  const saveDates = useCallback(
    async (key: string, start: Day | null, due: Day | null) => {
      if (!fields) return;
      await updateDates(key, fields, start, due);
      replace(await fetchIssue(key, fields));
    },
    [fields],
  );

  const saveEpicColor = useCallback(
    async (key: string, label: string | null) => {
      if (!fields) return;
      await updateEpicColor(key, fields, label);
      replace(await fetchIssue(key, fields));
    },
    [fields],
  );

  /** Re-reads settings from Jira before writing, so two people editing don't wipe each other's changes. */
  const updateSettings = useCallback(async (change: (s: Settings) => Settings) => {
    const latest = await fetchSettings();
    const next = change(latest);
    await putSettings(next);
    setSettings(next);
  }, []);

  return {
    boot,
    canColorEpics: !!fields?.epicColor,
    sprints,
    settings,
    selected,
    issues,
    items,
    epics,
    load,
    reload,
    saveDates,
    saveEpicColor,
    updateSettings,
  };
}
