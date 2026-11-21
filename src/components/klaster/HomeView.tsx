
'use client';

import { useMemo, useRef, useState } from 'react';
import {
  Copy,
  FileDown,
  FileUp,
  MoreVertical,
  PenLine,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '@/lib/klaster/store';
import { exportBoards } from '@/lib/klaster/download';
import { BoardThumb } from './BoardThumb';
import { HomeCalendar } from './HomeCalendar';
import { SettingsDialog } from './SettingsMenu';
import { SettingsMenu } from './SettingsMenu';
import { InfoMenu } from './Topbar';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

function formatDate(ts: number): string {
  const d = new Date(ts);
  const now = Date.now();
  const diff = now - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const day = Math.floor(h / 24);
  if (day === 1) return 'вчера';
  if (day < 7) return `${day} дн назад`;
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function Logo() {
  return (
    <span className="text-[16px] font-semibold tracking-tight" style={{ color: 'var(--text-main)' }}>Замечательно</span>
  );
}

export function HomeView() {
  const boards = useAppStore((s) => s.boards);
  const [query, setQuery] = useState('');
  const backupOn = useAppStore((s) => s.backupOnExit);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const rootBoards = useMemo(() => {
    const referenced = new Set<string>();
    for (const b of Object.values(boards)) {
      for (const c of b.cards) {
        if (c.data.kind === 'board') referenced.add(c.data.boardId);
      }
    }
    return Object.values(boards)
      .filter((b) => !referenced.has(b.id))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [boards]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rootBoards;
    return rootBoards.filter((b) => b.title.toLowerCase().includes(q));
  }, [rootBoards, query]);

  const createBoard = () => {
    const st = useAppStore.getState();
    const id = st.createBoard('Новый лист');
    st.openBoardRoot(id);
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const json = JSON.parse(String(reader.result));
        const ok = useAppStore.getState().importBoards(json);
        toast(
          ok
            ? { title: 'Листы импортированы' }
            : { title: 'Не удалось прочитать файл', description: 'Ожидается JSON, выгруженный из «Замечательно».' }
        );
      } catch {
        toast({ title: 'Не удалось прочитать файл' });
      }
    };
    reader.readAsText(file);
  };

  return (
    <div
      className="flex min-h-screen flex-col bg-[var(--page-bg)]"
      style={{
        backgroundImage: 'var(--page-image, none)',
        backgroundSize: 'var(--page-image-size, auto)',
        backgroundAttachment: 'fixed',
      }}
    >
      <header className="app-header sticky top-0 z-20 border-b border-[var(--panel-border)] backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2" />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        <div className="relative mb-6 max-w-md">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            className="h-10 w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] pl-9 pr-3 text-[13.5px] outline-none transition-colors focus:border-[var(--accent)]"
            style={{ color: 'var(--text-main)' }}
            placeholder="..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-6 lg:flex-row-reverse lg:items-start">
          <div className="w-full max-w-[300px] shrink-0 lg:sticky lg:top-20">
            <HomeCalendar />
          </div>
          <div className="min-w-0 flex-1">
        {filtered.length ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
            {filtered.map((b) => (
              <div
                key={b.id}
                className="group rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-3 shadow-[var(--card-shadow)] transition-shadow hover:shadow-[var(--panel-shadow-hover)]"
                onClick={() => useAppStore.getState().openBoardRoot(b.id)}
              >
                <BoardThumb boardId={b.id} width={276} height={150} />
                <div className="mt-3 flex items-start justify-between gap-2 px-0.5">
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-medium text-[var(--text-main)]">{b.title}</div>
                    <div className="mt-0.5 text-[12px] text-[var(--text-muted)]">Изменено {formatDate(b.updatedAt)}</div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        aria-label="Меню листа"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[var(--text-muted)] hover:bg-[var(--hover-bg)] hover:text-[var(--text-secondary)]"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreVertical size={15} />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); useAppStore.getState().openBoardRoot(b.id); }}>
                        Открыть
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameId(b.id);
                          setRenameValue(b.title);
                        }}
                      >
                        <PenLine size={14} className="mr-1" /> Переименовать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          const st = useAppStore.getState();
                          const newId = st.duplicateBoardTree(b.id);
                          if (newId) toast({ title: 'Лист продублирован' });
                        }}
                      >
                        <Copy size={14} className="mr-1" /> Дублировать
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          exportBoards(useAppStore.getState().boards, [b.id], b.title.replace(/[^\wа-яёА-ЯЁ\- ]/gi, '').trim() || 'list');
                        }}
                      >
                        <FileDown size={14} className="mr-1" /> Выгрузить JSON
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-[var(--danger, #D25454)] focus:text-[var(--danger, #D25454)]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteId(b.id);
                        }}
                      >
                        <Trash2 size={14} className="mr-1" /> Удалить
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}
          </div>
        ) : query.trim() ? (
          <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel-bg)] py-16 text-center text-[14px] text-[var(--text-muted)]">
            По запросу «{query}» ничего не найдено
          </div>
        ) : (
          <button
            className="flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-[var(--panel-border)] bg-[var(--panel-bg)]/60 py-20 text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            onClick={createBoard}
          >
            <Plus size={26} strokeWidth={1.6} />
            <span className="text-[14.5px] font-medium">Создайте первый лист</span>
            <span className="text-[12.5px]">Заметки, задачи, изображения и вложенные листы — на одном холсте</span>
          </button>
        )}
          </div>
        </div>
      </main>

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex">
        <div
          className="pointer-events-auto flex w-full items-center overflow-hidden border-t border-[var(--panel-border)] bg-[var(--panel-bg)] px-3 py-1.5"
          style={{ fontFamily: 'var(--font-plex), system-ui, sans-serif' }}
        >
          <button
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em]"
            style={{ color: backupOn ? 'var(--accent-strong)' : 'var(--text-secondary)', cursor: 'pointer', background: 'transparent' }}
            aria-label="Резервное копирование data при выходе"
            onClick={() => useAppStore.getState().setBackupOnExit(!backupOn)}
          >
            РЕЗЕРВИРОВАНИЕ;
          </button>
          <span className="mr-[5px] inline-block w-[10px]" />
          <button
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em] text-[var(--text-secondary)]"
            style={{ cursor: 'pointer', background: 'transparent' }}
            onClick={() => importRef.current?.click()}
          >
            ИМПОРТ,
          </button>
          <span className="mr-[5px] inline-block w-[10px]" />
          <button
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em] text-[var(--text-secondary)]"
            style={{ cursor: 'pointer', background: 'transparent' }}
            onClick={() => {
              exportBoards(useAppStore.getState().boards, Object.keys(useAppStore.getState().boards), 'planshet-vse-listy');
              toast({ title: 'Все листы выгружены в файл' });
            }}
          >
            ЭКСПОРТ;
          </button>
          <span className="mr-[5px] inline-block w-[10px]" />
          <button
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em] text-[var(--text-secondary)]"
            style={{ cursor: 'pointer', background: 'transparent' }}
            onClick={() => setSettingsOpen(true)}
          >
            ВИД;
          </button>
          <span className="mr-[5px] inline-block w-[10px]" />
          <button
            className="word-btn select-none px-0.5 text-[12.5px] font-medium leading-none tracking-[0.06em] text-[var(--text-secondary)]"
            style={{ cursor: 'pointer', background: 'transparent' }}
            onClick={createBoard}
          >
            ЧИСТЫЙ ЛИСТ.
          </button>
        </div>
      </div>

      {}
      <Dialog open={!!renameId} onOpenChange={(v) => !v && setRenameId(null)}>
        <DialogContent className="max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Название листа</DialogTitle>
          </DialogHeader>
          <input
            autoFocus
            className="h-10 w-full rounded-md border border-[var(--panel-border)] px-3 text-[14px] outline-none focus:border-[var(--accent)]"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (renameId) useAppStore.getState().renameBoard(renameId, renameValue.trim() || 'Без названия');
                setRenameId(null);
              }
            }}
          />
          <button
            className="h-9 rounded-md text-[13.5px] font-medium text-white"
            style={{ background: 'var(--accent)' }}
            onClick={() => {
              if (renameId) useAppStore.getState().renameBoard(renameId, renameValue.trim() || 'Без названия');
              setRenameId(null);
            }}
          >
            Сохранить
          </button>
        </DialogContent>
      </Dialog>

      {}
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить лист?</AlertDialogTitle>
            <AlertDialogDescription>
              Лист «{deleteId ? boards[deleteId]?.title : ''}» и все вложенные в неё листы будут удалены
              безвозвратно.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--danger, #D25454)] text-white hover:brightness-95"
              onClick={() => {
                if (deleteId) useAppStore.getState().deleteBoardTree(deleteId);
                setDeleteId(null);
              }}
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
</div>
  );
}
