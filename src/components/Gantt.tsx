import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react';
import { epicHex, STATUS, textOn, type BarColors } from '../lib/colors';
import { dayOfMonth, fmt, fmtRange, today, weekdayLetter, type Day } from '../lib/dates';
import type { DayCell, Range, Row, Span } from '../lib/layout';
import type { Item, Sprint } from '../model';
import { SoldierLabel } from './SoldierLabel';

const LANE = 44;
const DRAG_SHADOW = '0 0 0 4px rgba(31,111,107,.22), 0 6px 16px rgba(29,43,56,.18)';

type Mode = 'move' | 'start' | 'end';

interface Drag {
  key: string;
  mode: Mode;
  x0: number;
  dayWidth: number;
  orig: Span;
  now: Span;
}

interface Props {
  range: Range;
  cells: DayCell[];
  sprints: Sprint[];
  rows: Row[];
  span: (i: Item) => Span;
  /** Bar to draw at proposed dates while the confirm dialog is open. */
  pending: { key: string; start: Day; end: Day } | null;
  onPropose: (item: Item, start: Day, end: Day) => void;
  onReorder: (order: string[]) => void;
  onRename: (personId: string, name: string) => Promise<void>;
  personName: (personId: string, fallback: string) => string;
}

function clamp(mode: Mode, s: Span, d: number, range: Range): Span {
  // Bounds widen to the item's own dates, so a long epic never jumps when grabbed.
  const lo = Math.min(range.start, s.start);
  const hi = Math.max(range.end, s.end);
  if (mode === 'move') {
    const dd = Math.max(lo - s.start, Math.min(hi - s.end, d));
    return { ...s, start: s.start + dd, end: s.end + dd };
  }
  if (mode === 'start') return { ...s, start: Math.max(lo, Math.min(s.end, s.start + d)) };
  return { ...s, end: Math.min(hi, Math.max(s.start, s.end + d)) };
}

export function Gantt({ range, cells, sprints, rows, span, pending, onPropose, onReorder, onRename, personName }: Props) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);
  const [rowDrag, setRowDrag] = useState<string | null>(null);
  const [rowOver, setRowOver] = useState<{ id: string; after: boolean } | null>(null);

  const t = today();
  const pct = (n: number) => `${(n / range.days) * 100}%`;
  const grid: CSSProperties = { gridTemplateColumns: `repeat(${range.days}, minmax(0, 1fr))` };
  const minWidth = range.days <= 14 ? 980 : 240 + range.days * 38;
  const todayOn = t >= range.start && t <= range.end;
  const order = rows.map((r) => r.person.id);
  const epicByKey = new Map(rows.flatMap((r) => r.entries).filter((en) => en.item.isEpic).map((en) => [en.item.key, en.item]));

  const cellStyle = (c: DayCell): CSSProperties => ({
    background: !c.inSprint ? '#ECEFF2' : c.weekend ? '#F4F6F8' : 'transparent',
    borderLeft: c.sprintStart ? '1px solid #AEB9C3' : undefined,
  });

  /* ------------------------------------------------------------ bar drag */

  const startDrag = (item: Item, mode: Mode) => (e: PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const bar = (e.currentTarget as HTMLElement).closest<HTMLElement>('[data-bar]');
    if (!bar?.parentElement) return;
    bar.setPointerCapture(e.pointerId);
    bar.focus({ preventScroll: true });
    const s = span(item);
    const d: Drag = { key: item.key, mode, x0: e.clientX, dayWidth: bar.parentElement.getBoundingClientRect().width / range.days, orig: s, now: s };
    dragRef.current = d;
    setDrag(d);
  };

  const moveDrag = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const now = clamp(d.mode, d.orig, Math.round((e.clientX - d.x0) / d.dayWidth), range);
    if (now.start !== d.now.start || now.end !== d.now.end) {
      dragRef.current = { ...d, now };
      setDrag(dragRef.current);
    }
  };

  const endDrag = (item: Item) => () => {
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    setDrag(null);
    if (d.now.start !== d.orig.start || d.now.end !== d.orig.end) onPropose(item, d.now.start, d.now.end);
  };

  const keyMove = (item: Item) => (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    const s = span(item);
    const n = clamp(e.shiftKey ? 'end' : 'move', s, e.key === 'ArrowRight' ? 1 : -1, range);
    if (n.start !== s.start || n.end !== s.end) onPropose(item, n.start, n.end);
  };

  /* ------------------------------------------------------------ row drag */

  const moveRow = (from: string, to: string, after: boolean) => {
    setRowDrag(null);
    setRowOver(null);
    if (from === to) return;
    const next = order.filter((id) => id !== from);
    let idx = next.indexOf(to);
    idx = idx < 0 ? next.length : after ? idx + 1 : idx;
    next.splice(idx, 0, from);
    onReorder(next);
  };

  /* ------------------------------------------------------------ render */

  const bands = sprints
    .filter((s) => s.start != null && s.end != null)
    .map((s) => ({ s, from: Math.max(range.start, s.start!), to: Math.min(range.end, s.end!) }))
    .filter((b) => b.to >= b.from);

  return (
    <section aria-label="Gantt by soldier" className="panel gantt">
      <div className="scroll-x">
        <div style={{ minWidth }}>
          <div className="g-row g-bands">
            <div className="g-label" />
            <div className="g-track">
              {bands.map(({ s, from, to }) => (
                <div key={s.id} className="band" style={{ left: pct(from - range.start), width: pct(to - from + 1) }}>
                  <span className="strong small">{s.name}</span>
                  <span className="small muted ellipsis">{fmtRange(s.start!, s.end!)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="g-row g-days">
            <div className="g-label small muted">Soldier</div>
            <div className="g-grid" style={grid}>
              {cells.map((c) => {
                const isToday = c.day === t;
                return (
                  <div key={c.day} className="day" style={{ ...cellStyle(c), color: isToday ? '#1F6F6B' : c.weekend || !c.inSprint ? '#5B6B7A' : '#1D2B38' }}>
                    <span className="day-letter">{isToday ? 'Today' : weekdayLetter(c.day)}</span>
                    <span className="day-num" style={{ fontWeight: isToday ? 600 : 500 }}>{dayOfMonth(c.day)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {rows.map((row) => {
            const id = row.person.id;
            const over = rowOver && rowDrag && rowOver.id === id && rowDrag !== id ? rowOver : null;
            return (
              <div
                key={id}
                className="g-row soldier"
                style={{
                  height: row.lanes * LANE + 12,
                  boxShadow: over ? (over.after ? 'inset 0 -3px 0 #1F6F6B' : 'inset 0 3px 0 #1F6F6B') : undefined,
                  opacity: rowDrag === id ? 0.45 : 1,
                }}
                onDragOver={(e) => {
                  if (!rowDrag) return;
                  e.preventDefault();
                  const r = e.currentTarget.getBoundingClientRect();
                  const after = e.clientY > r.top + r.height / 2;
                  if (!rowOver || rowOver.id !== id || rowOver.after !== after) setRowOver({ id, after });
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (rowDrag) moveRow(rowDrag, id, rowOver?.after ?? false);
                }}
              >
                <SoldierLabel
                  row={row}
                  displayName={personName(id, row.person.displayName)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', id);
                    setRowDrag(id);
                  }}
                  onDragEnd={() => {
                    setRowDrag(null);
                    setRowOver(null);
                  }}
                  onMoveKey={(dir) => {
                    const i = order.indexOf(id);
                    const j = i + dir;
                    if (j >= 0 && j < order.length) moveRow(id, order[j], dir > 0);
                  }}
                  onRename={(name) => onRename(id, name)}
                />
                <div className="g-track">
                  <div className="g-grid fill" style={grid} aria-hidden="true">
                    {cells.map((c) => <div key={c.day} style={cellStyle(c)} />)}
                  </div>
                  {todayOn && <div className="today-line" aria-hidden="true" style={{ left: pct(t - range.start + 0.5) }} />}
                  {row.entries.map(({ item, lane, ref }) => {
                    const dragging = drag?.key === item.key;
                    const base = span(item);
                    const s: Span = dragging ? drag!.now : pending?.key === item.key ? { ...base, start: pending.start, end: pending.end, undated: false } : base;
                    const vs = Math.max(range.start, s.start);
                    const ve = Math.min(range.end, s.end);
                    if (ve < vs) return null;

                    const epicColor = epicHex(item.isEpic ? item.epicColor : null);
                    const stripe = !item.isEpic && item.epicKey ? epicHex(epicByKey.get(item.epicKey)?.epicColor) : null;
                    let C: BarColors = STATUS[item.status];
                    if (ref) C = epicColor ? { bg: `${epicColor}1F`, fg: '#1D2B38', border: `1.5px dashed ${epicColor}` } : { bg: '#F4F7F8', fg: '#1D2B38', border: '1.5px dashed #6F7F8C' };
                    else if (epicColor) C = { bg: epicColor, fg: textOn(epicColor), border: `1px solid ${epicColor}` };
                    if (s.undated && !dragging) C = { ...C, border: `1.5px dotted ${C.fg === '#FFFFFF' ? C.bg : '#6F7F8C'}` };

                    const shadows = [dragging && DRAG_SHADOW, stripe && `inset 4px 0 0 ${stripe}`].filter(Boolean).join(', ');
                    const typeLabel = ref ? `${personName(item.assignee?.id ?? '', item.assignee?.displayName ?? 'Unassigned')}’s epic` : item.typeName;
                    const dates = `${fmt(s.start)} – ${fmt(s.end)}`;

                    return (
                      <button
                        key={item.key}
                        type="button"
                        data-bar
                        className={dragging ? 'bar is-drag' : 'bar'}
                        title={`${item.key}, ${item.statusName}${s.undated ? ', no dates in Jira' : ''}, ${dates}`}
                        aria-label={`${typeLabel} ${item.key} ${item.summary}, ${STATUS[item.status].label}, ${s.undated ? 'no dates in Jira' : dates}. Arrow keys move it, Shift with an arrow changes the end`}
                        onPointerDown={startDrag(item, 'move')}
                        onPointerMove={moveDrag}
                        onPointerUp={endDrag(item)}
                        onPointerCancel={endDrag(item)}
                        onKeyDown={keyMove(item)}
                        style={{
                          top: 8 + lane * LANE,
                          left: `calc(${pct(vs - range.start)} + 3px)`,
                          width: `calc(${pct(ve - vs + 1)} - 6px)`,
                          background: C.bg,
                          color: C.fg,
                          border: C.border,
                          boxShadow: shadows || 'none',
                        }}
                      >
                        <span className="handle left" onPointerDown={startDrag(item, 'start')}><i /></span>
                        <span className="bar-type">{typeLabel}</span>
                        <span className="ellipsis" style={{ fontWeight: item.isEpic ? 600 : 500 }}>{dragging ? dates : item.summary}</span>
                        <span className="handle right" onPointerDown={startDrag(item, 'end')}><i /></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
