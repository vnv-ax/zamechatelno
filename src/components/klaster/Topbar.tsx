

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Box,
  Building2,
  ChevronLeft,
  CircleUserRound,
  FileDown,
  MoreHorizontal,
  Image as ImageIcon,
  Info,
  Layers,
  Link2,
  ListTodo,
  PenLine,
  Redo2,
  Search,
  Shapes,
  SquarePen,
  Text,
  Undo2,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Funnel, X } from 'lucide-react';
import type { CardStatus } from '@/lib/klaster/types';
import { useAppStore } from '@/lib/klaster/store';
import type { CardType } from '@/lib/klaster/types';
import { SettingsMenu } from './SettingsMenu';
import { PlainBgButton } from './PlainBgButton';
import { Hint } from './Hint';


const TOOLS: { type: CardType; label: string; desc?: string; icon: React.ReactNode }[] = [
  { type: 'note', label: 'Стикер', icon: <SquarePen size={16} strokeWidth={1.8} /> },
  { type: 'text', label: 'Заметка', icon: <Text size={16} strokeWidth={1.8} /> },
  { type: 'todo', label: 'Список', icon: <ListTodo size={16} strokeWidth={1.8} /> },
  { type: 'image', label: 'Изображение', icon: <ImageIcon size={16} strokeWidth={1.8} /> },
  { type: 'link', label: 'Ссылка', icon: <Link2 size={16} strokeWidth={1.8} /> },
  { type: 'catalog', label: 'Каталог', icon: <Bookmark size={16} strokeWidth={1.8} /> },
  { type: 'subject', label: 'Субъект', icon: <CircleUserRound size={16} strokeWidth={1.8} /> },
  { type: 'organization', label: 'Организация', icon: <Building2 size={16} strokeWidth={1.8} /> },
  { type: 'object', label: 'Объект', icon: <Box size={16} strokeWidth={1.8} /> },
  { type: 'board', label: 'Вложенный лист', icon: <Layers size={16} strokeWidth={1.8} /> },
  { type: 'shape', label: 'Фигура', icon: <Shapes size={16} strokeWidth={1.8} /> },
  { type: 'draw', label: 'Рисование', icon: <PenLine size={16} strokeWidth={1.8} /> },
];

function BoardTitleInput({
  boardId,
  initial,
  onDone,
}: {
  boardId: string;
  initial: string;
  onDone: () => void;
}) {
  const [value, setValue] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.select(), []);

  const commit = () => {
    useAppStore.getState().renameBoard(boardId, value.trim() || 'Без названия');
    useAppStore.getState().openContextMenu(null);
    onDone();
  };

  return (
    <input
      autoFocus
      className="h-7 rounded border border-[var(--accent)] px-2 text-[13.5px] font-medium outline-none"
      style={{ color: 'var(--text-main)', width: Math.max(120, value.length * 9 + 30), background: 'var(--panel-bg)' }}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur();
      }}
    />
  );
}

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
            <MoreHorizontal size={16} />
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
          <MoreHorizontal size={13} className="shrink-0" />
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

const iconBtn =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]';

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
      <Hint label="Фильтр по состояниям и тегам" side="bottom">
        <PopoverTrigger asChild>
          <button
            className={iconBtn + (active ? ' text-[var(--accent)]' : '')}
            aria-label="Фильтр"
          >
            <Funnel size={16} />
          </button>
        </PopoverTrigger>
      </Hint>
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
              <X size={13} />
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
          <Info size={16} />
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

export function Topbar({ boardId }: { boardId: string }) {
  const breadcrumb = useAppStore((s) => s.breadcrumb);
  const boards = useAppStore((s) => s.boards);
  const pastLen = useAppStore((s) => s.past.length);
  const futureLen = useAppStore((s) => s.future.length);
  const dragNewType = useAppStore((s) => s.dragNewType);
  const drawMode = useAppStore((s) => s.drawMode);
  const [titleEditing, setTitleEditing] = useState(false);

  const board = boards[boardId];
  const st = useAppStore.getState();


  const title = board?.title || 'Без названия';

  return (
    <header className="topbar z-40 flex h-12 shrink-0 items-center gap-1 overflow-hidden border-b border-[var(--chrome-border, var(--panel-border))] px-2">
      <Hint label={breadcrumb.length > 1 ? 'На уровень выше' : 'На главную'} side="bottom">
        <button
          className={iconBtn}
          aria-label={breadcrumb.length > 1 ? 'На уровень выше' : 'На главную'}
          onClick={() => {
            if (breadcrumb.length > 1) st.navigateTo(breadcrumb.length - 2);
            else st.setView('home');
          }}
        >
          <ChevronLeft size={17} />
        </button>
      </Hint>

      {}
      <AddressMenu />

      {}
      {titleEditing ? (
        <BoardTitleInput boardId={boardId} initial={title} onDone={() => setTitleEditing(false)} />
      ) : (
        <Hint label="Название листа" desc={title + ' · двойной клик — переименовать'} side="bottom">
          <button
            className="min-w-[48px] max-w-[240px] shrink truncate rounded px-1.5 py-1 text-left text-[13.5px] font-medium"
            style={{ color: 'var(--text-main)' }}
            aria-label="Название листа"
            onDoubleClick={() => setTitleEditing(true)}
          >
            {title}
          </button>
        </Hint>
      )}

      <div className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />

      {}
      <div className="flex shrink-0 items-center gap-0.5">
        {TOOLS.map((t) => {
          const isActive = t.type === 'draw' ? drawMode : dragNewType === t.type;
          const label = t.type === 'draw' && drawMode ? 'Завершить рисунок' : t.label;
          const description = t.type === 'draw' && drawMode
            ? 'Сохранить все штрихи одним объектом'
            : t.desc;
          return (
            <Hint key={t.type} label={label} desc={description} side="bottom">
              <button
                aria-label={label}
                className={
                  'flex h-8 w-8 items-center justify-center rounded-lg transition-colors ' +
                  (isActive ? 'bg-[var(--accent-soft)] text-[var(--accent-strong)]' : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]')
                }
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
              >
                {t.icon}
              </button>
            </Hint>
          );
        })}
      </div>

      <div className="flex-1" />

      <Hint label="Отменить" desc="Ctrl+Z" side="bottom">
        <button
          className={iconBtn}
          aria-label="Отменить"
          disabled={!pastLen}
          onClick={() => st.undo()}
        >
          <Undo2 size={16} />
        </button>
      </Hint>
      <Hint label="Повторить" desc="Ctrl+Shift+Z" side="bottom">
        <button
          className={iconBtn}
          aria-label="Повторить"
          disabled={!futureLen}
          onClick={() => st.redo()}
        >
          <Redo2 size={16} />
        </button>
      </Hint>
      <div className="mx-1 h-5 w-px shrink-0 bg-[var(--panel-border)]" />
      <Hint label="Поиск" desc="Ctrl+K" side="bottom">
        <button className={iconBtn} aria-label="Поиск" onClick={() => st.setSearchOpen(true)}>
          <Search size={16} />
        </button>
      </Hint>
      <StatusFilterMenu />
      <PlainBgButton />
      <SettingsMenu />
      <button
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[var(--panel-border)] px-2.5 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)] hover:text-[var(--text-main)]"
        aria-label="Выгрузить лист в JSON"
        onClick={() => st.setExportOpen(true)}
      >
        <FileDown size={14} />
        Выгрузить
      </button>
    </header>
  );
}
