
'use client';

import { useEffect } from 'react';
import { Check, Palette, Settings2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/lib/klaster/store';
import { THEME_META } from '@/lib/klaster/theme';
import { Hint } from './Hint';
import type { FontId, SimpleMix, ThemeId } from '@/lib/klaster/store';

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


/** Семьи тем: в каждой — ДЕНЬ и НОЧЬ. Порядок логичный, «Персональная» — своя сборка. */
const FAMILIES: { name: string; day: ThemeId; night: ThemeId }[] = [
  { name: 'Академическая', day: 'academic-light', night: 'academic' },
  { name: 'Линь', day: 'lin', night: 'lin-dark' },
  { name: 'Шаоми', day: 'shaomi', night: 'shaomi-dark' },
  { name: 'Яблоневая', day: 'apple', night: 'apple-night' },
  { name: 'Миюай', day: 'miuay', night: 'miuay-dark' },
  { name: 'Персональная', day: 'simple', night: 'simple-dark' },
];

const THEMES: { id: ThemeId; name: string; hint: string }[] = (
  [
    'academic-light',
    'academic',
    'lin',
    'lin-dark',
    'shaomi',
    'shaomi-dark',
    'apple',
    'apple-night',
    'miuay',
    'miuay-dark',
    'simple',
    'simple-dark',
    'kinopio',
    'kinopio-dark',
  ] as ThemeId[]
).map((id) => ({ id, ...THEME_META[id] }));

export function SettingsMenu({ align = 'end', textMode = false }: { align?: 'start' | 'end'; textMode?: boolean }) {

  return (
    <Popover>
      <PopoverTrigger asChild>
        {textMode ? (
          <button
            aria-label="Внешний вид"
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent' }}
          >
            ОФОРМЛЕНИЕ
          </button>
        ) : (
          <Hint label="Внешний вид" side="bottom">
            <button
              aria-label="Внешний вид"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            >
              <Palette size={16} />
            </button>
          </Hint>
        )}
      </PopoverTrigger>
      <PopoverContent align={align} className="w-[520px] p-0">
        <SettingsBody />
      </PopoverContent>
    </Popover>
  );
}


/** Содержимое настроек оформления — общее для поповера и отдельного окна. */
function SettingsBody({ onClose }: { onClose?: () => void }) {
  const font = useAppStore((s) => s.font);
  const theme = useAppStore((s) => s.theme);
  const simpleMix = useAppStore((s) => s.simpleMix);
  const contentScale = useAppStore((s) => s.contentScale);
  const mixable = theme === 'simple' || theme === 'simple-dark';

  return (
        <div className="flex h-full flex-col overflow-y-auto">
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
                    'phys-btn flex items-center gap-1.5 px-2.5 py-1 text-left transition-colors ' +
                    (active
                      ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]')
                  }
                  onClick={() => useAppStore.getState().setFont(f.id)}
                >
                  <span style={{ fontFamily: f.stack, fontSize: f.size, color: active ? 'var(--accent-foreground)' : 'var(--text-main)' }}>
                    {f.name}
                  </span>
                  {active ? <Check size={12} style={{ color: 'var(--accent-foreground)', flexShrink: 0 }} /> : null}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
            Кегль текста в блоках
          </div>
          <div className="flex flex-wrap gap-1 px-2 pb-2">
            {SIZES.map((s) => {
              const active = Math.abs(contentScale - s.v) < 0.001;
              return (
                <button
                  key={s.v}
                  className={
                    'phys-btn flex items-center gap-1.5 px-2.5 py-1 text-left transition-colors ' +
                    (active
                      ? 'bg-[var(--accent)] text-[var(--accent-foreground)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]')
                  }
                  onClick={() => useAppStore.getState().setContentScale(s.v)}
                >
                  <span
                    className="leading-none"
                    style={{ fontSize: 13 * s.v, color: active ? 'var(--accent-foreground)' : 'var(--text-main)' }}
                  >
                    {s.name}
                  </span>
                  {active ? <Check size={12} style={{ color: 'var(--accent-foreground)', flexShrink: 0 }} /> : null}
                </button>
              );
            })}
          </div>

          <div className="shrink-0 border-t border-[var(--border)] px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)] flex items-center justify-between">
            <span>Тема</span>
          </div>
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto px-2 pb-3 pt-1">
            {FAMILIES.map((fam) => {
              const activeDay = theme === fam.day;
              const activeNight = theme === fam.night;
              const dayMeta = THEME_META[fam.day];
              const nightMeta = THEME_META[fam.night];
              const card = (tid: ThemeId, meta: { name: string; hint: string }, active: boolean, tag: string) => (
                <button
                  key={tid}
                  className={
                    'phys-btn group flex min-w-0 flex-1 flex-col gap-1 px-2.5 py-2 text-left transition-colors ' +
                    (active
                      ? 'bg-[var(--accent)]'
                      : 'hover:bg-[var(--hover-bg)]')
                  }
                  onClick={() => useAppStore.getState().setTheme(tid)}
                >
                  <span className="flex items-center justify-between gap-1">
                    <span
                      className="text-[10.5px] font-semibold uppercase tracking-[0.12em]"
                      style={{ color: active ? 'var(--accent-foreground)' : 'var(--text-muted)', opacity: active ? 0.85 : 1 }}
                    >
                      {tag}
                    </span>
                    {active ? <Check size={12} style={{ color: 'var(--accent-foreground)', flexShrink: 0 }} /> : null}
                  </span>
                  <span
                    className="text-[10.5px] leading-snug"
                    style={{ color: active ? 'var(--accent-foreground)' : 'var(--text-muted)', opacity: active ? 0.85 : 1 }}
                  >
                    {meta.hint}
                  </span>
                </button>
              );
              return (
                <div key={fam.name} className="flex grow shrink-0 basis-auto flex-col gap-1">
                  <span
                    className="px-1 text-[10.5px] font-medium uppercase tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {fam.name}
                  </span>
                  <div className="flex grow shrink-0 basis-auto gap-1.5">
                    {card(fam.day, dayMeta, activeDay, 'ДЕНЬ')}
                    {card(fam.night, nightMeta, activeNight, 'НОЧЬ')}
                  </div>
                </div>
              );
            })}
          </div>


          {mixable ? (
            <>
              <div className="shrink-0 border-t border-[var(--border)] px-3 pb-1 pt-2.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)] flex items-center gap-1.5">
                <Settings2 size={12} />
                <span>Сборка «Персональной»</span>
              </div>
              <div className="px-3 pb-3 pt-1 text-[11.5px] leading-snug" style={{ color: 'var(--text-muted)' }}>
                Собери свою тему: возьми фон, карточки и акцент из любых других тем. Пусто — обычная «Персональная».
              </div>
              <MixRow
                label="Фон холста"
                value={simpleMix?.canvas ?? null}
                onChange={(v) => useAppStore.getState().setSimpleMix({ ...(simpleMix ?? { canvas: null, cards: null, accent: null }), canvas: v })}
              />
              <MixRow
                label="Плашки и карточки"
                value={simpleMix?.cards ?? null}
                onChange={(v) => useAppStore.getState().setSimpleMix({ ...(simpleMix ?? { canvas: null, cards: null, accent: null }), cards: v })}
              />
              <MixRow
                label="Акцент"
                value={simpleMix?.accent ?? null}
                onChange={(v) => useAppStore.getState().setSimpleMix({ ...(simpleMix ?? { canvas: null, cards: null, accent: null }), accent: v })}
              />
            </>
          ) : null}
        </div>
  );
}

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[120]" onPointerDown={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0, 0, 0, 0.32)' }} />
      <div
        className="settings-drawer absolute right-0 top-0 flex h-full flex-col border-l"
        style={{
          width: 'max(420px, 50vw)',
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          boxShadow: 'var(--menu-shadow)',
        }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div
          className="flex shrink-0 items-center justify-between border-b px-4 py-3"
          style={{ borderColor: 'var(--panel-border)' }}
        >
          <span
            className="text-[13px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--text-main)', fontFamily: 'var(--font-plex), system-ui, sans-serif' }}
          >
            ОФОРМЛЕНИЕ.
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <SettingsBody onClose={onClose} />
        </div>
      </div>
    </div>
  );
}

const MIX_OPTIONS: { value: ThemeId | null; label: string }[] = [
  { value: null, label: '— из Персональной —' },
  ...THEMES.filter((t) => t.id !== 'simple' && t.id !== 'simple-dark').map((t) => ({ value: t.id as ThemeId | null, label: t.name })),
];

function MixRow({ label, value, onChange }: { label: string; value: ThemeId | null; onChange: (v: ThemeId | null) => void }) {
  return (
    <div className="flex items-center gap-2 px-3 pb-2">
      <span className="w-36 shrink-0 text-[12.5px]" style={{ color: 'var(--text-main)' }}>
        {label}
      </span>
      <select
        className="phys-btn h-7 flex-1 px-2 text-[12.5px] outline-none"
        style={{
          background: 'var(--panel-bg)',
          borderColor: 'var(--panel-border)',
          color: 'var(--text-main)',
        }}
        value={value ?? ''}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === '' ? null : (v as ThemeId));
        }}
      >
        {MIX_OPTIONS.map((o) => (
          <option key={o.label} value={o.value ?? ''}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
