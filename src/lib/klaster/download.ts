
import type { Board } from './types';

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportBoards(boards: Record<string, Board>, ids: string[], name = 'doski') {
  const payload: Record<string, Board> = {};
  for (const id of ids) {
    if (boards[id]) payload[id] = boards[id];
  }
  downloadJson({ app: 'klaster', version: 1, boards: payload }, `${name}.json`);
}
