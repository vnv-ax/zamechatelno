
'use client';

import { useAppStore } from '@/lib/klaster/store';
import { measuredSizes } from '@/lib/klaster/types';
import type { Card } from '@/lib/klaster/types';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function Connections({ boardId }: { boardId: string }) {
  const board = useAppStore((s) => s.boards[boardId]);
  const selection = useAppStore((s) => s.selection);
  const connecting = useAppStore((s) => s.connecting);

  if (!board) return null;

  const rectOf = (cardId: string): Rect | null => {
    let card: Card | undefined = board.cards.find((c) => c.id === cardId);
    if (!card) return null;

    for (const c of board.cards) {
      if (c.data.kind === 'column' && c.data.cardIds.includes(cardId)) {
        card = c;
        break;
      }
    }
    const m = measuredSizes.get(card.id);
    return { x: card.x, y: card.y, w: card.w, h: m?.h ?? card.h };
  };

  const anchor = (r: Rect, side: 'left' | 'right' | 'top' | 'bottom') => {
    switch (side) {
      case 'left': return { x: r.x, y: r.y + r.h / 2 };
      case 'right': return { x: r.x + r.w, y: r.y + r.h / 2 };
      case 'top': return { x: r.x + r.w / 2, y: r.y };
      case 'bottom': return { x: r.x + r.w / 2, y: r.y + r.h };
    }
  };

  const buildPath = (a: Rect, b: Rect): { d: string; start: { x: number; y: number }; end: { x: number; y: number } } => {
    const acx = a.x + a.w / 2;
    const acy = a.y + a.h / 2;
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    const dx = bcx - acx;
    const dy = bcy - acy;
    let sSide: 'left' | 'right' | 'top' | 'bottom';
    let eSide: 'left' | 'right' | 'top' | 'bottom';
    if (Math.abs(dx) > Math.abs(dy)) {
      sSide = dx > 0 ? 'right' : 'left';
      eSide = dx > 0 ? 'left' : 'right';
    } else {
      sSide = dy > 0 ? 'bottom' : 'top';
      eSide = dy > 0 ? 'top' : 'bottom';
    }
    const start = anchor(a, sSide);
    const end = anchor(b, eSide);
    const k = Math.max(36, Math.hypot(end.x - start.x, end.y - start.y) * 0.35);
    const dir = (side: 'left' | 'right' | 'top' | 'bottom', sign: number) => {
      switch (side) {
        case 'left': return { x: -sign * k, y: 0 };
        case 'right': return { x: sign * k, y: 0 };
        case 'top': return { x: 0, y: -sign * k };
        case 'bottom': return { x: 0, y: sign * k };
      }
    };
    const c1 = dir(sSide, sSide === 'left' || sSide === 'top' ? 1 : 1);
    const c2 = dir(eSide, eSide === 'right' || eSide === 'bottom' ? 1 : 1);
    const d = `M ${start.x} ${start.y} C ${start.x + c1.x} ${start.y + c1.y}, ${end.x + c2.x} ${end.y + c2.y}, ${end.x} ${end.y}`;
    return { d, start, end };
  };

  const selConn = (id: string) => selection.includes('conn:' + id);

  return (
    <svg className="absolute left-0 top-0 h-px w-px overflow-visible" style={{ pointerEvents: 'none', zIndex: 30 }}>
      <defs>
        <marker id="kb-arrow-gray" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--conn)" }} />
        </marker>
        <marker id="kb-arrow-blue" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" style={{ fill: "var(--accent)" }} />
        </marker>
      </defs>

      {board.connections.map((cn) => {
        const a = rectOf(cn.from);
        const b = rectOf(cn.to);
        if (!a || !b) return null;
        const { d } = buildPath(a, b);
        const selected = selConn(cn.id);
        const stroke = selected ? 'var(--conn-selected, var(--accent))' : 'var(--conn)';
        const arrow = cn.arrow ?? 'end';
        const marker = selected ? 'url(#kb-arrow-blue)' : 'url(#kb-arrow-gray)';
        return (
          <g key={cn.id}>
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              style={{ pointerEvents: 'stroke' }}
              onPointerDown={(e) => {
                e.stopPropagation();
                useAppStore.getState().setSelection(['conn:' + cn.id]);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                useAppStore.getState().openContextMenu({
                  kind: 'connection',
                  connectionId: cn.id,
                  x: e.clientX,
                  y: e.clientY,
                });
              }}
            />
            <path
              d={d}
              fill="none"
              stroke={stroke}
              strokeWidth="var(--edge-width, 2)"
              strokeDasharray="var(--edge-dash, none)"
              strokeLinecap="round"
              markerEnd={arrow === 'end' || arrow === 'both' ? marker : undefined}
              markerStart={arrow === 'start' || arrow === 'both' ? marker : undefined}
              style={{ pointerEvents: 'none' }}
            />
          </g>
        );
      })}

      {connecting
        ? (() => {
            const a = rectOf(connecting.from);
            if (!a) return null;
            const r: Rect = { x: connecting.x, y: connecting.y, w: 1, h: 1 };
            const { start } = buildPath(a, r);
            return (
              <line
                x1={start.x}
                y1={start.y}
                x2={connecting.x}
                y2={connecting.y}
                stroke="var(--accent)"
                strokeWidth={2}
                strokeDasharray="6 5"
                style={{ pointerEvents: 'none' }}
              />
            );
          })()
        : null}
    </svg>
  );
}
