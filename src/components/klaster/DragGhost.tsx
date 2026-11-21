

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Bookmark,
  Box,
  Building2,
  CircleUserRound,
  Image as ImageIcon,
  Layers,
  Link2,
  ListTodo,
  PenLine,
  Shapes,
  SquarePen,
  Text,
} from 'lucide-react';
import { useAppStore } from '@/lib/klaster/store';
import { cardDefaultSize } from '@/lib/klaster/types';
import { clientToWorld } from '@/lib/klaster/canvasHandle';
import { toast } from '@/hooks/use-toast';

const LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  note: { label: 'Стикер', icon: <SquarePen size={14} /> },
  text: { label: 'Заметка', icon: <Text size={14} /> },
  todo: { label: 'Список', icon: <ListTodo size={14} /> },
  image: { label: 'Изображение', icon: <ImageIcon size={14} /> },
  link: { label: 'Ссылка', icon: <Link2 size={14} /> },
  catalog: { label: 'Каталог', icon: <Bookmark size={14} /> },
  subject: { label: 'Субъект', icon: <CircleUserRound size={14} /> },
  organization: { label: 'Организация', icon: <Building2 size={14} /> },
  object: { label: 'Объект', icon: <Box size={14} /> },
  board: { label: 'Вложенный лист', icon: <Layers size={14} /> },
  shape: { label: 'Фигура', icon: <Shapes size={14} /> },
  draw: { label: 'Рисование', icon: <PenLine size={14} /> },
};

export function DragGhost() {
  const type = useAppStore((s) => s.dragNewType);
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const moved = useRef(false);
  const startRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!type) {
      moved.current = false;
      return;
    }
    startRef.current = { x: -100, y: -100 };
    const onMove = (e: PointerEvent) => {
      if (!moved.current) {
        if (
          startRef.current.x === -100 &&
          startRef.current.y === -100
        ) {

          startRef.current = { x: e.clientX, y: e.clientY };
          return;
        }
        if (Math.hypot(e.clientX - startRef.current.x, e.clientY - startRef.current.y) > 6) {
          moved.current = true;
        }
      }
      setPos({ x: e.clientX, y: e.clientY });
    };
    const onUp = (e: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const st = useAppStore.getState();
      const t = st.dragNewType;
      st.setDragNewType(null);
      if (!t) return;

      if (t === 'draw') {
        const next = !st.drawMode;
        st.setDrawMode(next);
        toast(
          next
            ? { title: 'Режим рисования включён', description: 'Чертите прямо на холсте. Esc — выключить.' }
            : { title: 'Режим рисования выключен' }
        );
        return;
      }

      if (!moved.current) return;

      const canvas = document.querySelector('[data-canvas-root]');
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) return;

      const w = clientToWorld(e.clientX, e.clientY);
      if (!w) return;
      const def = cardDefaultSize(t);
      const id = st.addCard(t, w.x - def.w / 2, w.y - 24);
      if (id && (t === 'note' || t === 'text')) st.setEditing(id);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [type]);

  if (!type || !LABELS[type]) return null;
  const meta = LABELS[type];

  // без пузыря — только иконка того, что тащишь
  return (
    <div
      className="pointer-events-none fixed z-[90] text-[var(--accent-strong)]"
      style={{ left: pos.x + 12, top: pos.y + 10 }}
    >
      {meta.icon}
    </div>
  );
}
