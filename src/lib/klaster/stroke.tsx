

'use client';

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

export function renderStroke(
  points: number[],
  width: number,
  style: DrawStyle = 'pen',
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
  if (style === 'pen') {
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
  return { kind: 'polyline', path: strokePathData(points), width, cap: 'round', opacity: 1 };
}

export function StrokeShape({
  points,
  width,
  style = 'pen',
  color,
  pressures,
}: {
  points: number[];
  width: number;
  style?: DrawStyle;
  color: string;
  pressures?: number[];
}) {
  const r = renderStroke(points, width, style, pressures);
  if (!r.path) return null;
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
