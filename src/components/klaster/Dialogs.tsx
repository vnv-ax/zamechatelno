
'use client';

import { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAppStore, buildBreadcrumbPath } from '@/lib/klaster/store';
import { focusCard } from './Canvas';
import { CATALOG_CATEGORIES } from '@/lib/klaster/types';
import { exportBoards } from '@/lib/klaster/download';
import { useToast } from '@/hooks/use-toast';
import { FileDown, Search } from 'lucide-react';

export function SearchDialog() {
  const open = useAppStore((s) => s.searchOpen);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => useAppStore.getState().setSearchOpen(v)}
    >
      {open ? <SearchDialogInner /> : null}
    </Dialog>
  );
}

function SearchDialogInner() {
  const boards = useAppStore((s) => s.boards);
  const [query, setQuery] = useState('');

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { boards: [], cards: [] };
    const boardHits: { id: string; title: string }[] = [];
    const cardHits: { boardId: string; cardId: string; snippet: string }[] = [];
    for (const b of Object.values(boards)) {
      if (b.title.toLowerCase().includes(q)) boardHits.push({ id: b.id, title: b.title });
      for (const c of b.cards) {
        if (c.data.kind === 'note' && c.data.text.toLowerCase().includes(q)) {
          cardHits.push({ boardId: b.id, cardId: c.id, snippet: c.data.text.slice(0, 80) });
        } else if (c.data.kind === 'text' && c.data.text.toLowerCase().includes(q)) {
          cardHits.push({ boardId: b.id, cardId: c.id, snippet: c.data.text.slice(0, 80) });
        } else if (c.data.kind === 'todo') {

          const titleHit = (c.data.title ?? '').toLowerCase().includes(q);
          const hit = c.data.items.find((i) => i.text.toLowerCase().includes(q));
          if (titleHit || hit) {
            cardHits.push({
              boardId: b.id,
              cardId: c.id,
              snippet: titleHit ? (c.data.title || 'Список').slice(0, 80) : hit!.text.slice(0, 80),
            });
          }
        } else if (c.data.kind === 'link') {

          const hay = `${c.data.title} ${c.data.description ?? ''} ${c.data.url}`.toLowerCase();
          if (hay.includes(q)) {
            cardHits.push({ boardId: b.id, cardId: c.id, snippet: (c.data.title || c.data.url).slice(0, 80) });
          }
        } else if (c.data.kind === 'column') {
          if (c.data.title.toLowerCase().includes(q)) {
            cardHits.push({ boardId: b.id, cardId: c.id, snippet: `Колонка «${c.data.title}»`.slice(0, 80) });
          }
        } else if (c.data.kind === 'catalog') {

          const cat = CATALOG_CATEGORIES[c.data.category] ?? '';
          const linkHit = c.data.links.find(
            (l) => l.title.toLowerCase().includes(q) || l.url.toLowerCase().includes(q)
          );
          const hay = `${c.data.title} ${cat}`.toLowerCase();
          if (hay.includes(q) || linkHit) {
            const snippet = linkHit
              ? (linkHit.title || linkHit.url).slice(0, 80)
              : `Каталог «${c.data.title || cat}»`.slice(0, 80);
            cardHits.push({ boardId: b.id, cardId: c.id, snippet });
          }
        } else if (c.data.kind === 'subject' || c.data.kind === 'organization' || c.data.kind === 'object') {

          const d = c.data as unknown as Record<string, string>;
          const hay = [d.name, d.role, d.contacts, d.about, d.orgType, d.sphere, d.address, d.objType, d.status]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (hay.includes(q)) {
            const label = c.data.kind === 'subject' ? 'Субъект' : c.data.kind === 'organization' ? 'Организация' : 'Объект';
            cardHits.push({ boardId: b.id, cardId: c.id, snippet: `${label} «${d.name || 'Без названия'}»`.slice(0, 80) });
          }
        }
      }
    }
    return { boards: boardHits.slice(0, 8), cards: cardHits.slice(0, 12) };
  }, [boards, query]);

  const openBoard = (boardId: string, cardId?: string) => {
    const st = useAppStore.getState();
    const path = buildBreadcrumbPath(st.boards, boardId);
    st.openBoardRoot(path[0]);
    for (let i = 1; i < path.length; i++) st.openSubBoard(path[i]);
    if (cardId) {
      // центрируем вид на найденной карточке и подсвечиваем её
      setTimeout(() => focusCard(boardId, cardId), 60);
    }
    st.setSearchOpen(false);
  };

  const nothing = query.trim() && !results.boards.length && !results.cards.length;

  return (
    <Dialog open={open} onOpenChange={(v) => useAppStore.getState().setSearchOpen(v)}>
      <DialogContent className="max-w-[520px] p-0" showCloseButton={false}>
        <DialogHeader className="sr-only">
          <DialogTitle>Поиск</DialogTitle>
          <DialogDescription>Поиск по названиям досок и содержимому карточек</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2.5 border-b border-[var(--panel-border)] px-4 py-3">
          <Search size={16} className="text-[var(--text-muted)]" />
          <input
            autoFocus
            className="w-full border-0 bg-transparent text-[14px] outline-none"
            style={{ color: 'var(--text-main)' }}
            placeholder="Найти"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {!query.trim() ? null : nothing ? (
            <div className="px-3 py-6 text-center text-[13px] text-[var(--text-muted)]">Ничего не найдено</div>
          ) : (
            <>
              {results.boards.length ? (
                <div className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Листы</div>
              ) : null}
              {results.boards.map((b) => (
                <button
                  key={b.id}
                  className="flex w-full items-center rounded-md px-3 py-2 text-left text-[13.5px] hover:bg-[var(--hover-bg)]"
                  onPointerDown={() => openBoard(b.id)}
                >
                  <span className="truncate" style={{ color: 'var(--text-main)' }}>{b.title}</span>
                </button>
              ))}
              {results.cards.length ? (
                <div className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Карточки</div>
              ) : null}
              {results.cards.map((h) => (
                <button
                  key={h.cardId}
                  className="flex w-full flex-col rounded-md px-3 py-2 text-left hover:bg-[var(--hover-bg)]"
                  onPointerDown={() => openBoard(h.boardId, h.cardId)}
                >
                  <span className="truncate text-[13.5px]" style={{ color: 'var(--text-main)' }}>{h.snippet}</span>
                  <span className="truncate text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                    в листе «{boards[h.boardId]?.title}»
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

const SHORTCUTS: [string, string][] = [
  ['ПАНОРАМА', 'ЦФЫВ; СРЕДНЯЯ КНОПКА МЫШИ; ТРОЙНОЙ КЛИК С УДЕРЖАНИЕМ; ПРОБЕЛ + ТАЩИ; СВАЙПЫ.'],
  ['МАСШТАБ', 'КОНТРОЛЬ + ЗУМ; МИНУС, ПЛЮС НА КЛАВЕ; ЩИПОК.'],
  ['КАМЕРА НА ВСЕ ОБЪЕКТЫ РАЗОМ', 'Ф'],
  ['СДВИГ БЛОКОВ', 'СТРЕЛКИ; УСКОРЕНИЕ = ШИФТ+СТРЕЛКИ; ПОДНЯТЬ + ЦФЫВ'],
  ['КОЛОНКА', 'КАРТОЧКУ НА ДРУГУЮ — ОБРАЗУЕТСЯ КОЛОНКА. ПРАВАЯ КНОПКА ПО КОЛОНКЕ — РАЗГРУППИРОВАТЬ.'],
  ['СТРЕЛКИ', 'ТОЧКА СБОКУ КАРТОЧКИ: ПОТЯНИ К ДРУГОЙ КАРТОЧКЕ — ПОЯВИТСЯ СТРЕЛКА. ДВОЙНОЙ КЛИК ПО СТРЕЛКЕ — ПОДПИСЬ ЛИНИИ. ДВОЙНОЙ КЛИК ПО ПОДПИСИ — РЕДАКТИРОВАТЬ. ПРАВАЯ КНОПКА ПО СТРЕЛКЕ — ОСТРИЁ, ВЫПРЯМИТЬ, УДАЛИТЬ'],
  ['АДРЕС ЛИСТА', 'ТРОЕТОЧИЕ В БАРЕ: ПУТЬ ПО ВЛОЖЕННЫМ ЛИСТАМ. КЛИК ПО СТРАНИЦЕ АДРЕСА — ПЕРЕХОД К НЕЙ'],
];

export function ShortcutsDialog() {

  const open = useAppStore((s) => s.shortcutsOpen);
  return (
    <Dialog open={open} onOpenChange={(v) => useAppStore.getState().setShortcutsOpen(v)}>
      <DialogContent className="shortcuts-dialog max-w-[560px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>СПРАВКА</DialogTitle>
        </DialogHeader>
        <div className="max-h-[440px] overflow-y-auto pr-1">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="border-b border-[var(--panel-border)] py-2.5 last:border-0">
              <div className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--accent-strong)' }}>
                {k}
              </div>
              <div className="pt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-main)' }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ExportDialog() {
  const open = useAppStore((s) => s.exportOpen);
  const breadcrumb = useAppStore((s) => s.breadcrumb);
  const { toast } = useToast();
  const boardId = breadcrumb[breadcrumb.length - 1];

  return (
    <Dialog open={open} onOpenChange={(v) => useAppStore.getState().setExportOpen(v)}>
      <DialogContent className="max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Выгрузить лист</DialogTitle>
          <DialogDescription>
            Текущий лист и все вложенные в него листы сохраняются в JSON-файл. Его можно передать
            другому человеку или импортировать через кнопку «Импорт» на главной странице.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <button
            className="flex items-center justify-center gap-2 rounded-md px-3 py-2 text-[13.5px] font-medium text-white"
            style={{ background: 'var(--accent)' }}
            onClick={() => {
              const st = useAppStore.getState();
              const board = st.boards[boardId];
              if (board) {
                exportBoards(st.boards, [boardId], board.title.replace(/[^\wа-яёА-ЯЁ\- ]/gi, '').trim() || 'list');
                toast({ title: 'JSON-файл листа сохранён' });
              }
            }}
          >
            <FileDown size={15} />
            Скачать JSON
          </button>
          <div className="text-center text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            Название файла — название листа. Все листы разом выгружаются кнопкой «Экспорт» на главной.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function BailOutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-[320px] pb-6" showCloseButton={false}>
        <div className="select-none text-center text-[15px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-main)' }}>
          СВЯЖИТЕСЬ
        </div>
        <div className="relative mx-auto mt-4 w-[220px] overflow-hidden rounded-sm">
          <img
            src="/qr-vnvax.png"
            alt="QR"
            className="block w-full select-none"
            draggable={false}
          />
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E\")",
              mixBlendMode: 'multiply',
              opacity: 0.25,
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
