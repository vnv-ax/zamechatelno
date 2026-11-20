'use client';

import { Eraser } from 'lucide-react';
import { useAppStore } from '@/lib/klaster/store';
import { Hint } from './Hint';

export function PlainBgButton({ size = 'sm' }: { size?: 'sm' | 'md' }) {
  const plainBg = useAppStore((s) => s.plainBg);
  const togglePlainBg = useAppStore((s) => s.togglePlainBg);
  const dims = size === 'md' ? 'h-9 w-9' : 'h-8 w-8';

  return (
    <Hint label={plainBg ? 'Вернуть фон' : 'Убрать фон'} side="bottom">
      <button
        type="button"
        aria-label={plainBg ? 'Вернуть фон' : 'Убрать фон'}
        aria-pressed={plainBg}
        onClick={togglePlainBg}
        className={`flex ${dims} shrink-0 items-center justify-center rounded-md transition-colors ${
          plainBg
            ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
            : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]'
        }`}
      >
        <Eraser size={16} />
      </button>
    </Hint>
  );
}
