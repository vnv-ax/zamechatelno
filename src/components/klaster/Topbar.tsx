

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Funnel, Search } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useReducer } from 'react';
import type { CardStatus } from '@/lib/klaster/types';
import { useAppStore } from '@/lib/klaster/store';
import type { CardType } from '@/lib/klaster/types';
import { SettingsDialog } from './SettingsMenu';
import { Hint } from './Hint';

type RteEditor = {
  isActive: (name: string | Record<string, unknown>) => boolean;
  getAttributes: (name: string) => Record<string, unknown>;
  chain: () => {
    focus: () => {
      run: () => void;
      toggleBold: () => unknown;
      toggleItalic: () => unknown;
      toggleUnderline: () => unknown;
      toggleBulletList: () => unknown;
      toggleOrderedList: () => unknown;
      setTextAlign: (a: 'left' | 'center' | 'right') => unknown;
      setFontSize: (s: string) => unknown;
      unsetFontSize: () => unknown;
    };
  };
  on: (ev: string, cb: () => void) => void;
  off: (ev: string, cb: () => void) => void;
};

const FONT_STEPS = [11, 12, 14, 16, 18, 22, 26, 32];

/** Панель форматирования текста в верхнем баре — появляется при правке заметки/текста */
function RteToolbar({ editor }: { editor: RteEditor }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const h = () => force();
    editor.on('transaction', h);
    return () => editor.off('transaction', h);
  });

  const btn = (active: boolean, label: React.ReactNode, title: string, run: () => void) => (
    <button
      key={title}
      aria-label={title}
      title={title}
      data-nodrag
      className={
        'flex h-8 min-w-8 items-center justify-center rounded-lg px-1.5 text-[13px] transition-colors ' +
        (active ? 'bg-[var(--accent-soft)] font-semibold text-[var(--accent-strong)]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]')
      }
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        run();
        editor.chain().focus().run();
      }}
    >
      {label}
    </button>
  );

  const curSize = parseInt(String(editor.getAttributes('textStyle').fontSize ?? '')) || 14;
  const stepSize = (dir: -1 | 1) => {
    const idx = FONT_STEPS.findIndex((v) => v >= curSize);
    const next = FONT_STEPS[Math.max(0, Math.min(FONT_STEPS.length - 1, (idx === -1 ? 2 : idx) + dir))];
    if (next === curSize && dir === -1 && idx <= 0) return editor.chain().focus().unsetFontSize().run();
    editor.chain().focus().setFontSize(`${next}px`).run();
  };

  return (
    <div className="rte-topbar flex items-center gap-0.5">
      {btn(false, <span title="">−</span>, 'Меньше текст', () => stepSize(-1))}
      {btn(false, <span title="">+</span>, 'Больше текст', () => stepSize(1))}
      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />
      {btn(editor.isActive('bold'), <b>Ж</b>, 'Жирный (Ctrl+B)', () => editor.chain().focus().toggleBold().run())}
      {btn(editor.isActive('italic'), <i>К</i>, 'Курсив (Ctrl+I)', () => editor.chain().focus().toggleItalic().run())}
      {btn(editor.isActive('underline'), <u>Ч</u>, 'Подчёркнутый (Ctrl+U)', () => editor.chain().focus().toggleUnderline().run())}
      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />
      {btn(editor.isActive({ textAlign: 'left' }), 'Л', 'По левому краю', () => editor.chain().focus().setTextAlign('left').run())}
      {btn(editor.isActive({ textAlign: 'center' }), 'Ц', 'По центру', () => editor.chain().focus().setTextAlign('center').run())}
      {btn(editor.isActive({ textAlign: 'right' }), 'П', 'По правому краю', () => editor.chain().focus().setTextAlign('right').run())}
      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />
      {btn(editor.isActive('orderedList'), '1.', 'Нумерованный список', () => editor.chain().focus().toggleOrderedList().run())}
      {btn(editor.isActive('bulletList'), '•', 'Список через точки', () => editor.chain().focus().toggleBulletList().run())}
    </div>
  );
}

/** Инструменты создания карточек — в порядке из меню, с разделителями-знаками. */
const TOOLS: { type: CardType; label: string; aria: string; sep: string }[] = [
  { type: 'note', label: 'СТИКЕР,', aria: 'Стикер', sep: ',' },
  { type: 'text', label: 'ТЕКСТ,', aria: 'Текст', sep: ',' },
  { type: 'todo', label: 'СПИСОК,', aria: 'Список', sep: ',' },
  { type: 'image', label: 'ИЗОБРАЖЕНИЕ,', aria: 'Изображение', sep: ',' },
  { type: 'catalog', label: 'ССЫЛКИ,', aria: 'Каталог ссылок', sep: ',' },
  { type: 'object', label: 'ОБЪЕКТ,', aria: 'Объект', sep: ',' },
  { type: 'subject', label: 'СУБЪЕКТ,', aria: 'Субъект', sep: ',' },
  { type: 'organization', label: 'ОРГАНИЗАЦИЯ;', aria: 'Организация', sep: ';' },
  { type: 'draw', label: 'РИСОВАНИЕ;', aria: 'Рисование', sep: ';' },
  { type: 'board', label: 'ЛИСТ.', aria: 'Вложенный лист', sep: '' },
];

/** Кнопка-инструмент: слово заглавными, при наведении ничего не меняется,
 *  но под курсором моментально всплывает маленькая надпись «тащи». */
function TachtsiWord({
  label,
  ariaLabel,
  active,
  onPointerDown,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  active?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <span
      className="relative mr-[5px] inline-flex items-center"
      style={{ cursor: 'default' }}
      onPointerEnter={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onPointerMove={(e) => setPos({ x: e.clientX, y: e.clientY })}
      onPointerLeave={() => setPos(null)}
    >
      <button
        type="button"
        aria-label={ariaLabel ?? label}
        data-nodrag
        className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
        style={{
          color: active ? 'var(--accent-strong)' : 'var(--text-secondary)',
          cursor: 'default',
          background: 'transparent',
        }}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        {label}
      </button>
      {pos ? (
        <span
          className="select-none"
          style={{
            position: 'fixed',
            left: pos.x + 8,
            top: pos.y - 20,
            zIndex: 90,
            pointerEvents: 'none',
            fontSize: 10,
            lineHeight: 1,
            padding: '1px 2px 2px',
            color: 'var(--text-muted)',
            borderBottom: '1px dashed var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          тащи
        </span>
      ) : null}
    </span>
  );
}

/** Слово-кнопка без «тащи» (для функций): тоже без реакции на наведение. */
function WordButton({
  label,
  onClick,
  disabled,
  active,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
      style={{
        color: disabled
          ? 'var(--text-faint)'
          : active
            ? 'var(--accent-strong)'
            : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        background: 'transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function IconWordButton({
  children,
  onClick,
  disabled,
  active,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center"
      style={{
        color: disabled ? 'var(--text-faint)' : active ? 'var(--accent-strong)' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        background: 'transparent',
      }}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

const SEP = 'inline-block select-none px-[3px] text-[12px] leading-none text-[var(--text-faint)]';

function AddressMenu() {
  const breadcrumb = useAppStore((s) => s.breadcrumb);
  const boards = useAppStore((s) => s.boards);
  const [open, setOpen] = useState(false);
  const st = useAppStore.getState();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Hint label="Адрес листа" desc="путь по вложенным листам" side="bottom">
        <PopoverTrigger asChild>
          <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]" aria-label="Адрес листа">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="8" r="1.4" />
              <circle cx="8" cy="8" r="1.4" />
              <circle cx="13" cy="8" r="1.4" />
            </svg>
          </button>
        </PopoverTrigger>
      </Hint>
      <PopoverContent align="start" className="w-[300px] p-1.5">
        <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Адрес листа
        </div>
        <button
          className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] hover:bg-[var(--hover-bg)]"
          style={{ color: 'var(--text-secondary)' }}
          onClick={() => {
            st.setView('home');
            setOpen(false);
          }}
        >
          Главная страница
        </button>
        {breadcrumb.map((bid, i) => {
          const isCurrent = i === breadcrumb.length - 1;
          const title = boards[bid]?.title || 'Без названия';
          return (
            <Hint key={bid} label={title} side="right">
              <button
                className={
                  'flex w-full items-center gap-2 rounded-md py-1.5 pr-2.5 text-left text-[13px] ' +
                  (isCurrent ? '' : 'hover:bg-[var(--hover-bg)]')
                }
                style={{
                  paddingLeft: 10 + i * 14,
                  color: isCurrent ? 'var(--text-main)' : 'var(--text-secondary)',
                  fontWeight: isCurrent ? 600 : 400,
                  background: isCurrent ? 'var(--accent-soft)' : undefined,
                }}
                onClick={() => {
                  if (!isCurrent) st.navigateTo(i);
                  setOpen(false);
                }}
              >
                <span className="h-[6px] w-[6px] shrink-0 rounded-full" style={{ background: isCurrent ? 'var(--accent)' : 'var(--text-faint)' }} />
                <span className="min-w-0 flex-1 truncate">{title}</span>
              </button>
            </Hint>
          );
        })}
        {breadcrumb.length > 1 ? (
          <div className="px-2.5 pb-1 pt-1 text-[10.5px] leading-snug text-[var(--text-faint)]">
            Клик по странице адреса — переход к ней
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function StatusFilterMenu({ textMode }: { textMode: boolean }) {
  const statusFilter = useAppStore((s) => s.statusFilter);
  const tagFilter = useAppStore((s) => s.tagFilter);
  const setStatusFilter = useAppStore((s) => s.setStatusFilter);
  const setTagFilter = useAppStore((s) => s.setTagFilter);
  const [tagDraft, setTagDraft] = useState(tagFilter ?? '');
  const [open, setOpen] = useState(false);
  const active = statusFilter !== null || tagFilter !== null;
  const statuses: { id: CardStatus; label: string }[] = [
    { id: 'urgent', label: 'Срочно' },
    { id: 'actual', label: 'Актуально' },
    { id: 'done', label: 'Выполнено' },
  ];
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {textMode ? (
          <button
            aria-label="Фильтр"
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
            style={{
              color: active ? 'var(--accent-strong)' : 'var(--text-secondary)',
              cursor: 'pointer',
              background: 'transparent',
            }}
          >
            ФИЛЬТР
          </button>
        ) : (
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[var(--text-secondary)]"
            style={{ cursor: 'pointer', background: 'transparent' }}
            aria-label="Фильтр"
          >
            <Funnel size={15} />
          </button>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-3">
        <div className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Состояние
        </div>
        <div className="flex flex-col gap-0.5">
          {statuses.map((st) => (
            <button
              key={st.id}
              className={
                'flex items-center gap-2 rounded-md px-2 py-1 text-left text-[13px] transition-colors ' +
                (statusFilter === st.id
                  ? 'bg-[var(--accent-soft)] text-[var(--text-main)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]')
              }
              onClick={() => setStatusFilter(statusFilter === st.id ? null : st.id)}
            >
              {st.id === 'urgent' ? <span className="state-badge status-urgent">!</span> : null}
              {st.id === 'actual' ? (
                <span className="state-badge status-actual"><span className="diode diode-glow" /></span>
              ) : null}
              {st.id === 'done' ? (
                <span className="state-badge status-done"><span className="diode" /></span>
              ) : null}
              {st.label}
            </button>
          ))}
        </div>
        <div className="mt-2 mb-1 text-[10.5px] font-medium uppercase tracking-wide text-[var(--text-muted)]">
          Тег (можно вложенный #цитаты/Сталин)
        </div>
        <div className="flex items-center gap-1.5">
          <input
            className="min-w-0 flex-1 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1.5 text-[12.5px] text-[var(--text-main)] outline-none focus:border-[var(--accent)]"
            placeholder="#цитаты…"
            value={tagDraft}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                const t = tagDraft.trim().replace(/^#/, '');
                setTagFilter(t || null);
                setOpen(false);
              }
            }}
          />
          {tagFilter ? (
            <button
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
              aria-label="Сбросить тег"
              onClick={() => {
                setTagFilter(null);
                setTagDraft('');
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>
        {tagFilter ? (
          <div className="mt-1.5 text-[11.5px] text-[var(--text-muted)]">
            Фильтр: <span style={{ color: 'var(--accent)' }}>#{tagFilter}</span> — включая вложенные
          </div>
        ) : null}
        {active ? (
          <button
            className="mt-2 w-full rounded-md border border-[var(--panel-border)] px-2 py-1 text-[12px] text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            onClick={() => {
              setStatusFilter(null);
              setTagFilter(null);
              setTagDraft('');
            }}
          >
            Сбросить фильтр
          </button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

export function InfoMenu() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Информация о приложении"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-0">
        <div className="px-4 pb-1 pt-3.5 text-[13px] font-semibold" style={{ color: 'var(--text-main)' }}>
          Информация
        </div>
        <div className="flex flex-col gap-2 px-4 pb-4 pt-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <div>
            <span className="font-medium" style={{ color: 'var(--text-main)' }}>«Замечательно»</span> — цифровое убежище от облачных сервисов и ии-агентов. Ламповые бесконечные листы для дел, забот и творчества.
          </div>
          <div>
            Все данные хранятся локально и никуда не отправляются.
          </div>
          <div>
            <span className="font-medium" style={{ color: 'var(--text-main)' }}>Внимание!</span> Это демонстрация возможностей «Замечательно». Для полноценного использования скачайте версию десктопа и таскайте с собой по необходимости на флешке.
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** «И:» — сворачивает ПОИСК, ФИЛЬТР, ОФОРМЛЕНИЕ и ЭКСПОРТ в горизонтальное меню. */
function ExtrasMenu({ onSearch, onExport, onSettings }: { onSearch: () => void; onExport: () => void; onSettings: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="inline-flex items-center">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            aria-label="И: поиск, фильтр, оформление, экспорт"
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
            style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent', fontFamily: 'inherit' }}
          >
            И:
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto p-1.5" side="bottom">
          <div className="flex items-center whitespace-nowrap">
            <button
              className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
              style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent' }}
              onClick={() => {
                setOpen(false);
                onSearch();
              }}
            >
              ПОИСК
            </button>
            <span className={SEP}>, </span>
            <StatusFilterMenu textMode />
            <span className={SEP}> | </span>
            <button
              className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
              style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent' }}
              onClick={() => {
                setOpen(false);
                onSettings();
              }}
            >
              ОФОРМЛЕНИЕ.
            </button>
            <span className={SEP}> | </span>
            <button
              className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
              style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent' }}
              onClick={() => {
                setOpen(false);
                onExport();
              }}
            >
              ЭКСПОРТ.
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </span>
  );
}

export function Topbar({ boardId }: { boardId: string }) {
  const breadcrumb = useAppStore((s) => s.breadcrumb);
  const pastLen = useAppStore((s) => s.past.length);
  const futureLen = useAppStore((s) => s.future.length);
  const dragNewType = useAppStore((s) => s.dragNewType);
  const drawMode = useAppStore((s) => s.drawMode);
  const searchOpen = false;
  void searchOpen;

  // Постепенная деградация текстового меню:
  // 1 — ОТМЕНА/ПОВТОР стрелочками, 2 — ПОИСК/ФИЛЬТР значками, 3 — ОФОРМЛЕНИЕ/ЭКСПОРТ значками.
  const [level, setLevel] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);
  const growTimer = useRef<number | null>(null);
  const lastWidth = useRef<number>(0);

  useLayoutEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    // не влезло — деградируем на уровень дальше (до предела)
    if (header.scrollWidth > header.clientWidth + 1) {
      setLevel(1);
    }
  });

  useEffect(() => {
    const header = headerRef.current;
    if (!header || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width ?? 0;
      // окно стало шире — пробуем вернуть уровень текста назад
      if (w > lastWidth.current + 40) {
        if (growTimer.current) window.clearTimeout(growTimer.current);
        growTimer.current = window.setTimeout(() => setLevel((l) => Math.max(0, l - 1)), 150);
      }
      lastWidth.current = w;
    });
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Панель форматирования вместо меню, когда правится текст карточки
  const rteEditor = useAppStore((s) => s.rteEditor) as RteEditor | null;
  const editingId = useAppStore((s) => s.editingId);
  const rteActive = !!rteEditor && !!editingId;
  const theme = useAppStore((s) => s.theme);
  const glassStyle =
    theme === 'apple' || theme === 'apple-night'
      ? { backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }
      : undefined;

  const st = useAppStore.getState();

  return (
    <header
      ref={headerRef}
      className="topbar z-40 flex h-12 shrink-0 items-center gap-0 overflow-hidden border-b border-[var(--chrome-border, var(--panel-border))] px-2"
      style={{ fontFamily: "var(--font-plex), system-ui, sans-serif", ...glassStyle }}
    >
      {rteActive && rteEditor ? (
        <RteToolbar editor={rteEditor} />
      ) : (
        <>
          <button
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            aria-label={breadcrumb.length > 1 ? 'На уровень выше' : 'На главную'}
            onClick={() => {
              if (breadcrumb.length > 1) st.navigateTo(breadcrumb.length - 2);
              else st.setView('home');
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <AddressMenu />

          <span className="mx-1.5 h-5 w-px shrink-0 bg-[var(--panel-border)]" />

          {level === 0 && TOOLS.filter((t) => t.type === 'draw').map((t) => {
            const isActive = drawMode;
            return (
              <TachtsiWord
                key={t.type}
                label={t.label}
                ariaLabel={t.aria}
                active={isActive}
                onClick={() => {
                  const store = useAppStore.getState();
                  store.setDragNewType(null);
                  store.setDrawMode(!store.drawMode);
                }}
              />
            );
          })}

          {level === 1 ? (
            <>
              <span className={SEP}> | </span>
              <TachtsiWord
                label="РИСОВАНИЕ."
                ariaLabel="Рисование"
                active={drawMode}
                onClick={() => {
                  const store = useAppStore.getState();
                  store.setDragNewType(null);
                  store.setDrawMode(!store.drawMode);
                }}
              />
              <span className={SEP}> | </span>
              <WordButton label="<-" ariaLabel="Отменить" disabled={!pastLen} onClick={() => st.undo()} />
              <span className="inline-block w-[6px]" />
              <WordButton label="->" ariaLabel="Повторить" disabled={!futureLen} onClick={() => st.redo()} />
              <span className={SEP}> | </span>
              <ExtrasMenu
                onSearch={() => st.setSearchOpen(true)}
                onExport={() => st.setExportOpen(true)}
                onSettings={() => setSettingsOpen(true)}
              />
            </>
          ) : null}

          {TOOLS.filter((t) => level === 0 || t.type !== 'draw').map((t) => {
            const isActive = t.type === 'draw' ? drawMode : dragNewType === t.type;
            return (
              <TachtsiWord
                key={t.type}
                label={t.label}
                ariaLabel={t.aria}
                active={isActive}
                onPointerDown={(e) => {
                  if (t.type === 'draw') return;
                  e.preventDefault();
                  useAppStore.getState().setDragNewType(t.type);
                }}
                onClick={() => {
                  if (t.type !== 'draw') return;
                  const store = useAppStore.getState();
                  store.setDragNewType(null);
                  store.setDrawMode(!store.drawMode);
                }}
              />
            );
          })}

          {level === 0 ? (
            <span className="inline-flex items-center">
              <span className={SEP}> | </span>
              <WordButton
                label="ОТМЕНА"
                ariaLabel="Отменить"
                disabled={!pastLen}
                onClick={() => st.undo()}
              />
              <span className={SEP}>; </span>
              <WordButton
                label="ПОВТОР"
                ariaLabel="Повторить"
                disabled={!futureLen}
                onClick={() => st.redo()}
              />
            </span>
          ) : null}

          {level === 0 ? (
            <>
              <WordButton label="ПОИСК" ariaLabel="Поиск" onClick={() => st.setSearchOpen(true)} />
              <span className={SEP}>, </span>
              <StatusFilterMenu textMode />
              <span className={SEP}> | </span>
              <WordButton label="ОФОРМЛЕНИЕ." ariaLabel="Оформление" onClick={() => setSettingsOpen(true)} />
              <span className={SEP}> | </span>
              <WordButton label="ЭКСПОРТ." ariaLabel="Выгрузить лист в JSON" onClick={() => st.setExportOpen(true)} />
            </>
          ) : (
            <ExtrasMenu
              onSearch={() => st.setSearchOpen(true)}
              onExport={() => st.setExportOpen(true)}
              onSettings={() => setSettingsOpen(true)}
            />
          )}
        </>
      )}

      <div className="flex-1" />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </header>
  );
}
