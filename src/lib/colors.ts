import type { Status } from '../model';

export interface BarColors {
  bg: string;
  fg: string;
  border: string;
}

export const STATUS: Record<Status, BarColors & { label: string }> = {
  done: { label: 'Done', bg: '#1D2B38', fg: '#FFFFFF', border: '1px solid #1D2B38' },
  prog: { label: 'In progress', bg: '#1F6F6B', fg: '#FFFFFF', border: '1px solid #1F6F6B' },
  todo: { label: 'To do', bg: '#FFFFFF', fg: '#1D2B38', border: '1.5px solid #1F6F6B' },
  block: { label: 'Blocked', bg: '#F2B33D', fg: '#1D2B38', border: '1px solid #D99A1F' },
};

/**
 * Jira Software's built-in epic colours. The label is what Jira stores in the
 * "Epic Colour" field; the hex is how Jira's board draws it.
 * Check these against your own board and adjust if your Jira draws them differently.
 */
export const EPIC_COLORS: { label: string; name: string; hex: string }[] = [
  { label: 'ghx-label-1', name: 'Brown', hex: '#815B3A' },
  { label: 'ghx-label-2', name: 'Orange', hex: '#F79232' },
  { label: 'ghx-label-3', name: 'Sand', hex: '#D39C3F' },
  { label: 'ghx-label-4', name: 'Blue', hex: '#3B7FC4' },
  { label: 'ghx-label-5', name: 'Slate', hex: '#4A6785' },
  { label: 'ghx-label-6', name: 'Green', hex: '#8EB021' },
  { label: 'ghx-label-7', name: 'Rose', hex: '#AC707A' },
  { label: 'ghx-label-8', name: 'Purple', hex: '#654982' },
  { label: 'ghx-label-9', name: 'Pink', hex: '#F15C75' },
];

export function epicHex(label: string | null | undefined): string | null {
  return EPIC_COLORS.find((c) => c.label === label)?.hex ?? null;
}

/** White or dark text, whichever reads better on the colour. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return 1.05 / (L + 0.05) >= 4.5 ? '#FFFFFF' : '#1D2B38';
}
