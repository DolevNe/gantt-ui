import { STATUS } from '../lib/colors';

export function Legend() {
  return (
    <ul aria-label="Status legend" className="legend">
      {Object.values(STATUS).map((s) => (
        <li key={s.label}>
          <span aria-hidden="true" className="legend-swatch" style={{ background: s.bg, border: s.border }} />
          {s.label}
        </li>
      ))}
      <li>
        <span aria-hidden="true" className="legend-swatch" style={{ background: '#FFFFFF', border: '1.5px dotted #6F7F8C' }} />
        No dates in Jira
      </li>
    </ul>
  );
}
