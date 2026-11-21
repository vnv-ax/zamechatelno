
'use client';

import type { Viewport } from './types';

export const canvasHandle: {
  outer: HTMLDivElement | null;
  world: HTMLDivElement | null;
  zoom: number;
  view: Viewport;
} = {
  outer: null,
  world: null,
  zoom: 1,
  view: { x: 0, y: 0, zoom: 1 },
};

export function clientToWorld(clientX: number, clientY: number): { x: number; y: number } | null {
  const world = canvasHandle.world;
  if (!world) return null;
  const rect = world.getBoundingClientRect();
  return {
    x: (clientX - rect.left) / canvasHandle.zoom,
    y: (clientY - rect.top) / canvasHandle.zoom,
  };
}
