

'use client';

import { useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/lib/klaster/store';
import type { CardStatus, CardType } from '@/lib/klaster/types';
import { zoomTo } from './Canvas';
import { SettingsDialog } from './SettingsMenu';
import { BailOutDialog } from './Dialogs';

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

/** Панель форматирования — появляется при правке заметки/текста вместо меню. */
function RteToolbar({ editor }: { editor: RteEditor }) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => {
    const h = () => force();
    editor.on('transaction', h);
    return () => editor.off('transaction', h);
  });

  const btn = (label: React.ReactNode, ariaLabel: string, run: () => void) => (
    <button
      key={ariaLabel}
      aria-label={ariaLabel}
      data-nodrag
      className="word-btn flex h-7 min-w-7 items-center justify-center px-1.5 text-[12.5px] font-medium leading-none tracking-[0.06em] text-[var(--text-secondary)]"
      style={{ cursor: 'pointer', background: 'transparent', borderRadius: 0 }}
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
      {btn(<span>−</span>, 'Меньше текст', () => stepSize(-1))}
      {btn(<span>+</span>, 'Больше текст', () => stepSize(1))}
      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />
      {btn(<b>Ж</b>, 'Жирный', () => editor.chain().focus().toggleBold().run())}
      {btn(<i>К</i>, 'Курсив', () => editor.chain().focus().toggleItalic().run())}
      {btn(<u>Ч</u>, 'Подчёркнутый', () => editor.chain().focus().toggleUnderline().run())}
      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />
      {btn('Л', 'По левому краю', () => editor.chain().focus().setTextAlign('left').run())}
      {btn('Ц', 'По центру', () => editor.chain().focus().setTextAlign('center').run())}
      {btn('П', 'По правому краю', () => editor.chain().focus().setTextAlign('right').run())}
      <span className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />
      {btn('1.', 'Нумерованный список', () => editor.chain().focus().toggleOrderedList().run())}
      {btn('•', 'Список через точки', () => editor.chain().focus().toggleBulletList().run())}
    </div>
  );
}

/** Инструменты: пунктуация внутри слова. Порядок как в нижнем баре. */
const TOOLS: { type: CardType; label: string; aria: string }[] = [
  { type: 'note', label: 'СТИКЕР,', aria: 'Стикер' },
  { type: 'text', label: 'ТЕКСТ,', aria: 'Текст' },
  { type: 'todo', label: 'СПИСОК,', aria: 'Список' },
  { type: 'image', label: 'ИЗОБРАЖЕНИЕ,', aria: 'Изображение' },
  { type: 'catalog', label: 'ССЫЛКИ,', aria: 'Каталог ссылок' },
  { type: 'object', label: 'ОБЪЕКТ,', aria: 'Объект' },
  { type: 'subject', label: 'СУБЪЕКТ,', aria: 'Субъект' },
  { type: 'organization', label: 'ОРГАНИЗАЦИЯ;', aria: 'Организация' },
  { type: 'board', label: 'ЛИСТ.', aria: 'Вложенный лист' },
];

/** Слово-инструмент: наведение и нажатие ничего не меняют; под курсором
 *  моментально появляется «ТЯНИ», а при начале тяги оно исчезает
 *  (вместо него курсор сопровождает иконка того, что тащится). */
function TachtsiWord({
  label,
  ariaLabel,
  dragging,
  onPointerDown,
  onClick,
}: {
  label: string;
  ariaLabel?: string;
  dragging?: boolean;
  onPointerDown?: (e: React.PointerEvent) => void;
  onClick?: () => void;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  return (
    <span
      className="relative inline-flex items-center"
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
          color: 'var(--text-secondary)',
          cursor: 'default',
          background: 'transparent',
        }}
        onPointerDown={onPointerDown}
        onClick={onClick}
      >
        {label}
      </button>
      {pos && !dragging
        ? createPortal(
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
              ТЯНИ
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}

/** Слово-кнопка функций: тоже без каких-либо реакций. */
function WordButton({
  label,
  onClick,
  disabled,
  ariaLabel,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
      style={{
        color: disabled ? 'var(--text-faint)' : 'var(--text-secondary)',
        cursor: disabled ? 'default' : 'pointer',
        background: 'transparent',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}

function AddressMenu() {
  const breadcrumb = useAppStore((s) => s.breadcrumb);
  const boards = useAppStore((s) => s.boards);
  const [open, setOpen] = useState(false);
  const st = useAppStore.getState();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
          style={{ color: 'var(--text-secondary)', cursor: 'pointer', background: 'transparent' }}
          aria-label="Адрес листа"
        >
          ...
        </button>
      </PopoverTrigger>
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
            <button
              key={bid}
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

function StatusFilterMenu() {
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
        <button
          aria-label="Фильтр"
          className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
          style={{
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            background: 'transparent',
          }}
        >
          ФИЛЬТР,
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-3">
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

export function BottomBar({ boardId }: { boardId: string }) {
  const pastLen = useAppStore((s) => s.past.length);
  const futureLen = useAppStore((s) => s.future.length);
  const dragNewType = useAppStore((s) => s.dragNewType);
  const drawMode = useAppStore((s) => s.drawMode);
  const zoom = useAppStore((s) => s.viewports[boardId]?.zoom ?? 1);
  const percent = Math.round(zoom * 100);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bailOut, setBailOut] = useState(false);
  const fitZoomRef = useRef(1);

  // Панель форматирования вместо меню, когда правится текст карточки
  const rteEditor = useAppStore((s) => s.rteEditor) as RteEditor | null;
  const editingId = useAppStore((s) => s.editingId);
  const rteActive = !!rteEditor && !!editingId;

  const st = useAppStore.getState();

  // авто-подгон: меряем ширину строки контента и ужимаем панель со шрифтом
  // (zoom) так, чтобы всё ровно влезло в экран; zoom у Chromium входит в
  // getBoundingClientRect, поэтому база = ширина / текущий зум
  const panelRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [fitZoom, setFitZoom] = useState(1);

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const recompute = () => {
      const scaled = content.getBoundingClientRect().width;
      const base = scaled / (fitZoomRef.current || 1);
      if (base <= 0) return;
      const next = Math.min(1, Math.max(0.55, (window.innerWidth - 8) / base));
      if (Math.abs(next - fitZoomRef.current) > 0.005) {
        fitZoomRef.current = next;
        setFitZoom(next);
      }
    };
    recompute();
    // шрифты мог ещё не подгрузить — пересчитать после загрузки
    if (typeof document !== 'undefined' && (document as unknown as { fonts?: { ready: Promise<unknown> } }).fonts?.ready) {
      void (document as unknown as { fonts: { ready: Promise<unknown> } }).fonts.ready.then(recompute);
    }
  });

  useEffect(() => {
    const onResize = () => setFitZoom((z) => z); // перезапуск layout-эффекта
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center">
      <div
        ref={panelRef}
        className="bottombar-panel pointer-events-auto flex w-full items-center overflow-hidden px-3 py-1.5"
        style={{
          fontFamily: 'var(--font-plex), system-ui, sans-serif',
          zoom: fitZoom,
        }}
      >
        <div ref={contentRef} className="inline-flex items-center gap-[6px] whitespace-nowrap">
        {rteActive && rteEditor ? (
          <RteToolbar editor={rteEditor} />
        ) : (
          <>
            <AddressMenu />


            {TOOLS.map((t) => (
              <TachtsiWord
                key={t.type}
                label={t.label}
                ariaLabel={t.aria}
                dragging={dragNewType === t.type}
                onPointerDown={(e) => {
                  e.preventDefault();
                  useAppStore.getState().setDragNewType(t.type);
                }}
              />
            ))}


            <span className="inline-flex items-center" style={{ color: drawMode ? 'var(--accent-strong)' : undefined }}>
              <WordButton
                label="РИСОВАНИЕ."
                ariaLabel="Рисование"
                onClick={() => {
                const store = useAppStore.getState();
                store.setDragNewType(null);
                store.setDrawMode(!store.drawMode);
              }}
              />
            </span>


            <WordButton
              label="ВЕРНУТЬ,"
              ariaLabel="Вернуть (отменить)"
              disabled={!pastLen}
              onClick={() => st.undo()}
            />
            <WordButton
              label="ПОВТОРИТЬ?"
              ariaLabel="Повторить"
              disabled={!futureLen}
              onClick={() => st.redo()}
            />


            <WordButton label="ВИД;" ariaLabel="Оформление" onClick={() => setSettingsOpen(true)} />


            <StatusFilterMenu />
            <WordButton label="ПОИСК;" ariaLabel="Поиск" onClick={() => st.setSearchOpen(true)} />



            <WordButton
              label={percent + '%'}
              ariaLabel="Сбросить масштаб"
              onClick={() => zoomTo(boardId, 1)}
            />



            <WordButton label="ПОДМОГНУТЬ." ariaLabel="Связаться с автором" onClick={() => setBailOut(true)} />
          </>
        )}

        </div>
        <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <BailOutDialog open={bailOut} onClose={() => setBailOut(false)} />
      </div>
    </div>
  );
}
