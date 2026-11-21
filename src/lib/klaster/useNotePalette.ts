'use client';

import { useAppStore } from './store';
import { notePalette } from './theme';
import type { NotePalette, ThemeId } from './theme';

/**
 * Палитра блокнотных карточек с учётом микса «Простенькой»:
 * если у микса выбрана тема карточек, цвета берутся из неё.
 */
export function useNotePalette(): NotePalette {
  const theme = useAppStore((s) => s.theme);
  const mixCards = useAppStore((s) => s.simpleMix?.cards ?? null);
  return notePalette(theme, mixCards);
}

/** Вариант для обычных функций: тема и микс передаются явно. */
export function notePaletteWithMix(theme: ThemeId, mix: { cards: ThemeId | null } | null): NotePalette {
  return notePalette(theme, mix?.cards ?? null);
}
