# Castle Gantt

A sprint Gantt for Jira, laid out by soldier. Frontend only: React + TypeScript, built with Vite.
There is no backend and no local storage. **Jira is the only source of truth:** everything is
read from Jira's REST API, and every change is written back to Jira.

## What it does

- Pick one or more sprints from the board. The timeline runs from the first sprint's start to the last one's end.
- One row per assignee. Epics show by default. Add stories, tasks and sub-tasks from **Add items**.
  An item's epic always shows in the row of the soldier doing the work, dashed when the epic belongs to someone else.
- Drag a bar to move it, or drag an edge to change its start or end. Arrow keys work too (Shift changes the end).
  Nothing is written until you confirm **Update Jira?**. After saving, the issue is re-read from Jira.
- Drag soldiers to reorder rows, and click a name to set a display name.
- Pick an epic's colour. It is written to Jira's own *Epic Colour* field, so the board shows it too.

## Where each thing is stored in Jira

| What | Jira location |
|---|---|
| Start date | The date custom field named in `VITE_JIRA_START_DATE_FIELD` |
| End date | `duedate` |
| Epic colour | *Epic Colour* field on the epic (`ghx-label-1` … `ghx-label-9`) |
| Display names, row order, which items are on the Gantt | Project property `castle-gantt` on `VITE_JIRA_PROJECT_KEY` |

The project property is shared: everyone using the app sees the same names, order and items.
Writing it needs **project admin** rights. Others can still view and drag dates.

## Jira requirements

- Jira Server / Data Center with Jira Software (agile REST API). Built against 8.5.
- A **date picker custom field** for the start date. Jira 8.5 has no built-in start date.
  If it doesn't exist yet, a Jira system admin has to create it and add it to the edit screen of your issue types.
- *Start date* and *Due date* on the **edit screen**, or Jira rejects the update.
- Sprints with start and end dates (set when a sprint is started or planned).

Fields are looked up by name at startup (`/rest/api/2/field`), so customfield ids don't need configuring.
If a name differs in your Jira, change it in `src/config.ts`.

## Setup

```bash
cp .env.example .env     # then fill it in
npm install
npm run dev              # http://localhost:5173
```

Sign in with your own Jira username and password. Jira sets its normal session cookie, so changes
are recorded under the person who made them. No credentials are stored by the app.

## Reaching Jira from the browser (CORS)

A browser only lets a page call Jira if the page comes from the same address as Jira,
or if Jira allows the page's address. Pick one:

1. **Dev:** `npm run dev`. Vite's dev server forwards `/jira/*` to `JIRA_URL`, so it's same-origin.
   Keep `VITE_JIRA_API_BASE=/jira`.
2. **Direct:** if your Jira already allows the app's origin (test it from the browser console on the page where the app will be hosted:
   `fetch('https://YOUR-JIRA/rest/api/2/myself', {credentials:'include'})`), set
   `VITE_JIRA_API_BASE=https://YOUR-JIRA` and host `dist/` anywhere.
3. **Static host with forwarding:** serve `dist/` from any static server that also forwards `/jira/` to Jira.

## Build

```bash
npm run build            # type-checks, then writes static files to dist/
```

`VITE_*` values are baked in at build time. Rebuild after changing them.

## Code map

```
src/
  config.ts              env + Jira field names, blocked-status pattern, weekend days
  jira/client.ts         fetch wrapper (session cookie, Jira error messages)
  jira/auth.ts           sign in / out with Jira's session endpoint
  jira/api.ts            fields, sprints, issues, epics, date + colour updates, project property
  hooks/useGantt.ts      all data state; writes go to Jira, then re-read from Jira
  lib/layout.ts          rows per assignee, lanes, sprint range, undated fallback
  lib/dates.ts           whole-day date maths (no time-zone drift)
  lib/colors.ts          status colours and Jira's epic colour palette
  components/            Planner (page), Gantt, SoldierLabel, dialogs, EpicColors, Legend, Login
```

## Behaviour worth knowing

- **Status colours** come from the status category (To do / In progress / Done). Jira has no
  "Blocked" category, so status names matching `blockedStatus` in `src/config.ts` count as blocked.
- **Items without dates** are drawn on their sprint's dates with a dotted outline. Dragging one sets real dates in Jira.
- **Sub-tasks** take their epic from their parent.
- **Moving an item across sprints** changes only its dates, not its sprint.
- **Epic colours** use Jira's `ghx-label-N` values. The hex values in `src/lib/colors.ts` are Jira's defaults.
  Check them against your board.
- **Fonts:** no web fonts are loaded (closed network). IBM Plex Sans is used if installed, otherwise the system font.
