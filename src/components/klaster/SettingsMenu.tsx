
'use client';

import { Check, Palette } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/lib/klaster/store';
import { THEME_META } from '@/lib/klaster/theme';
import { Hint } from './Hint';
import type { FontId, ThemeId } from '@/lib/klaster/store';

const FONTS: { id: FontId; name: string; stack: string; size: number }[] = [
  { id: 'inter', name: 'Интер', stack: "var(--font-inter), 'Inter', system-ui, sans-serif", size: 13.5 },
  { id: 'golos', name: 'Голосовой', stack: "var(--font-golos), 'Segoe UI', system-ui, sans-serif", size: 13.5 },
  { id: 'jbmono', name: 'Резкомозглый', stack: "var(--font-jbmono), ui-monospace, monospace", size: 12.5 },
  { id: 'plex', name: 'Симбиотический', stack: "var(--font-plex), system-ui, sans-serif", size: 13.5 },
  { id: 'piazzolla', name: 'Пьяццоллы', stack: "var(--font-piazzolla), Georgia, serif", size: 13.5 },
  { id: 'spectral', name: 'Спектральный', stack: "var(--font-spectral), Georgia, serif", size: 13.5 },
  { id: 'literata', name: 'Литературный', stack: "var(--font-literata), Georgia, serif", size: 13.5 },
  { id: 'pattaya', name: 'Патайский', stack: "var(--font-pattaya), cursive", size: 13 },
  { id: 'vibes', name: 'Вайбовый', stack: "var(--font-vibes), cursive", size: 15 },
  { id: 'caveat', name: 'Бдительный', stack: "var(--font-caveat), cursive", size: 15 },
  { id: 'shantell', name: 'Рукописный', stack: "var(--font-shantell), system-ui, sans-serif", size: 13 },
];

const SIZES: { v: number; name: string }[] = [
  { v: 0.85, name: 'Мелкий' },
  { v: 1, name: 'Обычный' },
  { v: 1.15, name: 'Крупный' },
  { v: 1.3, name: 'Крупнее' },
  { v: 1.5, name: 'Очень крупный' },
];

const THEMES: { id: ThemeId; name: string; hint: string }[] = (
  [
    'vanilla',
    'vanilla-dark',
    'vanilla-black',
    'academic',
    'academic-dark',
    'kinopio',
    'stylish',
    'stylish-dark',
    'simple',
    'simple-dark',
    'ordinary',
    'ordinary-dark',
  ] as ThemeId[]
).map((id) => ({ id, ...THEME_META[id] }));

export function SettingsMenu({ align = 'end' }: { align?: 'start' | 'end' }) {
  const font = useAppStore((s) => s.font);
  const theme = useAppStore((s) => s.theme);
  const contentScale = useAppStore((s) => s.contentScale);

  return (
    <Popover>
      <Hint label="Внешний вид" side="bottom">
        <PopoverTrigger asChild>
          <button
            aria-label="Внешний вид"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
          >
            <Palette size={16} />
          </button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align={align} className="w-[520px] p-0">
        <div className="max-h-[70vh] overflow-y-auto">
          <div className="px-3 pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Шрифт
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {FONTS.map((f) => {
              const active = font === f.id;
              return (
                <button
                  key={f.id}
                  className={
                    'flex items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-colors ' +
                    (active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-transparent hover:bg-[var(--hover-bg)]')
                  }
                  onClick={() => useAppStore.getState().setFont(f.id)}
                >
                  <span style={{ fontFamily: f.stack, fontSize: f.size, color: 'var(--text-main)' }}>
                    {f.name}
                  </span>
                  {active ? <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : null}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--border)] px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Кегль текста в блоках
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {SIZES.map((s) => {
              const active = Math.abs(contentScale - s.v) < 0.001;
              return (
                <button
                  key={s.v}
                  className={
                    'flex items-center gap-1.5 rounded-md border px-2 py-1 text-left transition-colors ' +
                    (active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-transparent hover:bg-[var(--hover-bg)]')
                  }
                  onClick={() => useAppStore.getState().setContentScale(s.v)}
                >
                  <span
                    className="leading-none"
                    style={{ fontSize: 13 * s.v, color: 'var(--text-main)' }}
                  >
                    {s.name}
                  </span>
                  {active ? <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} /> : null}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--border)] px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Тема
          </div>
          <div className="grid grid-cols-2 gap-1 px-2 pb-2">
            {THEMES.map((t) => {
              const active = theme === t.id;
              return (
                <button
                  key={t.id}
                  className={
                    'flex items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ' +
                    (active
                      ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                      : 'border-transparent hover:bg-[var(--hover-bg)]')
                  }
                  onClick={() => useAppStore.getState().setTheme(t.id)}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] leading-tight" style={{ color: 'var(--text-main)' }}>
                      {t.name}
                    </span>
                    <span className="block truncate text-[10.5px] leading-tight" style={{ color: 'var(--text-muted)' }}>
                      {t.hint}
                    </span>
                  </span>
                  {active ? <Check size={12} style={{ color: 'var(--accent)', flexShrink: 0, marginLeft: 'auto' }} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
