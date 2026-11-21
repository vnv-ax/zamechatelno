

'use client';

import { useAppStore } from '@/lib/klaster/store';
import { Canvas } from './Canvas';
import { BottomBar } from './BottomBar';

export function BoardEditor() {
  const breadcrumb = useAppStore((s) => s.breadcrumb);
  const boardId = breadcrumb[breadcrumb.length - 1];
  if (!boardId) return null;

  return (
    <div className="flex h-screen min-h-0 flex-col bg-[var(--canvas-bg)]">
      <div className="relative min-h-0 flex-1">
        <Canvas boardId={boardId} />
        <BottomBar boardId={boardId} />
      </div>
    </div>
  );
}
