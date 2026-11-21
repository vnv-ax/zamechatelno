

'use client';

import { useEffect, useRef, useState } from 'react';
import cliSpinners from 'cli-spinners';
import { useAppStore } from '@/lib/klaster/store';
import { THEME_META } from '@/lib/klaster/theme';
import type { ThemeId } from '@/lib/klaster/theme';

const SPINNERS: Partial<Record<ThemeId, { interval: number; frames: string[] }>> = {
  academic: cliSpinners.simpleDots,
  'academic-light': cliSpinners.simpleDots,
  kinopio: cliSpinners.simpleDots,
  shaomi: cliSpinners.dots12,
  'shaomi-dark': cliSpinners.dots12,
  miuay: cliSpinners.bouncingBar,
  'miuay-dark': cliSpinners.bouncingBar,
  // «Простенькая» — без анимации: один статичный кадр.
  simple: { interval: 100000, frames: ['•'] },
  'simple-dark': { interval: 100000, frames: ['•'] },
};

const LEAVE_MS = 220;

export function ThemeSplash() {
  const boot = useAppStore((s) => s.themeBoot);
  const theme = useAppStore((s) => s.theme);
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [frame, setFrame] = useState(0);
  const visibleRef = useRef(visible);
  visibleRef.current = visible;

  useEffect(() => {
    if (boot) {
      setLeaving(false);
      setVisible(true);
      setFrame(0);
      return;
    }
    if (!visibleRef.current) return;
    setLeaving(true);
    const t = setTimeout(() => {
      setVisible(false);
      setLeaving(false);
    }, LEAVE_MS);
    return () => clearTimeout(t);
  }, [boot]);

  useEffect(() => {
    if (!visible) return;
    const sp = SPINNERS[theme] ?? cliSpinners.simpleDots;
    const id = setInterval(() => setFrame((f) => (f + 1) % sp.frames.length), sp.interval);
    return () => clearInterval(id);
  }, [visible, theme]);

  if (!visible) return null;

  const sp = SPINNERS[theme] ?? cliSpinners.simpleDots;
  const meta = THEME_META[theme];

  return (
    <div className={leaving ? 'theme-splash leaving' : 'theme-splash'} role="status" aria-live="polite">
      <div className="theme-splash-card">
        <div className="splash-spinner">{sp.frames[frame % sp.frames.length]}</div>
        <div className="splash-title">
          Загрузка…
          {theme === 'kinopio' ? <span className="splash-dot" /> : null}
        </div>
        <div className="splash-hint">Перезагружаю визуальную часть · тема «{meta?.name ?? ''}»</div>
        <div className="splash-bar" />
      </div>
    </div>
  );
}
