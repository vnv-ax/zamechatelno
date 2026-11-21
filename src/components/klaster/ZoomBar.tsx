
'use client';

import { HelpCircle, Maximize2, Minus, Plus } from 'lucide-react';
import { useAppStore } from '@/lib/klaster/store';
import { fitView, zoomTo } from './Canvas';
import { Hint } from './Hint';

export function ZoomBar({ boardId }: { boardId: string }) {
  const zoom = useAppStore((s) => s.viewports[boardId]?.zoom ?? 1);
  const percent = Math.round(zoom * 100);

  const btn =
    'flex h-8 w-8 items-center justify-center rounded-md text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)]';

  return (
    <div className="zoombar-panel absolute bottom-4 left-4 z-30 flex items-center gap-0.5 rounded-lg border border-[var(--chrome-border, var(--panel-border))] bg-[var(--chrome-bg, var(--panel-bg))] p-1 shadow-[var(--panel-shadow)]">
      <Hint label="Уменьшить" desc="−" side="top">
        <button className={btn} aria-label="Уменьшить масштаб" onClick={() => zoomTo(boardId, Math.max(0.05, zoom / 1.25))}>
          <Minus size={15} />
        </button>
      </Hint>
      <Hint label="Сбросить масштаб" desc="0" side="top">
        <button
          className="h-8 min-w-[52px] rounded-md px-1 text-[12.5px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--hover-bg)]"
          onClick={() => zoomTo(boardId, 1)}
        >
          {percent}%
        </button>
      </Hint>
      <Hint label="Увеличить" desc="+" side="top">
        <button className={btn} aria-label="Увеличить масштаб" onClick={() => zoomTo(boardId, Math.min(4, zoom * 1.25))}>
          <Plus size={15} />
        </button>
      </Hint>
      <div className="mx-0.5 h-5 w-px bg-[var(--panel-border)]" />
      <Hint label="Лист по размеру окна" desc="F" side="top">
        <button className={btn} aria-label="Вписать лист в экран" onClick={() => fitView(boardId)}>
          <Maximize2 size={14} />
        </button>
      </Hint>
      <Hint label="Горячие клавиши и приёмы" side="top">
        <button className={btn} aria-label="Горячие клавиши" onClick={() => useAppStore.getState().setShortcutsOpen(true)}>
          <HelpCircle size={15} />
        </button>
      </Hint>
    </div>
  );
}
