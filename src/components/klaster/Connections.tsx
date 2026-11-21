
'use client';

import { useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/lib/klaster/store';
import { measuredSizes } from '@/lib/klaster/types';
import type { Card } from '@/lib/klaster/types';
import { clientToWorld } from '@/lib/klaster/canvasHandle';
import { subscribeViewportVersion, getViewportVersion, isCardVisibleSync } from '@/lib/klaster/viewport';

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
  const theme = useAppStore((s) => s.theme);
  // перерисовываться при смене видимости карточек (viewport-рендеринг)
  useSyncExternalStore(subscribeViewportVersion, getViewportVersion);
  // редактирование подписи линии
  const [labelEdit, setLabelEdit] = useState<{ connId: string; draft: string } | null>(null);

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

/** Точка пересечения луча из центра прямоугольника к цели с его границей
 *  (как в milanote: линия идёт центр-в-центр и обрезается по краям блоков) */
function borderIntersection(r: Rect, from: { x: number; y: number }, to: { x: number; y: number }): { x: number; y: number } {
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // полуразмеры с небольшим отступом, чтобы линия не прилипала к рамке
  const hw = r.w / 2 + 1;
  const hh = r.h / 2 + 1;
  const candidates: number[] = [];
  if (dx > 0) candidates.push(hw / dx);
  if (dx < 0) candidates.push(-hw / dx);
  if (dy > 0) candidates.push(hh / dy);
  if (dy < 0) candidates.push(-hh / dy);
  const s = Math.min(...candidates.filter((v) => v > 0));
  return { x: from.x + dx * s, y: from.y + dy * s };
}

  const buildPath = (a: Rect, b: Rect, controlPoint?: { x: number; y: number } | null): { d: string; start: { x: number; y: number }; end: { x: number; y: number } } => {
    const acx = a.x + a.w / 2;
    const acy = a.y + a.h / 2;
    const bcx = b.x + b.w / 2;
    const bcy = b.y + b.h / 2;
    const start = borderIntersection(a, { x: acx, y: acy }, { x: bcx, y: bcy });
    const end = borderIntersection(b, { x: bcx, y: bcy }, { x: acx, y: acy });
    if (controlPoint) {
      // квадратичная Безье, проходящая через контрольную точку (как в milanote):
      // настоящая контрольная точка C = 2·P − (S+E)/2 при t = 0.5
      const cx = 2 * controlPoint.x - (start.x + end.x) / 2;
      const cy = 2 * controlPoint.y - (start.y + end.y) / 2;
      return { d: `M ${start.x} ${start.y} Q ${cx} ${cy} ${end.x} ${end.y}`, start, end };
    }
    return { d: `M ${start.x} ${start.y} L ${end.x} ${end.y}`, start, end };
  };

  const selConn = (id: string) => selection.includes('conn:' + id);

  return (
    <svg className="absolute left-0 top-0 h-px w-px overflow-visible" style={{ pointerEvents: 'none', zIndex: 30 }}>
      <defs>
        {/* Стрелки в стиле milanote: линия обрывается заранее, дальше в воздухе
            висит крупный чёрный треугольник, а у края блока — маленькая точка.
            «Кинопио» — своя, в тона темы. */}
        <marker id="kb-arrow-gray" viewBox="0 0 12 12" refX="1.5" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 1.5 0.5 L 11.5 6 L 1.5 11.5 z" style={{ fill: 'var(--arrow, #14181c)', stroke: 'none' }} />
        </marker>
        <marker id="kb-arrow-blue" viewBox="0 0 12 12" refX="1.5" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 1.5 0.5 L 11.5 6 L 1.5 11.5 z" style={{ fill: 'var(--conn-selected, var(--accent))', stroke: 'none' }} />
        </marker>
        <marker id="kb-arrow-kinopio" viewBox="0 0 12 12" refX="1.5" refY="6" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
          <path d="M 1.5 0.5 L 11.5 6 L 1.5 11.5 z" style={{ fill: 'var(--conn, #5e3e1e)', stroke: 'none' }} />
        </marker>
        {/* градиент для летящей точки направления (тема «Кинопио») */}
        <linearGradient id="conn-flight-gradient">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="0" />
          <stop offset="90%" stopColor="var(--accent)" stopOpacity="1" />
        </linearGradient>
      </defs>

      {board.connections.map((cn) => {
        const a = rectOf(cn.from);
        const b = rectOf(cn.to);
        if (!a || !b) return null;
        // viewport-рендеринг: связь не рисуем, если оба конца далеко за листом
        if (!isCardVisibleSync(cn.from) && !isCardVisibleSync(cn.to)) return null;
        const { d, start, end } = buildPath(a, b, cn.controlPoint);
        const selected = selConn(cn.id);
        // линия и наконечник — одного цвета: чёрная стрелка на чёрной линии
        const stroke = selected ? 'var(--conn-selected, var(--accent))' : 'var(--arrow, #14181c)';
        const arrow = cn.arrow ?? 'end';
        const marker = selected ? 'url(#kb-arrow-blue)' : theme === 'kinopio' ? 'url(#kb-arrow-kinopio)' : 'url(#kb-arrow-gray)';
        // стрелка висит в воздухе, как в milanote: обрываем линию заранее,
        // треугольник летит дальше сам, у края блока остаётся точка
        const ARROW_GAP = 13;
        const shorten = (p: { x: number; y: number }, q: { x: number; y: number }) => {
          const len = Math.hypot(q.x - p.x, q.y - p.y);
          if (len <= ARROW_GAP) return p;
          const k = ARROW_GAP / len;
          return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
        };
        // выход тоже с зазором от борта карточки-источника
        const lineStart = shorten(start, end);
        const lineEnd = arrow === 'start' ? end : shorten(end, start);
        const dLine = cn.controlPoint
          ? (() => {
              // укороченная квадратичная Безье через ту же контрольную точку:
              // Q-параметры пересчитываются по отношениям длин
              const cx = 2 * cn.controlPoint.x - (start.x + end.x) / 2;
              const cy = 2 * cn.controlPoint.y - (start.y + end.y) / 2;
              return `M ${lineStart.x} ${lineStart.y} Q ${cx} ${cy} ${lineEnd.x} ${lineEnd.y}`;
            })()
          : `M ${lineStart.x} ${lineStart.y} L ${lineEnd.x} ${lineEnd.y}`;
        // точка на кривой для потягивания: изгиб в середине (t=0.5) либо середина прямой
        const mid = cn.controlPoint ?? { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        // точка кривой при t = 0.5 (для подписи) — 0.25·S + 0.5·C + 0.25·E
        const curveMid = cn.controlPoint
          ? (() => {
              const cx = 2 * cn.controlPoint!.x - (start.x + end.x) / 2;
              const cy = 2 * cn.controlPoint!.y - (start.y + end.y) / 2;
              return { x: 0.25 * start.x + 0.5 * cx + 0.25 * end.x, y: 0.25 * start.y + 0.5 * cy + 0.25 * end.y };
            })()
          : mid;
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
              onDoubleClick={(e) => {
                e.stopPropagation();
                useAppStore.getState().setSelection(['conn:' + cn.id]);
                setLabelEdit({ connId: cn.id, draft: cn.label ?? '' });
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
              d={dLine}
              fill="none"
              stroke={stroke}
              strokeWidth="var(--edge-width, 2)"
              strokeDasharray="var(--edge-dash, none)"
              strokeLinecap="round"
              markerEnd={arrow === 'end' || arrow === 'both' ? marker : undefined}
              markerStart={arrow === 'start' || arrow === 'both' ? marker : undefined}
              style={{ pointerEvents: 'none' }}
            />
            {selected && theme === 'kinopio' ? (
              // летящая по кривой точка — показывает направление связи (kinopio)
              <circle r={4} fill="url(#conn-flight-gradient)" style={{ pointerEvents: 'none' }}>
                <animateMotion dur="3s" repeatCount="indefinite" path={d} />
              </circle>
            ) : null}
            {selected ? (
              <circle
                cx={mid.x}
                cy={mid.y}
                r={4}
                fill="var(--accent)"
                stroke="var(--card-bg)"
                strokeWidth={1.5}
                style={{ pointerEvents: 'auto', cursor: 'grab' }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const st0 = useAppStore.getState();
                  st0.pushHistory();
                  const move = (ev: PointerEvent) => {
                    const w = clientToWorld(ev.clientX, ev.clientY);
                    if (w) useAppStore.getState().setConnectionControlPoint(cn.id, { x: w.x, y: w.y });
                  };
                  const up = () => {
                    window.removeEventListener('pointermove', move);
                    window.removeEventListener('pointerup', up);
                    window.removeEventListener('pointercancel', up);
                  };
                  window.addEventListener('pointermove', move);
                  window.addEventListener('pointerup', up);
                  window.addEventListener('pointercancel', up);
                }}
              />
            ) : null}
            {labelEdit?.connId === cn.id ? (
              <foreignObject x={curveMid.x - 90} y={curveMid.y - 15} width={180} height={30} style={{ pointerEvents: 'auto', overflow: 'visible' }}>
                <div xmlns="http://www.w3.org/1999/xhtml">
                  <input
                    autoFocus
                    defaultValue={labelEdit.draft}
                    placeholder="Подпись линии…"
                    style={{
                      width: '100%',
                      fontSize: 12.5,
                      padding: '3px 8px',
                      borderRadius: 8,
                      border: '1px solid var(--accent)',
                      background: 'var(--card-bg)',
                      color: 'var(--text-main)',
                      outline: 'none',
                    }}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = (e.target as HTMLInputElement).value.trim();
                        useAppStore.getState().setConnectionLabel(cn.id, v || null);
                        setLabelEdit(null);
                      } else if (e.key === 'Escape') {
                        setLabelEdit(null);
                      }
                    }}
                    onBlur={(e) => {
                      const v = (e.target as HTMLInputElement).value.trim();
                      useAppStore.getState().setConnectionLabel(cn.id, v || null);
                      setLabelEdit(null);
                    }}
                  />
                </div>
              </foreignObject>
            ) : cn.label ? (
              <g style={{ pointerEvents: 'auto' }} onPointerDown={(e) => { e.stopPropagation(); useAppStore.getState().setSelection(['conn:' + cn.id]); }}>
                <text
                  x={curveMid.x}
                  y={curveMid.y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={12}
                  fontWeight={500}
                  fill="var(--text-main)"
                  stroke="var(--card-bg)"
                  strokeWidth={4}
                  paintOrder="stroke"
                  style={{ cursor: 'pointer' }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setLabelEdit({ connId: cn.id, draft: cn.label ?? '' });
                  }}
                >
                  {cn.label}
                </text>
              </g>
            ) : null}
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
