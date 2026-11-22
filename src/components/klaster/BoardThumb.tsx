
'use client';

import { memo } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useAppStore } from '@/lib/klaster/store';
import { measuredSizes } from '@/lib/klaster/types';
import { useNotePalette } from '@/lib/klaster/useNotePalette';
import type { NotePalette } from '@/lib/klaster/theme';
import type { Card } from '@/lib/klaster/types';

interface ThumbRect {
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  src?: string;
}

function fillFor(card: Card, palette: NotePalette): string {
  switch (card.type) {
    case 'note':
      return card.data.kind === 'note' ? palette[card.data.color]?.bg ?? palette.yellow.bg : palette.yellow.bg;
    case 'todo':
      return 'var(--thumb-todo)';
    case 'catalog':
      return 'var(--accent-soft)';
    case 'image':
      return 'var(--panel-border)';
    case 'board':
      return 'var(--thumb-board)';
    case 'subject':
      return 'var(--thumb-subject)';
    case 'organization':
      return 'var(--thumb-org)';
    case 'object':
      return 'var(--thumb-object)';
    case 'draw':
      return 'var(--text-faint)';
    case 'text':
    case 'link':
    default:
      return 'var(--panel-border)';
  }
}

export const BoardThumb = memo(function BoardThumb({
  boardId,
  width,
  height,
}: {
  boardId: string;
  width: number;
  height: number;
}) {
  const board = useAppStore((s) => s.boards[boardId]);
  const theme = useAppStore((s) => s.theme);
  const tick = useAppStore((s) => s.layoutTick);
  const palette = useNotePalette();

  if (!board) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-[var(--panel-border)] bg-[var(--chip-bg)] text-[12px] text-[var(--text-muted)]"
        style={{ width, height }}
      >
        Лист недоступен
      </div>
    );
  }

  const childIds = new Set<string>();
  for (const c of board.cards) {
    if (c.data.kind === 'column') for (const cid of c.data.cardIds) childIds.add(cid);
  }


  const rects: ThumbRect[] = [];
  for (const c of board.cards) {
    if (childIds.has(c.id)) continue;
    if (c.data.kind === 'column') {
      let y = c.y + 8;
      for (const cid of c.data.cardIds) {
        const child = board.cards.find((cc) => cc.id === cid);
        if (!child) continue;
        const h = measuredSizes.get(child.id)?.h ?? child.h;
        rects.push({ x: c.x + 8, y, w: c.w - 16, h: Math.max(18, h), fill: fillFor(child, palette) });
        y += Math.max(18, h) + 8;
      }
    } else {
      const m = measuredSizes.get(c.id);
      let src: string | undefined;
      if (c.data.kind === 'image' && c.data.src) src = c.data.src;
      rects.push({
        x: c.x,
        y: c.y,
        w: c.w,
        h: m?.h ?? c.h,
        fill: fillFor(c, palette),
        src,
      });
    }
  }

  void tick;

  if (!rects.length) {
    return (
      <div
        className="flex items-center justify-center gap-2 rounded-md border border-dashed border-[var(--panel-border)] bg-[var(--chip-bg)] text-[12px] text-[var(--text-muted)]"
        style={{ width, height }}
      >
        <LayoutGrid size={14} />
        Пустой лист
      </div>
    );
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const scale = Math.min((width - 20) / bw, (height - 20) / bh);
  const offX = (width - bw * scale) / 2 - minX * scale;
  const offY = (height - bh * scale) / 2 - minY * scale;

  return (
    <div
      className="relative overflow-hidden rounded-md border border-[var(--panel-border)] bg-[var(--card-bg)]"
      style={{ width, height }}
    >
      {rects.map((r, i) => (
        <div
          key={i}
          className="absolute overflow-hidden rounded-[2px]"
          style={{
            left: r.x * scale + offX,
            top: r.y * scale + offY,
            width: Math.max(2, r.w * scale),
            height: Math.max(2, r.h * scale),
            background: r.src ? undefined : r.fill,
            opacity: r.src ? 1 : 0.95,
          }}
        >
          {r.src ? (
            <img src={r.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" draggable={false} />
          ) : null}
        </div>
      ))}
    </div>
  );
});
