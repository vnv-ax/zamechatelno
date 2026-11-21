// Стартовый лист: «Добро пожаловать» (импорт из data\exports).
import welcomeExport from './seed-welcome.json';
import type { Board } from './types';

export function createSeed(): { boards: Record<string, Board>; openBoardId: string | null } {
  const now = Date.now();
  const raw = (welcomeExport as { boards: Record<string, Board> }).boards['board-welcome'];
  const welcome: Board = { ...raw, createdAt: now, updatedAt: now };
  return { boards: { [welcome.id]: welcome }, openBoardId: welcome.id };
}
