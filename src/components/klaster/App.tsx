
'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/lib/klaster/store';
import { canvasHandle, clientToWorld } from '@/lib/klaster/canvasHandle';
import { HomeView } from './HomeView';
import { BoardEditor } from './BoardEditor';
import { ContextMenuHost } from './ContextMenu';
import { DragGhost } from './DragGhost';
import { ExportDialog, SearchDialog, ShortcutsDialog } from './Dialogs';
import { BottomInfoPanel } from './BottomInfoPanel';
import { fitView, zoomTo, drawingDraft, confirmDiscardDrawing } from './Canvas';
import { ThemeSplash } from './ThemeSplash';
import { undoDrawingDraft } from './Canvas';
import { AltF4Hint } from './AltF4Hint';


let lastNudge = 0;

export default function App() {
  const loaded = useAppStore((s) => s.loaded);
  const view = useAppStore((s) => s.view);
  const theme = useAppStore((s) => s.theme);
  const lockGate = useAppStore((s) => s.lockGate);


  useEffect(() => {
    useAppStore.getState().load();
  }, []);

  // Alt — режим ссылок: при зажатом Alt текст в карточках выделяется (drag не тащит блоки)
  useEffect(() => {
    const setMode = (on: boolean) => document.body.classList.toggle('alt-mode', on);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setMode(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setMode(false);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => setMode(false));
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      setMode(false);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const st = useAppStore.getState();
      const target = e.target as HTMLElement;
      const editable =
        target instanceof HTMLElement &&
        (target.matches('input, textarea, select, [contenteditable="true"]') || target.isContentEditable);

      if (e.key === 'Escape') {
        if (st.contextMenu) st.openContextMenu(null);
        else if (st.searchOpen) st.setSearchOpen(false);
        else if (st.shortcutsOpen) st.setShortcutsOpen(false);
        else if (st.exportOpen) st.setExportOpen(false);
        else if (st.drawMode) {
          // В режиме рисования Escape спрашивает, прежде чем стереть черновик
          void (async () => {
            if (drawingDraft.count > 0) {
              const discard = await confirmDiscardDrawing();
              if (!discard) return;
            }
            useAppStore.getState().cancelDrawMode();
          })();
        }
        else if (st.editingId) st.setEditing(null);
        else st.clearSelection();
        return;
      }
      if (editable) return;

      const mod = e.ctrlKey || e.metaKey;
      // русская раскладка: буква → латинская физическая клавиша
      const ruKey: Record<string, string> = { 'с': 'c', 'ч': 'x', 'м': 'v', 'в': 'd', 'ф': 'a', 'я': 'z', 'л': 'k' };
      const key = ruKey[e.key.toLowerCase()] ?? e.key.toLowerCase();

      // в режиме рисования КОНТРОЛЬ+Я отменяет штрихи черновика, а не лист
      if (st.drawMode && mod && key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undoDrawingDraft();
        return;
      }
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) st.redo();
        else st.undo();
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        st.redo();
        return;
      }
      if (mod && key === 'k') {
        e.preventDefault();
        st.setSearchOpen(true);
        return;
      }
      if (st.view !== 'board') return;

      const boardId = st.breadcrumb[st.breadcrumb.length - 1];
      if (e.code === 'Digit0') {
        e.preventDefault();
        zoomTo(boardId, 1);
        return;
      }
      if (e.code === 'KeyF') {
        e.preventDefault();
        fitView(boardId);
        return;
      }
      if (e.code === 'Equal' || e.code === 'NumpadAdd') {
        e.preventDefault();
        zoomTo(boardId, Math.min(4, canvasHandle.view.zoom * 1.25));
        return;
      }
      if (e.code === 'Minus' || e.code === 'NumpadSubtract') {
        e.preventDefault();
        zoomTo(boardId, Math.max(0.05, canvasHandle.view.zoom / 1.25));
        return;
      }

      if (mod && key === 'c') {
        st.copySelection();
        return;
      }
      if (mod && key === 'x') {
        st.cutSelection();
        return;
      }
      if (mod && key === 'v') {
        const outer = canvasHandle.outer;
        if (outer) {
          const r = outer.getBoundingClientRect();
          const w = clientToWorld(r.left + r.width / 2, r.top + r.height / 2);
          if (w) {
            e.preventDefault();
            st.pasteClipboard(w.x - 100, w.y - 60);
          }
        }
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        st.duplicateCards(st.selection);
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        st.selectAll();
        return;
      }
      if (e.key === 'Delete') {
        const conns = st.selection.filter((id) => id.startsWith('conn:'));
        const cards = st.selection.filter((id) => !id.startsWith('conn:'));
        if (conns.length || cards.length) {
          e.preventDefault();
          conns.forEach((id) => st.deleteConnection(id.slice(5)));
          if (cards.length) st.deleteCards(cards);
        }
        return;
      }
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        if (!st.selection.length) return;
        e.preventDefault();
        const now = Date.now();
        if (now - lastNudge > 1200) st.pushHistory();
        lastNudge = now;
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        st.moveCards(st.selection, dx, dy);
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // АЛЬТЕРНАТИВНЫЙ+Ф4 — закрыть приложение (через мост обёртки)
  useEffect(() => {
    const onAltF4 = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F4') {
        e.preventDefault();
        void import('@/lib/klaster/host').then(({ hostAvailable, hostCall }) => {
          if (hostAvailable()) void hostCall('close').catch(() => {});
        });
      }
    };
    window.addEventListener('keydown', onAltF4);
    return () => window.removeEventListener('keydown', onAltF4);
  }, []);

  useEffect(() => {
    const onBeforeUnload = () => useAppStore.getState().persist();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Заглушка всегда сверху (z-index 9999), пока не закончится загрузка + мин. пауза.
  // Контент приложения можно рендерить сразу после loaded — он будет под сплешем.
  return (
    <>
      {/* приложение рендерится всегда: под сплэшем загрузки и под стеклом входа,
          данные наполнят его сразу после разблокировки */}
      {view === 'board' ? <BoardEditor key={theme} /> : <HomeView key={theme} />}
      <AltF4Hint />
      <DragGhost />
      <ContextMenuHost />
      <SearchDialog />
      <BottomInfoPanel />
      <ShortcutsDialog />
      <ExportDialog />
      <ThemeSplash />
    </>
  );
}
