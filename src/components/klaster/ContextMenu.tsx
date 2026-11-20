
'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore } from '@/lib/klaster/store';
import { notePalette, NOTE_LABELS } from '@/lib/klaster/theme';
import type { CardStatus, NoteColor } from '@/lib/klaster/types';
import { fitView } from './Canvas';

interface Item {
  label: string;
  action: () => void;
  danger?: boolean;
  hidden?: boolean;
}

export function ContextMenuHost() {
  const menu = useAppStore((s) => s.contextMenu);
  const theme = useAppStore((s) => s.theme);
  const palette = notePalette(theme);
  const ref = useRef<HTMLDivElement>(null);
  const [tagDraft, setTagDraft] = useState('');
  const st = useAppStore.getState();

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => {
      const t = e.target;
      if (!(t instanceof Node) || (ref.current && !ref.current.contains(t))) {
        useAppStore.getState().openContextMenu(null);
      }
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [menu]);

  // Позицию меню считаем после рендера по его фактическим размерам и держим
  // в пределах экрана — иначе у нижнего края меню уезжает под экран.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!menu || !el) return;
    const r = el.getBoundingClientRect();
    const pad = 8;
    const left = Math.max(pad, Math.min(menu.x, window.innerWidth - r.width - pad));
    const top = Math.max(pad, Math.min(menu.y, window.innerHeight - r.height - pad));
    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
    el.style.visibility = 'visible';
  }, [menu]);

  if (!menu) return null;

  const items: Item[] = [];

  if (menu.kind === 'card' && menu.cardId) {
    const boardId = st.breadcrumb[st.breadcrumb.length - 1];
    const board = st.boards[boardId];
    const card = board?.cards.find((c) => c.id === menu.cardId);
    if (card) {
      const sel = [menu.cardId];

      const effSel = st.selection.includes(card.id)
        ? st.selection.filter((id) => !id.startsWith('conn:'))
        : sel;
      if (card.type === 'note' || card.type === 'shape' || card.type !== 'draw') {
        items.push({
          label: 'Цвет',
          action: () => {},
        });
      }
      if (card.type === 'board') {
        items.push({
          label: 'Открыть лист',
          action: () => st.openSubBoard((card.data as { boardId: string }).boardId),
        });
      }
      if (card.type === 'link') {
        items.push({
          label: 'Изменить ссылку',
          action: () => window.dispatchEvent(new CustomEvent('klaster-edit-link', { detail: card.id })),
        });
      }
      if (card.type === 'image') {
        items.push({
          label: 'Заменить изображение',
          action: () => window.dispatchEvent(new CustomEvent('klaster-replace-image', { detail: card.id })),
        });
      }
      if (card.type === 'todo') {
        items.push({
          label: 'Убрать выполненные',
          action: () => window.dispatchEvent(new CustomEvent('klaster-todo-clear-done', { detail: card.id })),
        });
      }
      if (card.type === 'column') {
        items.push({
          label: 'Разгруппировать',
          action: () => st.unstackColumn(card.id),
        });
      }
      if (card.type === 'shape' && card.data.kind === 'shape') {
        const cur = card.data.shape;
        const shapes: { id: 'circle' | 'square' | 'triangle' | 'star'; label: string }[] = [
          { id: 'circle', label: 'Круг' },
          { id: 'square', label: 'Квадрат' },
          { id: 'triangle', label: 'Треугольник' },
          { id: 'star', label: 'Звезда' },
        ];
        for (const s of shapes) {
          if (s.id !== cur) {
            items.push({
              label: s.label,
              action: () => {
                st.pushHistory();
                st.updateCardData(card.id, { kind: 'shape', shape: s.id, color: card.data.kind === 'shape' ? card.data.color : 'classic-blue' });
              },
            });
          }
        }
      }
      if (card.type === 'draw') {

        const drawSel = effSel.filter((id) => board?.cards.find((x) => x.id === id)?.type === 'draw');
        if (drawSel.length >= 2) {
          items.push({
            label: 'Объединить штрихи',
            action: () => st.mergeStrokes(drawSel),
          });
        }
      }

      if (card.type !== 'draw') {
        // Отметки состояния: срочно / актуально / выполнено. Повторное применение снимает.
        const STATUSES: { id: CardStatus; label: string }[] = [
          { id: 'urgent', label: 'Срочно' },
          { id: 'actual', label: 'Актуально' },
          { id: 'done', label: 'Выполнено' },
        ];
        for (const stStatus of STATUSES) {
          items.push({
            label:
              card.status === stStatus.id
                ? `Снять: ${stStatus.label.toLowerCase()}`
                : `Отметить: ${stStatus.label.toLowerCase()}`,
            action: () => {
              st.setCardMeta(card.id, { status: card.status === stStatus.id ? null : stStatus.id });
              st.openContextMenu(null);
            },
          });
        }
        const commentsCount = card.comments?.length ?? 0;
        items.push({
          label:
            st.commentsOpenIds.includes(card.id)
              ? 'Скрыть комментарии'
              : commentsCount > 0
                ? `Комментарии (${commentsCount}) — показать`
                : 'Добавить комментарий',
          action: () => {
            st.toggleCommentsOpen(card.id);
            st.openContextMenu(null);
          },
        });
        items.push(
          {
            label: card.locked ? 'Разблокировать положение' : 'Заблокировать положение',
            action: () => st.setCardMeta(card.id, { locked: !card.locked }),
          },
          ...(card.alarmAt
            ? [
                {
                  label: 'Изменить срок…',
                  action: () => window.dispatchEvent(new CustomEvent('klaster-alarm', { detail: card.id })),
                },
                {
                  label: 'Убрать срок',
                  action: () => st.setCardMeta(card.id, { alarmAt: null }),
                },
              ]
            : [
                {
                  label: 'Установить срок…',
                  action: () => window.dispatchEvent(new CustomEvent('klaster-alarm', { detail: card.id })),
                },
              ])
        );
      } else {
        items.push({
          label: card.locked ? 'Разблокировать положение' : 'Заблокировать положение',
          action: () => st.setCardMeta(card.id, { locked: !card.locked }),
        });
      }
      items.push(
        { label: 'Дублировать', action: () => st.duplicateCards(effSel) },
        {
          label: 'Копировать',
          action: () => {
            st.setSelection(effSel);
            st.copySelection();
          },
        },
        { label: 'На передний план', action: () => st.bringToFront(card.id) },
        { label: 'На задний план', action: () => st.sendToBack(card.id) },
        {
          label: 'Удалить',
          action: () => {
            const conns = effSel.filter((id) => id.startsWith('conn:'));
            const cards = effSel.filter((id) => !id.startsWith('conn:'));
            conns.forEach((id) => st.deleteConnection(id.slice(5)));
            if (cards.length) st.deleteCards(cards);
          },
          danger: true,
        }
      );
    }
  } else if (menu.kind === 'canvas') {
    items.push(
      {
        label: 'Новый стикер',
        action: () => {
          const id = st.addCard('note', (menu.wx ?? 0) - 105, (menu.wy ?? 0) - 24);
          if (id) st.setEditing(id);
        },
      },
      {
        label: 'Вставить',
        action: () => st.pasteClipboard((menu.wx ?? 0), (menu.wy ?? 0)),
        hidden: !st.clipboard,
      },
      { label: 'Выделить всё', action: () => st.selectAll() },
      { label: 'По размеру листа', action: () => fitView(st.breadcrumb[st.breadcrumb.length - 1]) }
    );
  } else if (menu.kind === 'connection' && menu.connectionId) {
    items.push(
      { label: 'Остриё в конец', action: () => st.setConnectionArrow(menu.connectionId!, 'end') },
      { label: 'Остриё в начало', action: () => st.setConnectionArrow(menu.connectionId!, 'start') },
      { label: 'В обе стороны', action: () => st.setConnectionArrow(menu.connectionId!, 'both') },
      { label: 'Без остриё', action: () => st.setConnectionArrow(menu.connectionId!, 'none') },
      {
        label: 'Удалить связь',
        action: () => st.deleteConnection(menu.connectionId!),
        danger: true,
      }
    );
  }

  const noteCard =
    menu.kind === 'card' && menu.cardId
      ? st.boards[st.breadcrumb[st.breadcrumb.length - 1]]?.cards.find((c) => c.id === menu.cardId)
      : null;
  const colorable =
    noteCard &&
    (noteCard.type === 'note' ||
      noteCard.type === 'shape' ||
      ['text', 'todo', 'image', 'link', 'catalog', 'subject', 'organization', 'object', 'board'].includes(noteCard.type));

  const curBoard = st.boards[st.breadcrumb[st.breadcrumb.length - 1]];
  const selCards =
    menu.kind === 'card' && menu.cardId
      ? st.selection.filter((id) => !id.startsWith('conn:'))
      : [];
  const multiSel = selCards.length > 1 ? selCards : null;
  const activeTag = multiSel ? multiSel.map((id) => curBoard?.cards.find((c) => c.id === id)?.tags?.[0]).find(Boolean) : null;

  const applyColor = (color: NoteColor) => {
    st.pushHistory();
    const ids = st.selection.filter((x) => !x.startsWith('conn:'));
    const target = ids.includes(menu.kind === 'card' ? menu.cardId ?? '' : '') ? ids : menu.kind === 'card' ? [menu.cardId!] : [];
    for (const id of target) {
      const c = curBoard?.cards.find((x) => x.id === id);
      if (!c) continue;
      if (c.type === 'note' && c.data.kind === 'note') {
        st.updateCardData(c.id, { kind: 'note', text: c.data.text, color });
      } else if (c.type === 'shape' && c.data.kind === 'shape') {
        st.updateCardData(c.id, { kind: 'shape', shape: c.data.shape, color });
      } else if (c.type !== 'draw') {
        st.setCardMeta(c.id, { color });
      }
    }
    st.openContextMenu(null);
  };

  return (
    <div
      ref={ref}
      className="ctx-menu fixed z-[80] rounded-lg border border-[var(--panel-border)] bg-[var(--panel-bg)] py-1 shadow-[var(--menu-shadow)]"
      style={{ left: menu.x, top: menu.y, minWidth: 190, visibility: 'hidden' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {colorable && noteCard ? (
        <div className="flex items-center gap-1.5 border-b border-[var(--panel-border)] px-3 pb-2 pt-1.5">
          {(Object.keys(palette) as NoteColor[]).map((color) => {
            const active =
              noteCard.type === 'note' && noteCard.data.kind === 'note'
                ? noteCard.data.color === color
                : noteCard.type === 'shape' && noteCard.data.kind === 'shape'
                  ? noteCard.data.color === color
                  : noteCard.color === color;
            return (
              <button
                key={color}
                aria-label={NOTE_LABELS[color]}
                className="h-[18px] w-[18px] rounded-full border transition-colors"
                style={{
                  background: palette[color].bg,
                  borderColor: active ? 'var(--text-main)' : palette[color].border,
                  borderWidth: active ? 2 : 1,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  applyColor(color);
                }}
              />
            );
          })}
        </div>
      ) : null}

      {multiSel ? (
        <div className="flex items-center gap-1.5 border-b border-[var(--panel-border)] px-3 pb-2 pt-1.5">
          <input
            autoFocus
            className="min-w-0 flex-1 rounded border border-[var(--panel-border)] bg-transparent px-2 py-1 text-[12.5px] outline-none"
            style={{ color: 'var(--text-main)' }}
            placeholder="Тэг для выделенных…"
            value={tagDraft}
            onFocus={() => st.pushHistory()}
            onChange={(e) => setTagDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                const label = tagDraft.trim();
                if (label) st.setBoardTag(multiSel, label);
                setTagDraft('');
                st.openContextMenu(null);
              } else if (e.key === 'Escape') {
                setTagDraft('');
                st.openContextMenu(null);
              }
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
          {activeTag ? (
            <button
              className="shrink-0 rounded px-1.5 py-1 text-[12px]"
              style={{ color: 'var(--danger, #D25454)' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                st.setBoardTag(multiSel, null);
                st.openContextMenu(null);
              }}
            >
              Снять
            </button>
          ) : null}
        </div>
      ) : null}

      {items
        .filter((i) => !i.hidden)
        .map((item, i) =>
          item.label === 'Цвет' ? null : (
            <button
              key={i}
              className="flex w-full items-center px-3.5 py-[7px] text-left text-[13px] transition-colors hover:bg-[var(--hover-bg)]"
              style={{ color: item.danger ? 'var(--danger, #D25454)' : 'var(--text-main)' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                item.action();
                st.openContextMenu(null);
              }}
            >
              {item.label}
            </button>
          )
        )}
    </div>
  );
}
