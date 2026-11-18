const env = import.meta.env;

export const config = {
  apiBase: (env.VITE_JIRA_API_BASE as string | undefined) ?? '/jira',
  boardId: Number(env.VITE_JIRA_BOARD_ID),
  projectKey: (env.VITE_JIRA_PROJECT_KEY as string | undefined) ?? 'CASTLE',

  /** Jira field names, resolved to customfield ids at startup via /rest/api/2/field. */
  fieldNames: {
    startDate: (env.VITE_JIRA_START_DATE_FIELD as string | undefined) ?? 'Start date',
    sprint: ['Sprint'],
    epicLink: ['Epic Link'],
    epicColor: ['Epic Colour', 'Epic Color'],
  },

  epicTypeName: 'Epic',
  /** Status names that count as "Blocked" (Jira has no blocked status category). */
  blockedStatus: /block|חסום/i,
  /** Days shaded as weekend: 0 = Sunday … 6 = Saturday. */
  weekend: [5, 6],
  /** Project entity property holding shared Gantt settings. */
  settingsProperty: 'castle-gantt',
};

export function configProblems(): string[] {
  const out: string[] = [];
  if (!Number.isFinite(config.boardId) || config.boardId <= 0) out.push('VITE_JIRA_BOARD_ID is not set.');
  if (!config.projectKey) out.push('VITE_JIRA_PROJECT_KEY is not set.');
  return out;
}
