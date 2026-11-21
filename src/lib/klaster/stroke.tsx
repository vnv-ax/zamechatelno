

'use client';

import { useMemo } from 'react';
import type { DrawStyle } from './types';

export interface StrokeRender {
  kind: 'polyline' | 'filled';
  path: string;
  width?: number;
  cap?: 'round' | 'butt';
  opacity: number;
  dashArray?: string;
  layers?: StrokeLayer[];
}

interface StrokeLayer {
  kind: 'polyline' | 'filled';
  path: string;
  width?: number;
  cap?: 'round' | 'butt';
  opacity: number;
  dashArray?: string;
}

export function strokePathData(points: number[]): string {
  const count = Math.floor(points.length / 2);
  if (!count) return '';

  const firstX = points[0];
  const firstY = points[1];
  if (count === 1) return `M ${firstX} ${firstY} l 0.01 0`;

  const out = [`M ${firstX} ${firstY}`];
  for (let i = 1; i < count - 1; i++) {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    const nextX = points[(i + 1) * 2];
    const nextY = points[(i + 1) * 2 + 1];
    out.push(`Q ${x} ${y} ${(x + nextX) / 2} ${(y + nextY) / 2}`);
  }
  out.push(`L ${points[(count - 1) * 2]} ${points[(count - 1) * 2 + 1]}`);
  return out.join(' ');
}

function midpoint(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function offsetPoints(points: number[], offset: number) {
  const count = Math.floor(points.length / 2);
  const shifted: number[] = [];
  for (let i = 0; i < count; i++) {
    const before = Math.max(0, i - 1) * 2;
    const after = Math.min(count - 1, i + 1) * 2;
    const dx = points[after] - points[before];
    const dy = points[after + 1] - points[before + 1];
    const length = Math.hypot(dx, dy) || 1;
    const grain = Math.sin(i * 2.37) * offset * 0.42;
    shifted.push(
      points[i * 2] - (dy / length) * (offset + grain),
      points[i * 2 + 1] + (dx / length) * (offset + grain)
    );
  }
  return shifted;
}

function filledStrokePath(
  points: number[],
  width: number,
  style: 'brush' | 'edge',
  pressures: number[] = []
) {
  const n = Math.floor(points.length / 2);
  if (!n) return '';
  const centers = Array.from({ length: n }, (_, i) => ({ x: points[i * 2], y: points[i * 2 + 1] }));
  if (n === 1) {
    const radius = width / 2;
    const { x, y } = centers[0];
    return `M ${x - radius} ${y} a ${radius} ${radius} 0 1 0 ${radius * 2} 0 a ${radius} ${radius} 0 1 0 ${-radius * 2} 0`;
  }

  const left: { x: number; y: number }[] = [];
  const right: { x: number; y: number }[] = [];
  const distanceFromStart = [0];
  for (let i = 1; i < n; i++) {
    const dx = centers[i].x - centers[i - 1].x;
    const dy = centers[i].y - centers[i - 1].y;
    distanceFromStart.push(distanceFromStart[i - 1] + Math.hypot(dx, dy));
  }
  const totalDistance = distanceFromStart[n - 1];
  for (let i = 0; i < n; i++) {
    const before = centers[Math.max(0, i - 1)];
    const after = centers[Math.min(n - 1, i + 1)];
    const dx = after.x - before.x;
    const dy = after.y - before.y;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const pressure = Math.min(1, Math.max(0, pressures[i] ?? 0.5));
    const fromStart = distanceFromStart[i];
    const fromEnd = totalDistance - fromStart;
    const taper =
      style === 'brush'
        ? Math.min(1, fromStart / Math.max(width * 1.25, 1), fromEnd / Math.max(width * 1.25, 1))
        : 1;
    const scale =
      style === 'brush'
        ? (0.32 + pressure * 1.3) * taper
        : 0.12 + 1.25 * Math.abs(nx * 0.707 + ny * 0.707);
    const radius = Math.max(0.35, (width * scale) / 2);
    left.push({ x: centers[i].x + nx * radius, y: centers[i].y + ny * radius });
    right.push({ x: centers[i].x - nx * radius, y: centers[i].y - ny * radius });
  }

  const sidePath = (side: { x: number; y: number }[]) => {
    const first = side[0];
    const commands = [`M ${first.x} ${first.y}`];
    for (let i = 1; i < side.length - 1; i++) {
      const mid = midpoint(side[i], side[i + 1]);
      commands.push(`Q ${side[i].x} ${side[i].y} ${mid.x} ${mid.y}`);
    }
    const last = side[side.length - 1];
    commands.push(`L ${last.x} ${last.y}`);
    return commands.join(' ');
  };
  const reversedRight = [...right].reverse();
  const rightStart = reversedRight[0];
  const rightCommands = sidePath(reversedRight).replace(/^M [^ ]+ [^ ]+/, '');
  return `${sidePath(left)} L ${rightStart.x} ${rightStart.y}${rightCommands} Z`;
}

// ============================================================
// Движок штрихов на perfect-freehand (как в milanote)
// ============================================================

import { getStrokePoints, getStrokeOutlinePoints } from 'perfect-freehand';

/** Пресеты кистей: параметры perfect-freehand + способ отрисовки */
interface BrushPreset {
  /** заполненный контур (true) или линия stroke-width (false) */
  filled: boolean;
  thinning: number;
  smoothing: number;
  streamline: number;
  /** сужение концов штриха */
  startTaper: number;
  endTaper: number;
  /** учитывать pressure из точек (иначе скорость имитируется сама) */
  usePressure: boolean;
  opacity: number;
  /** множитель к ширине для stroke-only кистей */
  widthScale: number;
  dashArray?: string;
  /** двойной слой (неон: ореол + сердцевина) */
  glow?: boolean;
}

const BRUSHES: Partial<Record<DrawStyle, BrushPreset>> = {
  // новые кисти
  ink: { filled: false, thinning: 0, smoothing: 0.55, streamline: 0.5, startTaper: 0, endTaper: 0, usePressure: false, opacity: 0.92, widthScale: 0.55 },
  pencil: { filled: false, thinning: 0, smoothing: 0.6, streamline: 0.6, startTaper: 0, endTaper: 0, usePressure: false, opacity: 0.7, widthScale: 0.38, dashArray: '1.5 2' },
  brush: { filled: true, thinning: 0.6, smoothing: 0.5, streamline: 0.45, startTaper: 0, endTaper: 0, usePressure: true, opacity: 1, widthScale: 1 },
  calligraphy: { filled: true, thinning: 0.78, smoothing: 0.4, streamline: 0.35, startTaper: 0, endTaper: 4, usePressure: true, opacity: 1, widthScale: 1 },
  marker: { filled: true, thinning: 0, smoothing: 0.9, streamline: 0.7, startTaper: 0, endTaper: 0, usePressure: false, opacity: 0.34, widthScale: 2.6 },
  crayon: { filled: false, thinning: 0, smoothing: 0.85, streamline: 0.75, startTaper: 0, endTaper: 0, usePressure: false, opacity: 0.85, widthScale: 0.9, dashArray: '2 2.6' },
  neon: { filled: false, thinning: 0, smoothing: 0.7, streamline: 0.6, startTaper: 0, endTaper: 0, usePressure: false, opacity: 1, widthScale: 0.7, glow: true },
  // легаси-«pen» рисуется новым stroke-only движком
  pen: { filled: false, thinning: 0, smoothing: 0.55, streamline: 0.5, startTaper: 0, endTaper: 0, usePressure: false, opacity: 0.85, widthScale: 0.55 },
};

/** Контур perfect-freehand → SVG path */
function outlineToPath(outline: number[][]): string {
  if (!outline.length) return '';
  const n = outline.length;
  if (n < 3) {
    const [x, y] = outline[0];
    const r = Math.max(0.5, (outline[1] ? Math.hypot(outline[1][0] - x, outline[1][1] - y) : 1) / 2);
    return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`;
  }
  const cmds = [`M ${outline[0][0]} ${outline[0][1]}`];
  for (let i = 1; i < n - 1; i++) {
    const mx = (outline[i][0] + outline[i + 1][0]) / 2;
    const my = (outline[i][1] + outline[i + 1][1]) / 2;
    cmds.push(`Q ${outline[i][0]} ${outline[i][1]} ${mx} ${my}`);
  }
  const last = outline[n - 1];
  cmds.push(`L ${last[0]} ${last[1]}`);
  return cmds.join(' ') + ' Z';
}

function toPointsArray(points: number[], pressures: number[] | undefined, usePressure: boolean): number[][] {
  const n = Math.floor(points.length / 2);
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (usePressure && pressures && pressures.length) {
      out.push([points[i * 2], points[i * 2 + 1], Math.min(1, Math.max(0.05, pressures[i] ?? 0.5))]);
    } else {
      out.push([points[i * 2], points[i * 2 + 1]]);
    }
  }
  return out;
}

/** Полилиния через квадратичные середины (для stroke-only кистей) */
export { strokePathData };

/** Новый рендер штриха. points — плоский массив [x,y,...], pressures — имитация скорости/давления */
export function renderStroke(
  points: number[],
  width: number,
  style: DrawStyle = 'ink',
  pressures?: number[],
  last = false
): StrokeRender {
  const n = Math.floor(points.length / 2);
  if (!n) return { kind: 'polyline', path: '', width, cap: 'round', opacity: 1 };

  // Легаси-кисти: старые рисунки рисуются прежним алгоритмом
  if (style === 'edge' || style === 'marker') {
    return legacyRenderStroke(points, width, style, pressures);
  }
  if (style === 'pen') {
    // «Графит (старый)»: прежний двойной след
    return legacyRenderStroke(points, width, 'pen', pressures);
  }

  const preset = BRUSHES[style] as BrushPreset;
  const size = width * preset.widthScale;

  if (!preset.filled) {
    // stroke-only: дешёвая линия
    const path = strokePathData(points);
    const layers: StrokeLayer[] = [];
    if (preset.glow) {
      // ореол
      layers.push({
        kind: 'polyline',
        path,
        width: size * 2.6,
        cap: 'round',
        opacity: 0.28,
      });
    }
    layers.push({
      kind: 'polyline',
      path,
      width: size,
      cap: 'round',
      opacity: preset.opacity,
      dashArray: preset.dashArray,
    });
    return { kind: 'polyline', path, width: size, cap: 'round', opacity: preset.opacity, layers };
  }

  // заполненный контур perfect-freehand
  const hasPressure = preset.usePressure && !!pressures?.length;
  const pts = toPointsArray(points, pressures, preset.usePressure);
  const strokePoints = getStrokePoints(pts, {
    size,
    thinning: preset.thinning,
    smoothing: preset.smoothing,
    streamline: preset.streamline,
    start: { taper: preset.startTaper },
    end: { taper: preset.endTaper, cap: true },
    simulatePressure: !hasPressure && preset.usePressure ? true : !hasPressure,
    last,
  });
  const outline = getStrokeOutlinePoints(strokePoints, {
    size,
    thinning: preset.thinning,
    smoothing: preset.smoothing,
    streamline: preset.streamline,
    simulatePressure: !hasPressure && preset.usePressure ? true : !hasPressure,
    start: { taper: preset.startTaper },
    end: { taper: preset.endTaper, cap: true },
    last,
  });
  const path = outlineToPath(outline);
  return { kind: 'filled', path, opacity: preset.opacity };
}

/** Старый алгоритм (pen/brush/edge/marker) — для рисунков, созданных до нового движка */
function legacyRenderStroke(
  points: number[],
  width: number,
  style: 'pen' | 'brush' | 'edge' | 'marker',
  pressures?: number[]
): StrokeRender {
  const n = Math.floor(points.length / 2);
  if (!n) return { kind: 'polyline', path: '', width, cap: 'round', opacity: 1 };
  if (style === 'brush' || style === 'edge') {
    return {
      kind: 'filled',
      path: filledStrokePath(points, width, style, pressures),
      opacity: 1,
    };
  }
  if (style === 'marker') {
    return {
      kind: 'polyline',
      path: strokePathData(points),
      width: width * 2.8,
      cap: n === 1 ? 'round' : 'butt',
      opacity: 0.34,
    };
  }
  // pen
  return {
    kind: 'polyline',
    path: strokePathData(points),
    width: Math.max(0.8, width * 0.56),
    cap: 'round',
    opacity: 0.8,
    layers: [
      {
        kind: 'polyline',
        path: strokePathData(offsetPoints(points, width * 0.22)),
        width: Math.max(0.35, width * 0.18),
        cap: 'round',
        opacity: 0.38,
        dashArray: `${Math.max(0.6, width * 0.28)} ${Math.max(1.1, width * 0.72)}`,
      },
    ],
  };
}

export function StrokeShape({
  points,
  width,
  style = 'ink',
  color,
  pressures,
  baked,
}: {
  points: number[];
  width: number;
  style?: DrawStyle;
  color: string;
  pressures?: number[];
  /** запечённый StrokeRender (JSON) — рисуется без пересчёта */
  baked?: string;
}) {
  const r: StrokeRender | null = useMemo(() => {
    if (baked) {
      try {
        return JSON.parse(baked) as StrokeRender;
      } catch {
        return null;
      }
    }
    return renderStroke(points, width, style, pressures);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baked, points.join(','), width, style, color]);
  if (!r || !r.path) return null;
  return (
    <>
      {[r, ...(r.layers ?? [])].map((layer, index) =>
        layer.kind === 'filled' ? (
          <path key={index} d={layer.path} fill={color} opacity={layer.opacity} />
        ) : (
          <path
            key={index}
            d={layer.path}
            stroke={color}
            strokeWidth={layer.width}
            strokeLinecap={layer.cap}
            strokeLinejoin="round"
            strokeDasharray={layer.dashArray}
            fill="none"
            opacity={layer.opacity}
          />
        )
      )}
    </>
  );
}

