'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Hash, Link2 } from 'lucide-react';
import { useAppStore } from '@/lib/klaster/store';
import { focusCard } from './Canvas';

// Нижняя инфо-панель: справа снизу, напротив масштаба.
// Пока курсор на панели — не исчезает; ушёл — гаснет через 2 секунды.
export function BottomInfoPanel() {
  const panel = useAppStore((s) => s.bottomPanel);
  const setBottomPanel = useAppStore((s) => s.setBottomPanel);
  const boards = useAppStore((s) => s.boards);
  const closeTimer = useRef<number | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setBottomPanel(null), 2000);
  };

  const rows = useMemo(() => {
    if (!panel) return [];
    if (panel.kind === 'tag') {
      const tag = panel.tag ?? '';
      const marker = '#' + tag;
      const out: { boardId: string; cardId: string; label: string; snippet: string }[] = [];
      for (const [boardId, b] of Object.entries(boards)) {
        for (const c of b.cards) {
          // тег либо в списке тегов блока, либо написан в тексте (#тег / #тег/подтег)
          const inTags = (c.tags ?? []).some((t) => t === tag || t.startsWith(tag + '/'));
          const text = c.data.kind === 'note' || c.data.kind === 'text' ? c.data.text || '' : '';
          const ti = text.indexOf(marker);
          const after = ti >= 0 ? ti + marker.length : -1;
          const boundaryOk = ti <= 0 || /[\s(]/.test(text[ti - 1]);
          const tailOk = after < 0 || after >= text.length || !/[A-Za-zА-Яа-яЁё0-9_/\-]/.test(text[after]);
          const inText = ti !== -1 && boundaryOk && tailOk;
          if (!inTags && !inText) continue;
          const label =
            c.data.kind === 'todo'
              ? c.data.title || c.data.items[0]?.text || 'Список'
              : text
                ? text.split('\n')[0].slice(0, 40)
                : cardLabelOf(c);
          const snippetLine = text ? (text.split('\n').find((l) => l.includes(marker)) || '').trim().slice(0, 60) : '';
          out.push({ boardId, cardId: c.id, label: label || 'Блок', snippet: snippetLine || 'тег ' + marker });
        }
      }
      return out;
    }
    // backlinks
    const boardId = panel.boardId!;
    const cardId = panel.cardId!;
    const board = boards[boardId];
    if (!board) return [];
    const marker = `#block:${cardId}`;
    const out: { boardId: string; cardId: string; label: string; snippet: string }[] = [];
    for (const c of board.cards) {
      if (c.id === cardId) continue;
      if (c.data.kind === 'note' || c.data.kind === 'text') {
        const text = c.data.text || '';
        const i = text.indexOf(marker);
        if (i !== -1) {
          out.push({
            boardId,
            cardId: c.id,
            label: text.slice(0, 42).replace(/\n/g, ' ').trim() || '(без текста)',
            snippet: text.slice(Math.max(0, i - 50), i).replace(/\n/g, ' ').trim(),
          });
        }
      }
    }
    return out;
  }, [panel, boards]);

  if (!panel) return null;

  const title = panel.kind === 'tag' ? `#${panel.tag}` : 'Ссылки на этот блок';

  const goTo = (boardId: string, cardId: string) => {
    const st = useAppStore.getState();
    st.openBoardRoot(boardId);
    setTimeout(() => focusCard(boardId, cardId), 120);
    setBottomPanel(null);
  };

  return (
    <div
      className="bottom-info-panel"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <div className="bip-title">
        {panel.kind === 'tag' ? <Hash size={12} /> : <Link2 size={12} />}
        {title}
        <button className="bip-close" aria-label="Закрыть" onClick={() => setBottomPanel(null)}>
          ×
        </button>
      </div>
      <div className="bip-list">
        {rows.length === 0 ? (
          <span className="bip-empty">Пока ничего нет</span>
        ) : (
          rows.map((r) => (
            <button key={r.boardId + r.cardId} className="bip-row" onClick={() => goTo(r.boardId, r.cardId)}>
              <span className="bip-label">{r.label}</span>
              {r.snippet ? <span className="bip-snippet">{r.snippet}</span> : null}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function cardLabelOf(card: { data: unknown }): string {
  const d = card.data as { kind: string; text?: string; title?: string; alt?: string; url?: string };
  if (d.title) return d.title;
  if (d.text) return d.text.split('\n')[0].slice(0, 40);
  if (d.alt) return d.alt;
  if (d.url) return d.url;
  return 'Блок';
}
