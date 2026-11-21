

'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import { generateHTML } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, FontSize } from '@tiptap/extension-text-style';
import {
  AlarmClock,
  ArrowUpRight,
  BellRing,
  Check,
  ChevronDown,
  Clock,
  GripHorizontal,
  ImagePlus,
  Link2,
  Lock,
  LockOpen,
  MessageSquare,
  MoveDiagonal,
  Pencil,
  Plus,
  Smile,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react';
import { useAppStore, findColumnOf } from '@/lib/klaster/store';
import {
  cardDefaultSize,
  cardDisplayName,
  ENTITY_FIELDS,
  ENTITY_TAG,
  formatAlarm,
  isAlarmDue,
  isAutoHeight,
  measuredSizes,
  CATALOG_CATEGORIES,
  nowToLocalInput,
} from '@/lib/klaster/types';
import type { Card, CardMetaPatch, CardType, CatalogCategory, CatalogLink, EntityFieldDef, TodoItem, NoteColor } from '@/lib/klaster/types';
import { EMOJI_GROUPS } from '@/lib/klaster/emojis';
import { ENTITY_ICON_GROUPS, EntityIconGlyph, ENTITY_ICON_NAMES } from '@/lib/klaster/icons';
import { subscribeToTick } from '@/lib/klaster/ticker';
import { StrokeShape } from '@/lib/klaster/stroke';
import { uid } from '@/lib/klaster/id';
import { focusCard, getBacklinks } from './Canvas';
import { dateKey, describeItemRepeat, nextOccurrence } from '@/lib/klaster/repeat';
import type { ItemRepeat } from '@/lib/klaster/types';
import { NOTE_LABELS } from '@/lib/klaster/theme';
import { useNotePalette, notePaletteWithMix } from '@/lib/klaster/useNotePalette';
import { applyImageFilter, IMAGE_FILTERS } from '@/lib/klaster/filters';
import type { ImageFilterId } from '@/lib/klaster/types';
import type { ThemeId } from '@/lib/klaster/theme';
import { canvasHandle, clientToWorld } from '@/lib/klaster/canvasHandle';
import { attachSticky } from '@/lib/klaster/sticky';
import type { StickyHandle } from '@/lib/klaster/sticky';
import { observeCardVisibility } from '@/lib/klaster/viewport';
import { BoardThumb } from './BoardThumb';
import { toast } from '@/hooks/use-toast';
import { Hint } from './Hint';

const MIN_W = 90;

const MAX_IMAGE_SRC_BYTES = 250 * 1024;
const MAX_IMAGE_SIDE = 1600;

// Режим ссылок: выделенный текст «откуда» + блок-цель «куда».
let altLinkStash: { sourceId: string; label: string } | null = null;

// Запоминаем выделенный текст в момент Alt+pointerdown по блоку-цели.
// Клик сбрасывает выделение, поэтому ловить его нужно до этого — тогда
// связка «выделил текст → зажал Alt → ткнул в другой блок» срабатывает всегда.
function captureAltSelection(boardId: string, targetCardId: string) {
  const sel = window.getSelection();
  const label = sel?.toString().trim() ?? '';
  if (!label) return;
  const anchorNode = sel!.anchorNode;
  const sourceEl = anchorNode instanceof Element ? anchorNode : anchorNode?.parentElement;
  const sourceCardEl = sourceEl?.closest('[data-card-id]') as HTMLElement | null;
  const sourceId = sourceCardEl?.dataset.cardId;
  if (!sourceId || sourceId === targetCardId) return;
  const source = useAppStore.getState().boards[boardId]?.cards.find((c) => c.id === sourceId);
  if (source && (source.data.kind === 'note' || source.data.kind === 'text')) {
    altLinkStash = { sourceId, label };
  }
}

function starPoints(cx: number, cy: number, outer: number, inner: number, spikes: number): string {
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / spikes - Math.PI / 2;
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function tagTint(card: Card, theme: ThemeId, cardsTheme: ThemeId | null): string {
  const palette = notePaletteWithMix(theme, { cards: cardsTheme });
  const c = palette[(card.tags?.[0] as NoteColor) ?? 'peri'] ?? palette.peri;
  return c.bg;
}

function stripColor(card: Card, theme: ThemeId, cardsTheme: ThemeId | null): string {
  const palette = notePaletteWithMix(theme, { cards: cardsTheme });
  const c = palette[(card.color ?? 'peri') as NoteColor] ?? palette.peri;
  return c.bg;
}

function downscaleImage(dataUrl: string, isPng: boolean): Promise<string> {
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(img.width, img.height));
      if (scale >= 1) {
        resolve(dataUrl);
        return;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85));
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

interface DragSession {
  mode: 'top' | 'child';
  ids: string[];
  cardId: string;
  columnId?: string;
  startX: number;
  startY: number;
  lastX: number;
  lastY: number;
  moved: boolean;
  /** Ctrl/⌘-перенос: продублировать карточки при первом движении */
  copyPending?: boolean;
}

let session: DragSession | null = null;

/** На время перетаскивания блоков гасим выделение текста (приём milanote:
 *  иначе браузер при drag за карточку выделяет текст соседних блоков) */
function setCardsDragging(on: boolean) {
  document.body.classList.toggle('is-dragging-cards', on);
  if (on) {
    try {
      window.getSelection()?.removeAllRanges();
    } catch { /* пусто */ }
  }
}

/** Открыть ссылку в браузере: window.open + запасной клик по скрытому <a target=_blank> */
function openExternal(url: string) {
  let w: Window | null = null;
  try {
    w = window.open(url, '_blank', 'noopener,noreferrer');
  } catch {
    w = null;
  }
  if (!w) {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.style.display = 'none';
      document.body.append(a);
      a.click();
      a.remove();
    } catch {
      // последний фолбэк — текущая вкладка
      window.location.href = url;
    }
  }
}

/** Диалог «Переходим по ссылке?» — действие выполняется прямо в обработчике кнопки,
 *  чтобы сохранить пользовательский жест (иначе открытие может быть заблокировано) */
function confirmOpenLink(url: string, onYes: () => void) {
  let done = false;
  const finish = (ok: boolean) => {
    if (done) return;
    done = true;
    window.removeEventListener('keydown', onKey, true);
    overlay.remove();
    if (ok) onYes();
  };
  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      finish(false);
    }
  };

  const overlay = document.createElement('div');
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '9999',
    background: 'rgba(0,0,0,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as Partial<CSSStyleDeclaration>);
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) finish(false);
  });

  const box = document.createElement('div');
  Object.assign(box.style, {
    maxWidth: '360px',
    margin: '0 16px',
    padding: '16px 18px',
    background: 'var(--card-bg)',
    color: 'var(--text-main)',
    border: '1px solid var(--card-border)',
    borderRadius: '12px',
    boxShadow: '0 18px 48px rgba(0,0,0,0.4)',
  } as Partial<CSSStyleDeclaration>);

  const title = document.createElement('div');
  title.textContent = 'Переходим по ссылке?';
  Object.assign(title.style, { fontSize: '14.5px', fontWeight: '600' } as Partial<CSSStyleDeclaration>);

  const urlLine = document.createElement('div');
  urlLine.textContent = url;
  urlLine.title = url;
  Object.assign(urlLine.style, {
    marginTop: '6px',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    wordBreak: 'break-all',
    maxHeight: '72px',
    overflow: 'hidden',
  } as Partial<CSSStyleDeclaration>);

  const row = document.createElement('div');
  Object.assign(row.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '14px' } as Partial<CSSStyleDeclaration>);

  const no = document.createElement('button');
  no.textContent = 'Неа';
  Object.assign(no.style, {
    padding: '5px 14px',
    fontSize: '12.5px',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--card-border)',
  } as Partial<CSSStyleDeclaration>);
  no.addEventListener('click', () => finish(false));

  const yes = document.createElement('button');
  yes.textContent = 'Так точно';
  Object.assign(yes.style, {
    padding: '5px 14px',
    fontSize: '12.5px',
    fontWeight: '600',
    borderRadius: '8px',
    cursor: 'pointer',
    background: 'var(--accent)',
    color: '#fff',
    border: '1px solid transparent',
  } as Partial<CSSStyleDeclaration>);
  yes.addEventListener('click', () => finish(true));

  row.append(no, yes);
  box.append(title, urlLine, row);
  overlay.append(box);
  document.body.append(overlay);
  window.addEventListener('keydown', onKey, true);
  setTimeout(() => yes.focus(), 0);
}

/** Спросить и открыть ссылку */
function openLinkAfterConfirm(url: string) {
  confirmOpenLink(url, () => openExternal(url));
}

function suppressPostDragClick(draggedIds: Set<string>) {
  const onClick = (ev: MouseEvent) => {
    window.removeEventListener('click', onClick, true);
    const el = ev.target;
    if (!(el instanceof Element)) return;
    const cardEl = el.closest('[data-card-id]') as HTMLElement | null;
    if (cardEl && draggedIds.has(cardEl.dataset.cardId ?? '')) {
      ev.stopPropagation();
      ev.preventDefault();
    }
  };
  window.addEventListener('click', onClick, true);

  window.setTimeout(() => window.removeEventListener('click', onClick, true), 500);
}

function endSession(e: PointerEvent) {
  if (sessionMoveFrame) {
    cancelAnimationFrame(sessionMoveFrame);
    sessionMoveFrame = 0;
    sessionMovePending = null;
  }
  window.removeEventListener('pointermove', onSessionMove);
  window.removeEventListener('pointerup', onSessionUp);
  if (!session) return;
  const s = session;
  const st = useAppStore.getState();
  const t = st.dropPreview;

  if (s.mode === 'top' && s.moved) {
    if (t?.cardId) {
      st.mergeIntoColumn(s.ids, t.cardId);
    } else if (t?.columnId) {
      if (s.ids.length === 1) {
        st.moveCardToColumn(s.cardId, t.columnId, t.index ?? 999);
      } else {
        s.ids.forEach((id, i) => st.moveCardToColumn(id, t.columnId!, (t.index ?? 999) + i));
      }
    }
  } else if (s.mode === 'child' && s.moved) {
    if (st.extractGhost) {
      const w = clientToWorld(e.clientX, e.clientY);
      if (w) st.extractFromColumn(s.cardId, w.x, w.y);
    } else if (t?.cardId) {
      st.mergeIntoColumn([s.cardId], t.cardId);
    } else if (t?.columnId) {
      if (t.columnId === s.columnId) {
        st.reorderInColumn(s.cardId, t.columnId, t.index ?? 999);
      } else {
        st.moveCardToColumn(s.cardId, t.columnId, t.index ?? 999);
      }
    }
  }

  session = null;
  st.setDragging(false);
  st.setDropPreview(null);
  st.setExtractGhost(null);
  setCardsDragging(false);

  if (s.moved) {
    const ids = new Set(s.ids);
    if (t?.cardId) ids.add(t.cardId);
    suppressPostDragClick(ids);
  }
}

function cancelSessionSilently() {
  if (sessionMoveFrame) {
    cancelAnimationFrame(sessionMoveFrame);
    sessionMoveFrame = 0;
    sessionMovePending = null;
  }
  window.removeEventListener('pointermove', onSessionMove);
  window.removeEventListener('pointerup', onSessionUp);
  if (!session) return;
  session = null;
  const st = useAppStore.getState();
  st.setDragging(false);
  st.setDropPreview(null);
  st.setExtractGhost(null);
  setCardsDragging(false);
}

function computeColumnIndex(colEl: HTMLElement, clientY: number, excludeId?: string): number {
  const children = Array.from(colEl.querySelectorAll<HTMLElement>('[data-child-id]')).filter(
    (el) => el.dataset.childId !== excludeId
  );
  let index = 0;
  for (const ch of children) {
    const r = ch.getBoundingClientRect();
    const mid = r.top + r.height / 2;
    if (clientY > mid) index++;
  }
  return index;
}

function resolveDropTarget(
  clientX: number,
  clientY: number,
  excludeIds: string[]
): { cardId?: string; columnId?: string; index?: number } | null {

  const els = document.elementsFromPoint(clientX, clientY);
  const exclude = new Set(excludeIds);
  for (const el of els) {
    const colEl = el.closest('[data-column-id]') as HTMLElement | null;
    const cardEl = el.closest('[data-card-id]') as HTMLElement | null;
    if (colEl && !exclude.has(colEl.dataset.columnId!)) {
      const draggedChild = excludeIds.length === 1 ? excludeIds[0] : undefined;
      return { columnId: colEl.dataset.columnId!, index: computeColumnIndex(colEl, clientY, draggedChild) };
    }
    if (cardEl && !exclude.has(cardEl.dataset.cardId!)) {
      return { cardId: cardEl.dataset.cardId! };
    }
  }
  return null;
}

// События перетаскивания батчатся через rAF: одно обновление на кадр (приём milanote)
let sessionMoveFrame = 0;
let sessionMovePending: PointerEvent | null = null;

function onSessionMove(e: PointerEvent) {
  sessionMovePending = e;
  if (sessionMoveFrame) return;
  sessionMoveFrame = requestAnimationFrame(() => {
    sessionMoveFrame = 0;
    const ev = sessionMovePending;
    sessionMovePending = null;
    if (!session || !ev) return;
    processSessionMove(ev);
  });
}

function processSessionMove(e: PointerEvent) {
  if (!session) return;
  const s = session;
  const st = useAppStore.getState();
  const zoom = canvasHandle.zoom || 1;

  if (!s.moved) {
    if (Math.hypot(e.clientX - s.startX, e.clientY - s.startY) < 4) return;
    s.moved = true;
    st.pushHistory();
    setCardsDragging(true);
    if (s.copyPending && s.mode === 'top') {
      st.duplicateCards(s.ids);
      s.ids = st.selection;
      s.cardId = s.ids.includes(s.cardId) ? s.cardId : s.ids[0] ?? s.cardId;
    }
    st.setDragging(true);
    if (s.mode === 'top') st.bringToFront(s.cardId);
    s.lastX = e.clientX;
    s.lastY = e.clientY;
  }

  const ddx = (e.clientX - s.lastX) / zoom;
  const ddy = (e.clientY - s.lastY) / zoom;
  s.lastX = e.clientX;
  s.lastY = e.clientY;

  if (s.mode === 'top') {
    st.moveCards(s.ids, ddx, ddy);
  } else {

  }

  const t = s.moved ? resolveDropTarget(e.clientX, e.clientY, s.ids) : null;
  if (t?.cardId) {
    st.setDropPreview({ cardId: t.cardId });
    st.setExtractGhost(null);
  } else if (t?.columnId) {
    st.setDropPreview({ columnId: t.columnId, index: t.index });
    st.setExtractGhost(null);
  } else if (s.mode === 'child') {
    st.setDropPreview(null);
    st.setExtractGhost({ cardId: s.cardId, screenX: e.clientX, screenY: e.clientY });
  } else {
    st.setDropPreview(null);
  }
}

function onSessionUp(e: PointerEvent) {
  endSession(e);
}

let resizeSession: { cardId: string; startX: number; startY: number; startW: number; startH: number; minH: number; autoH: boolean; moved: boolean } | null = null;

function onResizeMove(e: PointerEvent) {
  if (!resizeSession) return;
  const r = resizeSession;
  const zoom = canvasHandle.zoom || 1;
  if (!r.moved) {
    if (Math.hypot(e.clientX - r.startX, e.clientY - r.startY) < 3) return;
    r.moved = true;
    useAppStore.getState().pushHistory();
  }
  const dx = (e.clientX - r.startX) / zoom;
  const dy = (e.clientY - r.startY) / zoom;
  const st = useAppStore.getState();
  if (r.autoH) {
    // Ручная высота работает как минимум: блок не может стать меньше содержания
    st.setCardMeta(r.cardId, { hManual: true });
    st.resizeCard(r.cardId, Math.max(MIN_W, r.startW + dx), Math.max(r.minH, r.startH + dy));
  } else {
    st.resizeCard(r.cardId, Math.max(MIN_W, r.startW + dx), Math.max(40, r.startH + dy));
  }
}

function onResizeUp() {
  window.removeEventListener('pointermove', onResizeMove);
  window.removeEventListener('pointerup', onResizeUp);
  resizeSession = null;
}

const histFlags = new WeakMap<object, boolean>();

function pushOnce(key: object) {
  if (!histFlags.get(key)) {
    useAppStore.getState().pushHistory();
    histFlags.set(key, true);
  }
}

/** Завершить правку при потере фокуса только пока окно приложения активно.
 *  Alt+Tab / переключение окон (document.hasFocus() === false) ввод не сбрасывает:
 *  вернулся — печатаешь дальше. Выход — клик вне текста или Escape. */
function blurEndEditing() {
  if (document.hasFocus()) useAppStore.getState().setEditing(null);
}

function startTopDrag(e: React.PointerEvent, cardId: string, locked: boolean) {
  const st = useAppStore.getState();
  let ids = st.selection;
  if (e.shiftKey) {
    if (!ids.includes(cardId)) {
      st.toggleSelection(cardId);
      ids = useAppStore.getState().selection;
    }
  } else if (!ids.includes(cardId)) {
    st.setSelection([cardId]);
    ids = [cardId];
  }

  if (locked) return;

  // Ctrl/⌘ + перенос — копирование: копии дублируются при первом движении
  session = {
    mode: 'top',
    ids: ids.includes(cardId) ? ids : [cardId],
    cardId,
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    moved: false,
    copyPending: !e.shiftKey && !!(e.ctrlKey || e.metaKey),
  };
  window.addEventListener('pointermove', onSessionMove);
  window.addEventListener('pointerup', onSessionUp);
}

function startChildDrag(e: React.PointerEvent, cardId: string, columnId: string, locked: boolean) {
  const st = useAppStore.getState();
  st.setSelection([cardId]);

  if (locked) return;
  session = {
    mode: 'child',
    ids: [cardId],
    cardId,
    columnId,
    startX: e.clientX,
    startY: e.clientY,
    lastX: e.clientX,
    lastY: e.clientY,
    moved: false,
  };
  window.addEventListener('pointermove', onSessionMove);
  window.addEventListener('pointerup', onSessionUp);
}

// Высота содержания карточки: нижняя граница самого глубокого поточного элемента
function contentHeightOf(shell: HTMLElement | null): number {
  if (!shell) return 40;
  const shellRect = shell.getBoundingClientRect();
  let bottom = 0;
  const pb = parseFloat(getComputedStyle(shell).paddingBottom) || 0;
  const walk = (el: HTMLElement) => {
    for (const child of Array.from(el.children) as HTMLElement[]) {
      const cs = getComputedStyle(child);
      if (cs.position === 'absolute' || cs.position === 'fixed') continue;
      // Контейнер, растянутый на всю высоту, не показатель содержания — углубляемся
      if (child.className?.toString().includes('h-full') || cs.height === shellRect.height + 'px') {
        walk(child);
        continue;
      }
      const r = child.getBoundingClientRect();
      bottom = Math.max(bottom, r.bottom - shellRect.top);
    }
  };
  walk(shell);
  if (!bottom) bottom = shell.scrollHeight;
  return Math.max(52, Math.round(bottom + pb));
}

function startResize(e: React.PointerEvent, cardId: string, card: Card, autoH: boolean, minH: number) {
  e.stopPropagation();
  resizeSession = {
    cardId,
    startX: e.clientX,
    startY: e.clientY,
    startW: card.w,
    startH: card.h,
    minH: Math.max(40, minH),
    autoH,
    moved: false,
  };
  window.addEventListener('pointermove', onResizeMove);
  window.addEventListener('pointerup', onResizeUp);
}

function startConnect(e: React.PointerEvent, cardId: string) {
  e.stopPropagation();
  e.preventDefault();
  const st = useAppStore.getState();
  const w = clientToWorld(e.clientX, e.clientY);
  if (!w) return;
  st.setConnecting({ from: cardId, x: w.x, y: w.y });

  const move = (ev: PointerEvent) => {
    const p = clientToWorld(ev.clientX, ev.clientY);
    if (p) useAppStore.getState().setConnecting({ from: cardId, x: p.x, y: p.y });
    // Подсветка карточки, на которую можно уронить связь (как dropPreview)
    const els = document.elementsFromPoint(ev.clientX, ev.clientY);
    let hoverId: string | undefined;
    for (const el of els) {
      const cand = el.closest('[data-card-id]') as HTMLElement | null;
      if (cand && cand.dataset.cardId !== cardId) {
        hoverId = cand.dataset.cardId;
        break;
      }
    }
    useAppStore.getState().setDropPreview(hoverId ? { cardId: hoverId } : null);
  };
  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    const st2 = useAppStore.getState();
    st2.setDropPreview(null);
    const els = document.elementsFromPoint(ev.clientX, ev.clientY);
    let targetId: string | undefined;
    for (const el of els) {
      const cand = el.closest('[data-card-id]') as HTMLElement | null;
      if (cand && cand.dataset.cardId !== cardId) {
        targetId = cand.dataset.cardId;
        break;
      }
    }
    if (targetId) {
      useAppStore.getState().addConnection(cardId, targetId);
    }
    useAppStore.getState().setConnecting(null);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
}

// Закреплённый текстовый блок превращается в газетную статью:
// шапка, заголовок (первая строка), подзаголовок (первый короткий абзац),
// остальной текст — в две колонки с линейкой, отбивкой и буквицей.
function ArticleBody({ text, markdown, boardId }: { text: string; markdown?: boolean; boardId?: string }) {
  const clean = text.replace(/^#{1,6}\s*/gm, '');
  const firstNl = clean.indexOf('\n');
  const headline = (firstNl === -1 ? clean : clean.slice(0, firstNl)).trim() || 'Без названия';
  let rest = firstNl === -1 ? '' : clean.slice(firstNl + 1).trim();
  const paras = rest ? rest.split(/\n\n+/) : [];
  let sub = '';
  if (paras.length > 1 && paras[0].replace(/\s/g, ' ').length <= 160) {
    sub = paras[0].trim();
    rest = paras.slice(1).join('\n\n');
  }

  return (
    <div className="article" onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}>
      <div className="article-mast">§</div>
      <h2 className="article-head">{headline}</h2>
      {sub ? <div className="article-sub">{sub}</div> : null}
      <div className="article-body">
        {markdown ? (
          <MarkdownView text={rest || sub || headline} boardId={boardId} />
        ) : (
          (rest || sub || headline).split(/\n\n+/).map((p, i) => (
            <p key={i}>
              <NoteTextWithLinks text={p} boardId={boardId} />
            </p>
          ))
        )}
      </div>
      <div className="article-foot">
        <span>Замечательно</span>
        <span>продолжение следует</span>
      </div>
    </div>
  );
}

// ---------- Tiptap-редактор (как в milanote) ----------

/** Старый текст — простой текст/Markdown; новый — HTML из tiptap */
const isHtmlContent = (s: string) => /^\s*<(p|div|h[1-6]|ul|ol|blockquote|pre|table|span)/i.test(s ?? '');
/** Новый формат хранения: ProseMirror JSON (как в milanote) */
const isJsonContent = (s: string) => /^\s*\{\s*"/.test(s ?? '') && (s ?? '').includes('"type":"doc"');

/** Точка клика для постановки каретки при входе в правку (как в milanote) */
let pendingCaret: { cardId: string; x: number; y: number } | null = null;

/** Старый простой текст → параграфы HTML для tiptap */
function legacyToHtml(s: string): string {
  return s
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, '<br>').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p>`)
    .join('');
}

/** Просмотр HTML-содержимого с кликабельными ссылками на блоки */
function HtmlRichText({ html, boardId }: { html: string; boardId?: string }) {
  const onClick = (e: React.MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    if (href.startsWith('#block:') && boardId) {
      e.preventDefault();
      e.stopPropagation();
      focusCard(boardId, href.slice('#block:'.length));
    } else if (href && !href.startsWith('#')) {
      e.preventDefault();
      e.stopPropagation();
      openLinkAfterConfirm(href);
    }
  };
  return (
    <div className="rte-view" onClick={onClick} onDoubleClick={(e) => e.stopPropagation()}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

/** Кегль текста — атрибут метки textStyle (S/M/L) */
const FONT_SIZES = [
  { id: 'S', px: 12, label: 'S' },
  { id: 'M', px: 14, label: 'M' },
  { id: 'L', px: 18, label: 'L' },
];

function TiptapEditor({ cardId, kind, initial }: { cardId: string; kind: 'note' | 'text'; initial: string }) {
  // Отложенная запись (как ExternalStoreSynchroniser в milanote):
  // store обновляется через паузу, мгновенный сброс — на blur/Escape/размонтирование
  const pendingRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const commitRef = useRef<() => void>(() => {});

  const editor = useEditor(
    {
      extensions: [
        StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
        Link.configure({ openOnClick: false, autolink: true }),
        Underline,
        TextStyle,
        FontSize,
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        Placeholder.configure({
          placeholder: kind === 'note' ? 'Введите текст…' : 'Введите текст…',
        }),
      ],
      content: isJsonContent(initial)
        ? JSON.parse(initial)
        : isHtmlContent(initial)
          ? initial
          : legacyToHtml(initial ?? ''),
      editorProps: {
        attributes: {
          class: 'rte-content',
          'data-nodrag': 'true',
          spellcheck: 'true',
        },
        handleKeyDown: (view, event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            commitRef.current();
            useAppStore.getState().setEditing(null);
            return true;
          }
          // Delete на пустой карточке удаляет её (Backspace — только текст)
          if (event.key === 'Delete') {
            const emptyDoc = view.state.doc.childCount <= 1 && view.state.doc.textContent === '';
            if (emptyDoc) {
              event.preventDefault();
              const st = useAppStore.getState();
              st.setEditing(null);
              st.deleteCards([cardId]);
              return true;
            }
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        // Универсальная карточка (как в milanote): весь текст = «[ ]» / «[x]» → становится задачей
        const text = editor.getText();
        if (/^\[[ x]\]?\s*$/i.test(text)) {
          const st = useAppStore.getState();
          st.updateCardData(cardId, {
            kind: 'todo',
            items: [{ id: uid(), text: '', done: /[x]/i.test(text) }],
          });
          st.setEditing(null);
          st.setSelection([cardId]);
          return;
        }
        // Контент — ProseMirror JSON; запись в store откладывается
        pendingRef.current = editor.isEmpty ? '' : JSON.stringify(editor.getJSON());
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => commitRef.current(), 700);
      },
      onBlur: () => {
        commitRef.current();
        blurEndEditing();
      },
    },
    [cardId, kind],
  );

  // Запись текста в карточку (мгновенный сброс отложенного)
  commitRef.current = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (pendingRef.current === null) return;
    const content = pendingRef.current;
    pendingRef.current = null;
    const st = useAppStore.getState();
    const card = st.boards[st.breadcrumb[st.breadcrumb.length - 1]]?.cards.find((c) => c.id === cardId);
    if (kind === 'note') {
      st.updateCardData(cardId, { kind: 'note', text: content, color: card?.data.kind === 'note' ? card.data.color : 'yellow' });
    } else {
      st.updateCardData(cardId, { kind: 'text', text: content });
    }
  };

  useEffect(() => {
    if (!editor) return;
    useAppStore.getState().setRteEditor(editor);
    // каретка в точку клика, если правку начали кликом по карточке
    const t = setTimeout(() => {
      if (pendingCaret && pendingCaret.cardId === cardId) {
        try {
          const pos = editor.view.posAtCoords({ left: pendingCaret.x, top: pendingCaret.y });
          editor.commands.focus(pos?.pos ?? 'end');
        } catch {
          editor.commands.focus('end');
        }
        pendingCaret = null;
      } else {
        editor.commands.focus('end');
      }
    }, 0);
    return () => {
      clearTimeout(t);
      commitRef.current();
      if (useAppStore.getState().rteEditor === editor) useAppStore.getState().setRteEditor(null);
    };
  }, [editor]);

  if (!editor) return null;
  return (
    <div
      data-nodrag
      className="w-full"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

/** Просмотр ProseMirror-JSON: конвертируется в HTML теми же расширениями */
function jsonToHtml(json: string): string | null {
  try {
    return generateHTML(JSON.parse(json), [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false }),
      Underline,
      TextStyle,
      FontSize,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
    ]);
  } catch {
    return null;
  }
}

function MarkdownView({ text, boardId }: { text: string; boardId?: string }) {
  return (
    <div className="md-body break-words">
      <ReactMarkdown
        components={{
          a: ({ href, children, ...props }) => {
            if (href && href.startsWith('#block:') && boardId) {
              const targetId = href.slice('#block:'.length);
              return (
                <a
                  href="#"
                  className="block-link"
                  onClick={(e) => {
                    e.preventDefault();
                    if (boardId) focusCard(boardId, targetId);
                  }}
                >
                  {children}
                </a>
              );
            }
            return <a {...props} href={href} target="_blank" rel="noopener noreferrer">{children}</a>;
          },
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

/** Рендер простого текста заметки с кликабельными ссылками на блоки */
function NoteTextWithLinks({ text, boardId }: { text: string; boardId?: string }) {
  if (!boardId) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  const re = /\[([^\]]+)\]\(#block:([\w-]+)\)|(^|[\s(])#([A-Za-zА-Яа-яЁё0-9_-]+(?:\/[A-Za-zА-Яа-яЁё0-9_-]+)*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let key = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[2]) {
      const targetId = m[2];
      parts.push(
        <a
          key={'l' + key++}
          href="#"
          className="block-link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            focusCard(boardId, targetId);
          }}
        >
          {m[1]}
        </a>
      );
      last = m.index + m[0].length;
    } else {
      // тег #тег или #тег/подтег
      const pre = m[3] ?? '';
      const tag = m[4];
      const tagStart = m.index + pre.length;
      if (m.index + pre.length > last) parts.push(text.slice(last, m.index + pre.length));
      parts.push(
        <a
          key={'t' + key++}
          href="#"
          className="tag-link"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            useAppStore.getState().setBottomPanel({ kind: 'tag', tag });
          }}
        >
          #{tag}
        </a>
      );
      last = tagStart + 1 + tag.length;
    }
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}

function TodoRow({
  card,
  item,
  index,
  inputRef,
}: {
  card: Card;
  item: TodoItem;
  index: number;
  inputRef: (el: HTMLInputElement | null) => void;
}) {
  const items = card.data.kind === 'todo' ? card.data.items : [];
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatKind, setRepeatKind] = useState<string>(item.repeat?.kind ?? 'none');
  const [everyN, setEveryN] = useState(
    item.repeat?.kind === 'daily' ? item.repeat.everyN
      : item.repeat?.kind === 'weekly' ? item.repeat.everyNWeeks
      : item.repeat?.kind === 'nthWeekday' ? item.repeat.everyNMonths
      : item.repeat?.kind === 'monthlyDay' ? item.repeat.everyNMonths
      : 1
  );
  const [nth, setNth] = useState(item.repeat?.kind === 'nthWeekday' ? item.repeat.nth : 1);
  const [weekday, setWeekday] = useState(item.repeat?.kind === 'weekly' || item.repeat?.kind === 'nthWeekday' ? item.repeat.weekday : 1);
  const [delayVal, setDelayVal] = useState(1);
  const [delayUnit, setDelayUnit] = useState<'m' | 'h' | 'd'>('d');
  const [afterBase, setAfterBase] = useState('');
  const [yearlyMonth, setYearlyMonth] = useState(new Date().getMonth());
  const [yearlyDay, setYearlyDay] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(item.due ? Number(item.due.slice(8, 10)) : new Date().getDate());

  const setItems = (next: TodoItem[], push = false) => {
    if (push) pushOnce(card);
    const title = card.data.kind === 'todo' ? card.data.title ?? '' : '';
    useAppStore.getState().updateCardData(card.id, { kind: 'todo', title, items: next });
  };

  const patch = (p: Partial<TodoItem>) => setItems(items.map((it, i) => (i === index ? { ...it, ...p } : it)), true);

  // активная дата пункта
  const activeDue = (() => {
    const r = item.repeat;
    if (!r || r.kind === 'none' || !item.due) return item.due;
    const lastDone = item.doneDates?.length ? item.doneDates[item.doneDates.length - 1] : null;
    if (!lastDone) return item.due;
    return nextOccurrence(r, lastDone) ?? item.due;
  })();
  const isDoneNow = item.repeat && item.repeat.kind !== 'none'
    ? (activeDue ? (item.doneDates ?? []).includes(activeDue) : false)
    : item.done;

  const toggleDone = () => {
    if (item.repeat && item.repeat.kind !== 'none' && activeDue) {
      const dates = item.doneDates ?? [];
      patch({
        doneDates: dates.includes(activeDue) ? dates.filter((d) => d !== activeDue) : [...dates, activeDue],
      });
    } else {
      patch({ done: !item.done });
    }
  };

  const saveRepeat = () => {
    const due = item.due ?? dateKey(new Date());
    let repeat: ItemRepeat = { kind: 'none' };
    if (repeatKind === 'daily') repeat = { kind: 'daily', everyN: Math.max(1, everyN) };
    else if (repeatKind === 'weekly') repeat = { kind: 'weekly', everyNWeeks: Math.max(1, everyN), weekday };
    else if (repeatKind === 'nthWeekday') repeat = { kind: 'nthWeekday', everyNMonths: Math.max(1, everyN), nth, weekday };
    else if (repeatKind === 'monthlyDay') repeat = { kind: 'monthlyDay', everyNMonths: Math.max(1, everyN), day: Math.max(1, dayOfMonth) };
    else if (repeatKind === 'yearly') repeat = { kind: 'yearly', month: yearlyMonth, day: Math.max(1, yearlyDay) };
    else if (repeatKind === 'after') {
      const minutes = delayUnit === 'm' ? delayVal : delayUnit === 'h' ? delayVal * 60 : delayVal * 1440;
      repeat = { kind: 'after', base: afterBase, delayMinutes: minutes };
    }
    patch({ repeat, due: repeat.kind === 'none' ? item.due : due });
    setRepeatOpen(false);
  };

  const otherItems = items.filter((it, i) => i !== index && it.text.trim());
  const overdue = activeDue && activeDue < dateKey(new Date()) && !isDoneNow;

  return (
    <div data-child-row>
      <div className="group/item flex items-start gap-2 rounded" data-child-row>
        <button
          data-nodrag
          aria-label={isDoneNow ? 'Отметить как невыполненную' : 'Отметить как выполненную'}
          className="todo-check mt-[3px] flex h-[16px] w-[16px] shrink-0 items-center justify-center rounded-[3px] border-[1.5px]"
          style={{
            borderColor: isDoneNow ? 'var(--accent)' : 'var(--text-faint)',
            background: isDoneNow ? 'var(--accent)' : 'transparent',
          }}
          onClick={(e) => {
            e.stopPropagation();
            pushOnce(card);
            toggleDone();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {isDoneNow ? <Check size={11} color="#fff" strokeWidth={3} /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            data-nodrag
            className="min-w-0 w-full border-0 bg-transparent p-0 outline-none"
            style={{
              fontSize: 'calc(13.5px * var(--content-scale))',
              lineHeight: 1.45,
              color: isDoneNow ? 'var(--text-muted)' : overdue ? '#c92a2a' : 'var(--text-main)',
              textDecoration: isDoneNow ? 'line-through' : 'none',
            }}
            value={item.text}
            data-todo-id={item.id}
            placeholder="Новый пункт"
            onChange={(e) => setItems(items.map((it, i) => (i === index ? { ...it, text: e.target.value } : it)), true)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                const newId = `td-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
                const next = [...items];
                next.splice(index + 1, 0, { id: newId, text: '', done: false });
                setItems(next, true);
                setTimeout(() => {
                  const el = document.querySelector<HTMLInputElement>(`input[data-todo-id="${newId}"]`);
                  el?.focus();
                }, 30);
              } else if (e.key === 'Backspace' && item.text === '' && items.length > 1) {
                e.preventDefault();
                setItems(items.filter((_, i) => i !== index), true);
              }
            }}
          />
          {activeDue ? (
            <div className="flex items-center gap-1 text-[10.5px]" style={{ color: overdue ? '#c92a2a' : 'var(--text-muted)' }}>
              <Clock size={10} />
              {overdue ? 'просрочено: ' : 'срок: '}
              {activeDue}
              {item.repeat && item.repeat.kind !== 'none' ? ' · ' + describeItemRepeat(item.repeat) : null}
            </div>
          ) : null}
        </div>
        <button
          data-nodrag
          aria-label="Срок и повтор"
          className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-muted)] opacity-0 hover:bg-[var(--hover-bg)] group-hover/item:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setRepeatOpen((v) => !v);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Clock size={12} />
        </button>
        <button
          data-nodrag
          aria-label="Удалить пункт"
          className="mt-[2px] flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--text-muted)] pointer-events-none opacity-0 hover:bg-[var(--hover-bg)] group-hover/item:pointer-events-auto group-hover/item:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            setItems(items.filter((_, i) => i !== index), true);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <X size={12} />
        </button>
      </div>

      {repeatOpen ? (
        <div
          className="repeat-form"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <input
              type="date"
              value={item.due ?? dateKey(new Date())}
              onChange={(e) => patch({ due: e.target.value })}
              className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[12px] text-[var(--text-main)] outline-none"
            />
            <select
              value={repeatKind}
              onChange={(e) => setRepeatKind(e.target.value)}
              className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-2 py-1 text-[12px] text-[var(--text-main)] outline-none"
            >
              <option value="none">Без повтора</option>
              <option value="daily">Ежедневно</option>
              <option value="weekly">Еженедельно</option>
              <option value="nthWeekday">Каждый k-й день недели месяца</option>
              <option value="monthlyDay">Каждое N-е число месяца</option>
              <option value="yearly">Ежегодно</option>
              <option value="after">После другой задачи</option>
            </select>
            {repeatKind === 'daily' ? (
              <span className="flex items-center gap-1 text-[12px] text-[var(--text-secondary)]">
                каждые <input type="number" min={1} value={everyN} onChange={(e) => setEveryN(Number(e.target.value) || 1)} className="w-14 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]" /> дня
              </span>
            ) : null}
            {repeatKind === 'weekly' ? (
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                каждые
                <input type="number" min={1} value={everyN} onChange={(e) => setEveryN(Number(e.target.value) || 1)} className="w-14 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]" />
                нед. по
                <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]">
                  {['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'].map((w, i) => (
                    <option key={i} value={i}>{w}</option>
                  ))}
                </select>
              </span>
            ) : null}
            {repeatKind === 'nthWeekday' ? (
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                каждый
                <select value={nth} onChange={(e) => setNth(Number(e.target.value))} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]">
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}-й</option>)}
                  <option value={-1}>последний</option>
                </select>
                <select value={weekday} onChange={(e) => setWeekday(Number(e.target.value))} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]">
                  {['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'].map((w, i) => (
                    <option key={i} value={i}>{w}</option>
                  ))}
                </select>
                месяца, каждые
                <input type="number" min={1} value={everyN} onChange={(e) => setEveryN(Number(e.target.value) || 1)} className="w-14 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]" />
                мес
              </span>
            ) : null}
            {repeatKind === 'monthlyDay' ? (
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                число
                <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value) || 1)} className="w-14 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]" />
                , каждые
                <input type="number" min={1} value={everyN} onChange={(e) => setEveryN(Number(e.target.value) || 1)} className="w-14 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]" />
                мес
              </span>
            ) : null}
            {repeatKind === 'yearly' ? (
              <span className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                <select value={yearlyMonth} onChange={(e) => setYearlyMonth(Number(e.target.value))} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]">
                  {['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'].map((m, i) => (
                    <option key={i} value={i}>{m}</option>
                  ))}
                </select>
                <input type="number" min={1} max={31} value={yearlyDay} onChange={(e) => setYearlyDay(Number(e.target.value) || 1)} className="w-14 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]" />
              </span>
            ) : null}
            {repeatKind === 'after' ? (
              <span className="flex flex-wrap items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                после
                <select value={afterBase} onChange={(e) => setAfterBase(e.target.value)} className="max-w-[220px] rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]">
                  <option value="">— выбрать —</option>
                  <option value={'alarm:' + card.id}>срока этого блока</option>
                  {otherItems.map((it) => (
                    <option key={it.id} value={'item:' + card.id + ':' + it.id}>
                      пункта «{(it.text || 'пункт').slice(0, 24)}»
                    </option>
                  ))}
                </select>
                через
                <input type="number" min={1} value={delayVal} onChange={(e) => setDelayVal(Number(e.target.value) || 1)} className="w-14 rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]" />
                <select value={delayUnit} onChange={(e) => setDelayUnit(e.target.value as 'm' | 'h' | 'd')} className="rounded-md border border-[var(--panel-border)] bg-[var(--panel-bg)] px-1.5 py-1 text-[var(--text-main)]">
                  <option value="m">мин</option>
                  <option value="h">час.</option>
                  <option value="d">дн.</option>
                </select>
              </span>
            ) : null}
          </div>
          <div className="mt-1.5 flex gap-1.5">
            <button className="repeat-save" onClick={() => saveRepeat()}>Сохранить</button>
            <button
              className="repeat-clear"
              onClick={() => {
                patch({ repeat: { kind: 'none' }, doneDates: [] });
                setRepeatKind('none');
                setRepeatOpen(false);
              }}
            >
              Убрать срок
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StateBadges({ card, due }: { card: Card; due: boolean }) {
  const chips: React.ReactNode[] = [];
  if (card.locked) {
    chips.push(
      <Hint key="lock" label="Расположение заблокировано" side="top">
        <span className="state-badge">
          <Lock size={9} strokeWidth={2.4} />
        </span>
      </Hint>
    );
  }
  if (card.status === 'urgent') {
    chips.push(
      <Hint key="urgent" label="Срочно" side="top">
        <span className="state-badge status-urgent">!</span>
      </Hint>
    );
  }
  if (card.status === 'actual') {
    chips.push(
      <Hint key="actual" label="Актуально" side="top">
        <span className="state-badge status-actual"><span className="diode diode-glow" /></span>
      </Hint>
    );
  }
  if (card.status === 'done') {
    chips.push(
      <Hint key="done" label="Выполнено" side="top">
        <span className="state-badge status-done"><span className="diode" /></span>
      </Hint>
    );
  }
  if (card.alarmAt) {
    chips.push(
      <Hint
        key="alarm"
        label={due ? `Срок наступил (${formatAlarm(card.alarmAt)})` : `Срок: ${formatAlarm(card.alarmAt)}`}
        side="top"
      >
        <span className={'state-badge' + (due ? ' is-due' : '')}>
          <BellRing size={10} strokeWidth={2.2} />
        </span>
      </Hint>
    );
  }
  if (!chips.length) return null;
  return <div className="state-badges">{chips}</div>;
}

function IconChip({
  icon,
  small,
  onClick,
}: {
  icon?: string;
  small?: boolean;
  onClick: () => void;
}) {
  return (
    <Hint label={icon ? 'Изменить иконку' : 'Задать иконку (смайл)'} side="top">
      <button
        data-nodrag
        data-icon-chip
        className={'icon-chip' + (small ? ' icon-chip-sm' : '')}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {icon ? <span className="icon-chip-emoji">{icon}</span> : <Smile size={small ? 12 : 14} strokeWidth={1.8} />}
      </button>
    </Hint>
  );
}

function EmojiPickerPanel({
  icon,
  onPick,
  onClear,
  onClose,
}: {
  icon?: string;
  onPick: (emoji: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      const t = ev.target;
      if (!(t instanceof Node)) return;
      if (ref.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-icon-chip]')) return;
      onClose();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-nodrag
      className="emoji-picker"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="emoji-picker-scroll">
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="emoji-group-label">{group.label}</div>
            <div className="emoji-grid">
              {group.emojis.map((em) => (
                <button
                  key={em}
                  className={'emoji-cell' + (icon === em ? ' is-active' : '')}
                  aria-label={`Иконка ${em}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onPick(em);
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="emoji-picker-footer">
        {icon ? (
          <button
            className="emoji-clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            Убрать иконку
          </button>
        ) : (
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>Выберите смайл</span>
        )}
        <button
          className="emoji-close"
          aria-label="Закрыть палитру"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

function AlarmPanel({
  value,
  onSave,
  onClose,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState(value ?? nowToLocalInput());

  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      const t = ev.target;
      if (!(t instanceof Node)) return;
      if (ref.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-meta-alarm]')) return;
      onClose();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-nodrag
      className="alarm-panel"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-main)' }}>
        <AlarmClock size={13} />
        Срок
      </div>
      <div style={{ fontSize: 10.5, lineHeight: 1.4, color: 'var(--text-muted)', marginTop: 3 }}>
        С этого времени блок подсвечивается как дедлайн
      </div>
      <input
        type="datetime-local"
        className="alarm-input"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') {
            e.preventDefault();
            onSave(draft || null);
          }
        }}
      />
      <div className="flex items-center justify-end gap-1.5" style={{ marginTop: 7 }}>
        {value ? (
          <button
            className="alarm-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSave(null);
            }}
          >
            Убрать
          </button>
        ) : null}
        <button
          className="alarm-btn alarm-btn-primary"
          onClick={(e) => {
            e.stopPropagation();
            onSave(draft || null);
          }}
        >
          Установить
        </button>
      </div>
    </div>
  );
}

function IconPickerPanel({
  kind,
  icon,
  onPick,
  onClear,
  onClose,
}: {
  kind: 'subject' | 'object' | 'organization';
  icon?: string;
  onPick: (name: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (ev: PointerEvent) => {
      const t = ev.target;
      if (!(t instanceof Node)) return;
      if (ref.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-icon-chip]')) return;
      onClose();
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      data-nodrag
      className="icon-picker"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <div className="emoji-picker-scroll">
        {ENTITY_ICON_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="emoji-group-label">{group.label}</div>
            <div className="icon-grid">
              {group.icons.map((def) => (
                <Hint key={def.name} label={def.label} side="top">
                  <button
                    className={'icon-cell' + (icon === def.name ? ' is-active' : '')}
                    aria-label={def.label}
                    onClick={(e) => {
                      e.stopPropagation();
                      onPick(def.name);
                    }}
                  >
                    <EntityIconGlyph kind={kind} name={def.name} size={16} strokeWidth={1.6} />
                  </button>
                </Hint>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="emoji-picker-footer">
        {icon ? (
          <button
            className="emoji-clear"
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
          >
            Стандартная иконка
          </button>
        ) : (
          <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>Выберите иконку</span>
        )}
        <button
          className="emoji-close"
          aria-label="Закрыть палитру"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

type EntityKind = 'subject' | 'organization' | 'object';

function EntityField({
  card,
  def,
  value,
  onChange,
}: {
  card: Card;
  def: EntityFieldDef;
  value: string;
  onChange: (v: string, push?: boolean) => void;
}) {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!def.area) return;
    const el = areaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value, def.area]);

  return (
    <div className="flex flex-col gap-[2px]">
      <div
        style={{
          fontSize: 9.5,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.07em',
          color: 'var(--text-faint)',
          padding: '0 1px',
        }}
      >
        {def.label}
      </div>
      {def.area ? (
        <textarea
          ref={areaRef}
          data-nodrag
          rows={1}
          className="w-full resize-none border-0 bg-transparent p-0 outline-none"
          style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-main)' }}
          value={value}
          placeholder={def.placeholder}
          onFocus={() => pushOnce(card)}
          onChange={(e) => onChange(e.target.value, true)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      ) : (
        <input
          data-nodrag
          className="w-full border-0 bg-transparent p-0 outline-none"
          style={{ fontSize: 12.5, lineHeight: 1.45, color: 'var(--text-main)' }}
          value={value}
          placeholder={def.placeholder}
          onFocus={() => pushOnce(card)}
          onChange={(e) => onChange(e.target.value, true)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
}

function EntityBody({
  cardId,
  card,
  kind,
  iconPanelOpen,
  onToggleIcon,
}: {
  cardId: string;
  card: Card;
  kind: EntityKind;
  iconPanelOpen: boolean;
  onToggleIcon: () => void;
}) {
  const tag = ENTITY_TAG[kind]!;
  const fields = ENTITY_FIELDS[kind]!;
  const d = card.data as Extract<Card['data'], { kind: EntityKind }>;

  const setField = (key: string, value: string, push = false) => {
    if (push) pushOnce(card);
    const next = { ...d, [key]: value } as typeof d;
    useAppStore.getState().updateCardData(cardId, next);
  };

  const setIcon = (icon: string | undefined) => {
    useAppStore.getState().setCardMeta(cardId, { icon });
  };

  const iconName = card.icon && ENTITY_ICON_NAMES.has(card.icon) ? card.icon : undefined;

  return (
    <div
      className="flex-1 w-full p-[10px] pb-[9px]"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        color: 'var(--text-main)',
        borderRadius: 'var(--radius-card)',
        minHeight: 76,
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {}
      <div className="flex items-center gap-1.5" style={{ padding: '0 1px' }}>
        <span className="h-[7px] w-[7px] rounded-full" style={{ background: tag.dot, flexShrink: 0 }} />
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'var(--text-faint)',
            textTransform: 'uppercase',
          }}
        >
          {tag.label}
        </span>
      </div>

      {}
      <div className="mt-1 flex items-center gap-1.5">
        <Hint label={iconName ? 'Изменить иконку' : 'Задать иконку'} side="top">
          <button
            data-nodrag
            data-icon-chip
            className="icon-chip"
            onClick={(e) => {
              e.stopPropagation();
              onToggleIcon();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            <EntityIconGlyph kind="organization" name={iconName} size={15} strokeWidth={1.7} />
          </button>
        </Hint>
        <input
          data-nodrag
          className="min-w-0 flex-1 border-0 bg-transparent p-0 outline-none"
          style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'var(--text-main)' }}
          value={d.name}
          placeholder=""
          onFocus={() => pushOnce(card)}
          onChange={(e) => setField('name', e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') e.currentTarget.blur();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      </div>

      {}
      {iconPanelOpen ? (
        <div className="mt-1.5">
          <IconPickerPanel
            kind="organization"
            icon={iconName}
            onPick={(name) => setIcon(name)}
            onClear={() => {
              setIcon(undefined);
              onToggleIcon();
            }}
            onClose={onToggleIcon}
          />
        </div>
      ) : null}

      {}
      <div className="mt-1.5 flex flex-col gap-[7px]">
        {fields.map((f) => (
          <EntityField
            key={f.key}
            card={card}
            def={f}
            value={(d as unknown as Record<string, string>)[f.key] ?? ''}
            onChange={(v, push) => setField(f.key, v, push)}
          />
        ))}
      </div>
    </div>
  );
}

const ENTITY_VISUAL_H = 210;

const ENTITY_VISUAL_EXPANDED_H = 120;

const SUBJECT_NAME_FIELD: EntityFieldDef = { key: 'name', label: 'Имя', placeholder: '' };
const OBJECT_NAME_FIELD: EntityFieldDef = { key: 'name', label: 'Название', placeholder: '' };

function EntityVisualBody({
  cardId,
  card,
  kind,
  expanded,
  onToggleExpanded,
  iconPanelOpen,
  onToggleIcon,
}: {
  cardId: string;
  card: Card;
  kind: 'subject' | 'object';
  expanded: boolean;
  onToggleExpanded: () => void;
  iconPanelOpen: boolean;
  onToggleIcon: () => void;
}) {
  const tag = ENTITY_TAG[kind]!;
  const fields = ENTITY_FIELDS[kind]!;
  const d = card.data as Extract<Card['data'], { kind: 'subject' | 'object' }>;
  const photoFileRef = useRef<HTMLInputElement>(null);

  const setField = (key: string, value: string, push = false) => {
    if (push) pushOnce(card);
    const next = { ...d, [key]: value } as typeof d;
    useAppStore.getState().updateCardData(cardId, next);
  };

  const setPhoto = (photo: string) => {
    pushOnce(card);
    useAppStore.getState().updateCardData(cardId, { ...d, photo } as typeof d);
  };

  const setIcon = (name: string | undefined) => {
    useAppStore.getState().setCardMeta(cardId, { icon: name });
  };

  const readPhoto = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Фото слишком большое', description: 'Выберите файл до 10 МБ.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      let src = String(reader.result);

      if (file.size > MAX_IMAGE_SRC_BYTES) {
        src = await downscaleImage(src, file.type === 'image/png');
      }
      setPhoto(src);
    };
    reader.readAsDataURL(file);
  };

  const iconName = card.icon && ENTITY_ICON_NAMES.has(card.icon) ? card.icon : undefined;
  const photo = d.photo || '';
  const visualH = expanded ? ENTITY_VISUAL_EXPANDED_H : ENTITY_VISUAL_H;
  const glyphSize = expanded ? 40 : Math.round(Math.min(92, visualH * 0.36));

  return (
    <div
      className="flex-1 w-full"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 'var(--radius-card)',
        color: 'var(--text-main)',
        overflow: 'hidden',
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {}
      <div
        className={'entity-visual' + (expanded ? ' is-expanded' : '') + (photo ? ' has-photo' : '')}
        style={{ height: visualH }}
        onClick={onToggleExpanded}
      >
        {photo ? (
          <img src={photo} alt={d.name || tag.label} className="entity-visual-photo" draggable={false} />
        ) : (
          <div className="entity-visual-icon">
            <EntityIconGlyph kind={kind} name={iconName} size={glyphSize} strokeWidth={1.1} />
          </div>
        )}

        {}
        <div className={'entity-visual-tag' + (photo ? ' on-photo' : '')}>
          <span className="h-[7px] w-[7px] rounded-full" style={{ background: tag.dot, flexShrink: 0 }} />
          <span>{tag.label}</span>
        </div>

        {}
        <div className={'entity-visual-name' + (photo ? ' on-photo' : '')}>{d.name || tag.label}</div>
      </div>

      {}
      {expanded ? (
        <div className="entity-expanded">
          <EntityField
            card={card}
            def={kind === 'subject' ? SUBJECT_NAME_FIELD : OBJECT_NAME_FIELD}
            value={d.name}
            onChange={(v, push) => setField('name', v, push)}
          />

          {}
          <div className="entity-controls">
            <button
              data-nodrag
              className="entity-ctl-btn"
              onClick={(e) => {
                e.stopPropagation();
                photoFileRef.current?.click();
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <ImagePlus size={13} strokeWidth={1.8} />
              {photo ? 'Заменить фото' : 'Загрузить фото'}
            </button>
            <button
              data-nodrag
              className={'entity-ctl-btn' + (iconPanelOpen ? ' is-open' : '')}
              onClick={(e) => {
                e.stopPropagation();
                onToggleIcon();
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <EntityIconGlyph kind={kind} name={iconName} size={13} strokeWidth={1.8} />
              Иконка
            </button>
            {photo ? (
              <button
                data-nodrag
                className="entity-ctl-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setPhoto('');
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <X size={13} strokeWidth={1.8} />
                Убрать фото
              </button>
            ) : null}
          </div>

          {iconPanelOpen ? (
            <IconPickerPanel
              kind={kind}
              icon={iconName}
              onPick={(name) => {
                setIcon(name);
                setPhoto('');
              }}
              onClear={() => {
                setIcon(undefined);
                onToggleIcon();
              }}
              onClose={onToggleIcon}
            />
          ) : null}

          {
}
          <div className="mt-1 flex flex-col gap-[7px]">
            {fields.map((f) => (
              <EntityField
                key={f.key}
                card={card}
                def={f}
                value={(d as unknown as Record<string, string>)[f.key] ?? ''}
                onChange={(v, push) => setField(f.key, v, push)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <input
        ref={photoFileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readPhoto(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

interface CardViewProps {
  cardId: string;
  boardId: string;
}

function CardViewInner({ cardId, boardId }: CardViewProps) {
  const card = useAppStore((s) => s.boards[boardId]?.cards.find((c) => c.id === cardId));
  const selected = useAppStore((s) => s.selection.includes(cardId));
  // Был ли блок единственным выделенным ещё до нажатия мыши (для «клик — правка»)
  const wasSelectedOnDown = useRef(false);
  // Viewport-рендеринг: карточка далеко за листом рисуется заглушкой (как в kinopio)
  const [vpVisible, setVpVisible] = useState(true);
  useEffect(() => {
    if (!rootRef.current) return;
    return observeCardVisibility('card:' + cardId, rootRef.current, setVpVisible);
  }, [cardId]);
  const theme = useAppStore((s) => s.theme);
  const mixCards = useAppStore((s) => s.simpleMix?.cards ?? null);
  const dropPreviewCard = useAppStore((s) => s.dropPreview?.cardId === cardId);
  const extractGhost = useAppStore((s) => s.extractGhost?.cardId === cardId);
  const editingId = useAppStore((s) => s.editingId);
  const dragging = useAppStore((s) => s.dragging && s.selection.includes(cardId));

  const [filterBusy, setFilterBusy] = useState(false);
  const columnParentId = useAppStore((s) => {
    const b = s.boards[boardId];
    if (!b) return null;
    for (const c of b.cards) {
      if (c.data.kind === 'column' && c.data.cardIds.includes(cardId)) return c.id;
    }
    return null;
  });
  const rootRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkEdit, setLinkEdit] = useState(false);
  const [urlDraft, setUrlDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const linkUrlRef = useRef<HTMLInputElement>(null);
  const [hovered, setHovered] = useState(false);
  const todoInputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  const [panel, setPanel] = useState<'alarm' | 'icon' | null>(null);

  const [entExpanded, setEntExpanded] = useState(false);

  const [, tickAlarm] = useState(0);
  const alarmAt = card?.alarmAt ?? null;
  const alarmDue = isAlarmDue(alarmAt);

  useEffect(() => {
    if (!alarmAt) return;
    return subscribeToTick(() => tickAlarm((n) => n + 1));
  }, [alarmAt]);

  const prevDueRef = useRef<boolean | null>(null);
  useEffect(() => {
    const prev = prevDueRef.current;
    prevDueRef.current = alarmDue;
    if (prev !== false || !alarmDue || !alarmAt) return;
    const st = useAppStore.getState();
    const c = st.boards[boardId]?.cards.find((cc) => cc.id === cardId);
    if (!c) return;
    toast({
      title: '⏰ Дедлайн наступил',
      description: `«${cardDisplayName(c, st.boards)}» — время вышло (${formatAlarm(alarmAt)})`,
    });
  }, [alarmDue, alarmAt, boardId, cardId]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    const ro = new ResizeObserver(() => {

      if (useAppStore.getState().dragging) return;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        const zoom = canvasHandle.zoom || 1;
        const w = rect.width / zoom;
        const h = rect.height / zoom;
        const prev = measuredSizes.get(cardId);
        if (!prev || Math.abs(prev.w - w) > 0.5 || Math.abs(prev.h - h) > 0.5) {
          measuredSizes.set(cardId, { w, h });
          useAppStore.getState().bumpLayout();
        }
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [cardId]);

  useEffect(() => {
    const onReplaceImage = (ev: Event) => {
      if ((ev as CustomEvent).detail === cardId) fileRef.current?.click();
    };
    const onEditLink = (ev: Event) => {
      if ((ev as CustomEvent).detail === cardId && card?.data.kind === 'link') {
        openLinkEditor();
      }
    };
    const onAlarm = (ev: Event) => {
      if ((ev as CustomEvent).detail === cardId) setPanel('alarm');
    };
    const onClearDone = (ev: Event) => {
      if ((ev as CustomEvent).detail === cardId && card?.data.kind === 'todo') {
        useAppStore.getState().pushHistory();
        useAppStore.getState().updateCardData(cardId, {
          kind: 'todo',
          title: card.data.title ?? '',
          items: card.data.items.filter((i) => !i.done),
        });
      }
    };
    window.addEventListener('klaster-replace-image', onReplaceImage);
    window.addEventListener('klaster-edit-link', onEditLink);
    window.addEventListener('klaster-todo-clear-done', onClearDone);
    window.addEventListener('klaster-alarm', onAlarm);
    return () => {
      window.removeEventListener('klaster-replace-image', onReplaceImage);
      window.removeEventListener('klaster-edit-link', onEditLink);
      window.removeEventListener('klaster-todo-clear-done', onClearDone);
    window.removeEventListener('klaster-alarm', onAlarm);
    };
  }, [cardId, card]);

  if (!card) return null;

  const openLinkEditor = () => {
    if (card?.data.kind !== 'link') return;
    setUrlDraft(card.data.url);
    setTitleDraft(card.data.title ?? '');
    setDescDraft(card.data.description ?? '');
    setLinkEdit(true);
    setTimeout(() => linkUrlRef.current?.focus(), 0);
  };

  const cancelLinkEditor = () => {
    setLinkEdit(false);
    if (card?.data.kind === 'link' && !card.data.url) return;
  };

  const saveLink = () => {
    if (card?.data.kind !== 'link') return;
    let url = urlDraft.trim();
    if (!url) return;
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    let host = url;
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      host = url;
    }
    pushOnce(card);
    useAppStore.getState().updateCardData(cardId, {
      kind: 'link',
      url,
      title: titleDraft.trim() || host,
      description: descDraft.trim(),
    });
    setLinkEdit(false);
  };

  const isChild = columnParentId !== null;
  const autoH = isAutoHeight(card.type);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    stickyRef.current?.reset();
    const stDown = useAppStore.getState();
    wasSelectedOnDown.current = stDown.selection.includes(cardId) && stDown.selection.length === 1;
    if ((e.target as HTMLElement).closest('[data-nodrag]')) return;
    if ((e.target as HTMLElement).closest('.block-link, .tag-link')) {
      e.stopPropagation();
      return;
    }
    if (e.altKey) {
      // Alt — режим ссылок: не тащим карточку, браузер выделяет текст.
      // Запоминаем уже выделенный текст, пока клик не сбросил выделение.
      e.stopPropagation();
      captureAltSelection(boardId, cardId);
      return;
    }

    if (e.pointerType === 'touch') {
      const x0 = e.clientX;
      const y0 = e.clientY;
      let cancelled = false;
      const cancelLp = () => {
        window.removeEventListener('pointermove', onLpMove);
        window.removeEventListener('pointerup', cancelLp);
        window.removeEventListener('pointercancel', cancelLp);
      };
      const onLpMove = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 8) {
          cancelled = true;
          cancelLp();
        }
      };
      window.addEventListener('pointermove', onLpMove);
      window.addEventListener('pointerup', cancelLp, { once: true });
      window.addEventListener('pointercancel', cancelLp, { once: true });
      window.setTimeout(() => {
        if (cancelled) return;
        cancelLp();
        cancelSessionSilently();
        const st = useAppStore.getState();
        if (!st.selection.includes(cardId)) st.setSelection([cardId]);
        st.openContextMenu({ kind: 'card', cardId, x: x0, y: y0 });
      }, 550);
    }
    beginDrag(e);
  };

  const beginDrag = (e: React.PointerEvent) => {
    if (isChild) {
      const colId = findColumnOf(useAppStore.getState().boards[boardId], cardId)!;
      startChildDrag(e, cardId, colId, !!card.locked);
    } else {
      startTopDrag(e, cardId, !!card.locked);
    }
  };

  // Alt+клик: если до этого был выделен текст в другой карточке — вставить ссылку;
  // если выделен сам блок — показать панель входящих ссылок (бэклинки).
  const handleAltClick = (targetCardId: string, altLabel: string, altSourceId?: string) => {
    const st = useAppStore.getState();
    if (altLabel && altSourceId) {
      const source = st.boards[boardId]?.cards.find((c) => c.id === altSourceId);
      if (source && altSourceId !== targetCardId && (source.data.kind === 'note' || source.data.kind === 'text')) {
        const text = (source.data as { text?: string }).text ?? '';
        if (text.includes(altLabel)) {
          st.pushHistory();
          st.updateCardData(altSourceId, {
            kind: source.data.kind,
            text: text.replace(altLabel, `[${altLabel}](#block:${targetCardId})`),
          } as never);
          toast({ title: 'Ссылка вставлена' });
          return;
        }
      }
    }
    st.setSelection([targetCardId]);
    st.setBottomPanel({ kind: 'backlinks', cardId: targetCardId, boardId });
  };

  const onAltClick = (e: React.MouseEvent) => {
    if (!e.altKey) return;
    e.preventDefault();
    e.stopPropagation();
    const stash = altLinkStash;
    altLinkStash = null;
    handleAltClick(cardId, stash?.label ?? '', stash?.sourceId);
  };

  // Одиночный клик по уже выделенной заметке/тексту сразу включает редактирование:
  // первый клик выделяет блок, второй — ставит курсор. Двойной клик тоже работает.
  const onShellClick = (e: React.MouseEvent) => {
    onAltClick(e);
    if (e.defaultPrevented) return;
    // Kinopio: Ctrl+клик выделяет всю «гроздь» связанных карточек (обход графа)
    if (stickyTheme && (e.ctrlKey || e.metaKey) && card.type !== 'column') {
      const st = useAppStore.getState();
      const board = st.boards[boardId];
      if (board) {
        const ids = new Set([cardId]);
        let grew = true;
        while (grew) {
          grew = false;
          for (const cn of board.connections) {
            if (ids.has(cn.from) && !ids.has(cn.to)) { ids.add(cn.to); grew = true; }
            if (ids.has(cn.to) && !ids.has(cn.from)) { ids.add(cn.from); grew = true; }
          }
        }
        if (ids.size > 1) {
          e.stopPropagation();
          st.setSelection([...ids]);
          return;
        }
      }
    }
    if (card.type !== 'note' && card.type !== 'text') return;
    if (card.locked) return;
    const t = e.target as HTMLElement;
    if (t.closest('[data-nodrag], input, textarea, button, a, .block-link, .tag-link')) return;
    const st = useAppStore.getState();
    if (st.dragging || st.editingId === cardId) return;
    if (wasSelectedOnDown.current) {
      e.stopPropagation();
      pendingCaret = { cardId, x: e.clientX, y: e.clientY };
      st.setEditing(cardId);
    }
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const st = useAppStore.getState();
    switch (card.type) {
      case 'note':
      case 'text':
        pendingCaret = { cardId, x: e.clientX, y: e.clientY };
        st.setEditing(cardId);
        break;
      case 'todo':
        st.setEditing(null);
        break;
      case 'image':
        if (!card.data.src) fileRef.current?.click();
        break;
      case 'link':
        if (!card.data.url) {
          openLinkEditor();
        } else {
          openLinkAfterConfirm(card.data.url);
        }
        break;
      case 'board':
        if (card.data.boardId) st.openSubBoard(card.data.boardId);
        break;
      case 'column':
        st.setEditing(cardId);
        break;
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const st = useAppStore.getState();
    if (!st.selection.includes(cardId)) st.setSelection([cardId]);
    st.openContextMenu({ kind: 'card', cardId, x: e.clientX, y: e.clientY });
  };

  const onDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (card.type !== 'image') return;
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    void readImage(file);
  };

  const readImage = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'Изображение слишком большое', description: 'Выберите файл до 10 МБ.' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      let src = String(reader.result);

      if (file.size > MAX_IMAGE_SRC_BYTES) {
        src = await downscaleImage(src, file.type === 'image/png');
      }
      pushOnce(card);
      useAppStore.getState().updateCardData(cardId, { kind: 'image', src, alt: file.name, srcOriginal: src, filter: null });
    };
    reader.readAsDataURL(file);
  };

  const applyFilter = (id: ImageFilterId) => {
    const d = card.data as Extract<Card['data'], { kind: 'image' }>;
    if (card.type !== 'image' || !d.src || filterBusy) return;
    const st = useAppStore.getState();
    st.pushHistory();
    const baseSrc = d.srcOriginal || d.src;
    setFilterBusy(true);
    void applyImageFilter(baseSrc, id)
      .then((out) => {
        useAppStore.getState().updateCardData(cardId, {
          kind: 'image',
          src: id === 'original' ? baseSrc : out,
          alt: d.alt,
          srcOriginal: baseSrc,
          filter: id === 'original' ? null : id,
        });
      })
      .catch((e) => { console.error('filter error', e); toast({ title: 'Не удалось применить фильтр', description: 'Попробуйте ещё раз' }); })
      .finally(() => setFilterBusy(false));
  };

  const isDraw = card.type === 'draw';
  // Тело заметки/текста/каталога должно заполнять блок по высоте даже при
  // ручном растяжении: оболочка — flex-колонка, тело — flex-1.
  const flexShell = card.type === 'draw' || card.type === 'shape' || card.type === 'image'
    ? {}
    : { display: 'flex', flexDirection: 'column' };
  const shellStyle: React.CSSProperties = isChild
    ? {
        width: card.w,
        ...flexShell,
        opacity: extractGhost ? 0.3 : 1,
      }
    : {
        left: card.x,
        top: card.y,
        width: card.w,
        ...flexShell,
        ...(autoH
          ? // Высота задаётся содержанием: card.h (в т.ч. растянутая вручную) — это минимум,
            // поэтому блок растёт, когда текста становится больше.
            { minHeight: Math.max(52, card.h) }
          : { height: card.h }),

        zIndex: isDraw ? 4 : dragging ? 40 : panel ? 45 : selected ? 20 : 10,
        opacity: extractGhost ? 0.3 : 1,
      };

  const shadowCls = isDraw
    ? ''
    : dragging
      ? 'shadow-[var(--card-shadow-drag)] '
      : 'shadow-[var(--card-shadow)] ';
  const statusFilter = useAppStore((s) => s.statusFilter);
  const tagFilter = useAppStore((s) => s.tagFilter);
  const commentsOpen = useAppStore((s) => s.commentsOpenIds.includes(cardId));
  const [ctDraft, setCtDraft] = useState('');
  const stRef = useAppStore;
  const dimmed =
    (statusFilter !== null && card.status !== statusFilter) ||
    (tagFilter !== null && !(card.tags ?? []).some((t) => t === tagFilter || t.startsWith(tagFilter + '/')));
  const hasComments = (card.comments?.length ?? 0) > 0;
  const shellClass =
    (isChild ? 'group relative card-child ' : 'group absolute ') +
    'card-shell select-none transition-shadow duration-100 ' +
    (dragging ? 'is-dragging ' : '') +
    (dimmed ? 'is-dimmed ' : '') +
    (card.status ? 'has-status status-' + card.status + ' ' : '') +
    (hasComments ? 'has-comments ' : '') +
    shadowCls;

  // пипка и ручки не исчезают мгновенно: держим 900 мс после ухода курсора
  const [handlesSticky, setHandlesSticky] = useState(false);
  const stickyTimer = useRef<number | null>(null);
  // «Резиновые» карточки — только в теме «Кинопио»
  const stickyRef = useRef<StickyHandle | null>(null);
  const stickyTheme = theme === 'kinopio';
  const onCardEnter = () => {
    setHovered(true);
    if (stickyTimer.current) { window.clearTimeout(stickyTimer.current); stickyTimer.current = null; }
    if (stickyTheme && rootRef.current && !card.locked && card.type !== 'draw' && card.type !== 'shape') {
      stickyRef.current?.dispose();
      stickyRef.current = attachSticky(rootRef.current, () => {
        const s = useAppStore.getState();
        // липучка живёт только в теме «Кинопио» — сменил тему, и она отпустила
        return s.theme === 'kinopio' && !s.dragging && s.editingId !== cardId;
      });
      stickyRef.current.enter();
    }
  };
  const onCardLeave = () => {
    setHovered(false);
    setHandlesSticky(true);
    stickyRef.current?.leave();
    if (stickyTimer.current) window.clearTimeout(stickyTimer.current);
    stickyTimer.current = window.setTimeout(() => setHandlesSticky(false), 900);
  };
  useEffect(() => () => {
    if (stickyTimer.current) window.clearTimeout(stickyTimer.current);
    stickyRef.current?.dispose();
  }, []);
  // сменил тему с «Кинопио» — липучка немедленно отпускает
  useEffect(() => {
    if (theme !== 'kinopio') {
      stickyRef.current?.dispose();
      stickyRef.current = null;
    }
  }, [theme]);
  const showHandles = (hovered || selected || handlesSticky) && !dragging;
  const previewStyle: React.CSSProperties = dropPreviewCard
    ? { boxShadow: '0 0 0 3px color-mix(in srgb, var(--accent) 33%, transparent), 0 0 0 2px var(--accent)' }
    : {};

  // Стекло нового дизайна Apple: матовый blur прямо инлайном — минификатор CSS
  // вырезает стандартный backdrop-filter, инлайн-стиль не трогает
  const glassStyle: React.CSSProperties =
    theme === 'apple' || theme === 'apple-night'
      ? { backdropFilter: 'blur(24px) saturate(180%)', WebkitBackdropFilter: 'blur(24px) saturate(180%)' }
      : {};
  const mergedStyle: React.CSSProperties = { ...shellStyle, ...glassStyle, ...previewStyle };

  // Далеко за листом: лёгкая заглушка вместо полноценной карточки.
  // Видимыми принудительно остаются выделенные, редактируемые и перетаскиваемые.
  const sNow = useAppStore.getState();
  const cardOnScreen =
    vpVisible ||
    selected ||
    panel !== null ||
    sNow.editingId === cardId ||
    (sNow.dragging && sNow.selection.includes(cardId));
  if (!cardOnScreen) {
    return (
      <div
        ref={rootRef}
        data-card-id={cardId}
        data-column-id={card.type === 'column' ? cardId : undefined}
        className={shellClass}
        style={mergedStyle}
        onPointerDown={onPointerDown}
        onClick={onShellClick}
        onContextMenu={onContextMenu}
        onMouseEnter={onCardEnter}
        onMouseLeave={onCardLeave}
      />
    );
  }

  let inner: React.ReactNode = null;

  if (card.type === 'note') {
    const d = card.data as Extract<Card['data'], { kind: 'note' }>;

    const palette = notePaletteWithMix(theme, { cards: mixCards });
    const c = palette[d.color] ?? palette.yellow;
    const editing = editingId === cardId;
    inner = (
      <div
        className={'flex-1 w-full p-[12px] note-body' + (card.locked ? ' note-newspaper' : '')}
        style={{ background: card.locked ? undefined : c.bg, border: card.locked ? undefined : `1px solid ${c.border}`, color: c.fg ?? 'var(--note-text, var(--text-main))', minHeight: 52, borderRadius: 'var(--radius-card)' }}
        onDoubleClick={onDoubleClick}
      >
        {editing ? (
          <TiptapEditor cardId={cardId} kind="note" initial={d.text ?? ''} />
        ) : card.locked && d.text ? (
          <ArticleBody text={d.text} boardId={boardId} />
        ) : (
          <div className="whitespace-pre-wrap break-words" style={{ fontSize: 'calc(14px * var(--content-scale))', lineHeight: 1.45 }}>
            {d.text ? (
              isJsonContent(d.text) ? (
                <HtmlRichText html={jsonToHtml(d.text) ?? ''} boardId={boardId} />
              ) : isHtmlContent(d.text) ? (
                <HtmlRichText html={d.text} boardId={boardId} />
              ) : (
                <NoteTextWithLinks text={d.text} boardId={boardId} />
              )
            ) : (
              <span style={{ color: c.fg ? `color-mix(in srgb, ${c.fg} 60%, transparent)` : 'var(--note-placeholder, var(--text-muted))' }}>…</span>
            )}
          </div>
        )}
      </div>
    );
  } else if (card.type === 'text') {
    const d = card.data as Extract<Card['data'], { kind: 'text' }>;
    const editing = editingId === cardId;
    inner = (
      <div
        className="flex-1 w-full p-[12px]"
        style={{ background: 'var(--card-bg)', border: `1px solid var(--card-border)`, color: 'var(--text-main)', minHeight: 44, borderRadius: 'var(--radius-card)' }}
        onDoubleClick={onDoubleClick}
      >
        {editing ? (
          <TiptapEditor cardId={cardId} kind="text" initial={d.text ?? ''} />
        ) : card.locked && d.text ? (
          <ArticleBody text={d.text} markdown />
        ) : (
          <>
            {d.text ? (
              isJsonContent(d.text) ? (
                <HtmlRichText html={jsonToHtml(d.text) ?? ''} boardId={boardId} />
              ) : isHtmlContent(d.text) ? (
                <HtmlRichText html={d.text} boardId={boardId} />
              ) : (
                <MarkdownView text={d.text} boardId={boardId} />
              )
            ) : (
              <div className="whitespace-pre-wrap break-words" style={{ fontSize: 'calc(13.5px * var(--content-scale))', lineHeight: 1.5 }}>
                <span style={{ color: 'var(--text-muted)' }}>…</span>
              </div>
            )}
          </>
        )}
      </div>
    );
  } else if (card.type === 'shape') {
    const d = card.data as Extract<Card['data'], { kind: 'shape' }>;
    const palette = notePaletteWithMix(theme, { cards: mixCards });
    const c = palette[d.color] ?? palette['classic-blue'];
    const s = { fill: c.bg, stroke: c.border === 'transparent' ? 'rgba(0,0,0,0.25)' : c.border, strokeWidth: 2 };
    inner = (
      <svg width={card.w} height={card.h} style={{ display: 'block' }} onDoubleClick={onDoubleClick}>
        {d.shape === 'circle' ? <circle cx={card.w / 2} cy={card.h / 2} r={Math.min(card.w, card.h) / 2 - 4} {...s} /> : null}
        {d.shape === 'square' ? <rect x={6} y={6} width={card.w - 12} height={card.h - 12} rx={10} {...s} /> : null}
        {d.shape === 'triangle' ? (
          <polygon points={`${card.w / 2},6 ${card.w - 6},${card.h - 6} 6,${card.h - 6}`} {...s} />
        ) : null}
        {d.shape === 'star' ? (
          <polygon
            points={starPoints(card.w / 2, card.h / 2, Math.min(card.w, card.h) / 2 - 6, Math.min(card.w, card.h) / 4 - 2, 5)}
            {...s}
          />
        ) : null}
      </svg>
    );
  } else if (card.type === 'draw') {
    const d = card.data as Extract<Card['data'], { kind: 'draw' }>;
    const strokes = d.strokes?.length
      ? d.strokes
      : [{ width: d.width, style: d.style, color: d.color, points: d.points ?? [] }];
    inner = (
      <svg
        width={card.w}
        height={card.h}
        className="overflow-visible"
        style={{ display: 'block', pointerEvents: 'none' }}
      >
        {strokes.map((stroke, index) => (
          <StrokeShape
            key={index}
            points={stroke.points}
            width={stroke.width || 4}
            style={stroke.style ?? 'ink'}
            color={stroke.color ?? 'var(--text-main)'}
            pressures={stroke.pressures}
            baked={stroke.baked}
          />
        ))}
      </svg>
    );
  } else if (card.type === 'todo') {
    const d = card.data as Extract<Card['data'], { kind: 'todo' }>;
    inner = (
      <div
        className="flex-1 w-full p-[10px] pb-[6px]"
        style={{ background: 'var(--card-bg)', border: `1px solid var(--card-border)`, color: 'var(--text-main)', minHeight: 60, borderRadius: 'var(--radius-card)' }}
      >
        <div className="flex flex-col gap-[6px]">
          {}
          <input
            data-nodrag
            className="w-full border-0 bg-transparent p-0 outline-none"
            style={{
              fontSize: 'calc(13.5px * var(--content-scale))',
              fontWeight: 600,
              lineHeight: 1.4,
              color: 'var(--text-main)',
            }}
            value={d.title ?? ''}
            placeholder="Заголовок списка"
            onFocus={() => pushOnce(card)}
            onChange={(e) =>
              useAppStore.getState().updateCardData(cardId, {
                kind: 'todo',
                title: e.target.value,
                items: d.items,
              })
            }
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') e.currentTarget.blur();
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
          {d.items.map((item, i) => (
            <TodoRow
              key={item.id}
              card={card}
              item={item}
              index={i}
              inputRef={(el) => {
                if (el) todoInputRefs.current.set(item.id, el);
                else todoInputRefs.current.delete(item.id);
              }}
            />
          ))}
          {d.items.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Добавьте первый пункт</div>
          ) : null}
          <button
            data-nodrag
            className="flex items-center gap-1.5 rounded px-1 py-[3px] text-left"
            style={{ color: 'var(--text-muted)', fontSize: 12.5 }}
            onClick={(e) => {
              e.stopPropagation();
              pushOnce(card);
              const id = `td-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
              useAppStore.getState().updateCardData(cardId, {
                kind: 'todo',
                title: d.title ?? '',
                items: [...d.items, { id, text: '', done: false }],
              });
              setTimeout(() => todoInputRefs.current.get(id)?.focus(), 30);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Plus size={13} />
            Добавить пункт
          </button>
        </div>
      </div>
    );
  } else if (card.type === 'image') {
    const d = card.data as Extract<Card['data'], { kind: 'image' }>;
    inner = d.src ? (
      <div className="group/img relative h-full w-full overflow-hidden" style={{ background: 'var(--hover-bg)', borderRadius: 'var(--radius-card)' }}>
        <img src={d.src} alt={d.alt || 'Изображение'} className="h-full w-full object-cover" draggable={false} />
        {hovered || selected ? (
          <div
            data-nodrag
            className="absolute inset-x-1 bottom-1 flex flex-wrap items-center gap-1 rounded-md border border-[var(--panel-border)] p-1"
            style={{ background: 'color-mix(in srgb, var(--panel-bg) 88%, transparent)', backdropFilter: 'blur(4px)' }}
            onPointerDown={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          >
            {IMAGE_FILTERS.map((f) => {
              const active = (d.filter ?? 'original') === f.id;
              return (
                <button
                  key={f.id}
                  className={'rounded px-1.5 py-0.5 text-[10.5px] transition-colors ' + (active ? 'font-semibold' : '')}
                  style={{
                    background: active ? 'var(--accent-soft)' : 'transparent',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    opacity: filterBusy ? 0.5 : 1,
                  }}
                  disabled={filterBusy}
                  onClick={(e) => {
                    e.stopPropagation();
                    applyFilter(f.id);
                  }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    ) : (
      <button
        data-nodrag
        className="flex h-full w-full flex-col items-center justify-center gap-2 border-2 border-dashed text-[13px]"
        style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)', background: 'var(--chip-bg)', borderRadius: 'var(--radius-card)' }}
        onClick={(e) => {
          e.stopPropagation();
          fileRef.current?.click();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <ImagePlus size={22} strokeWidth={1.5} />
        Загрузить изображение
        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>или перетащите файл сюда</span>
      </button>
    );
  } else if (card.type === 'link') {
    const d = card.data as Extract<Card['data'], { kind: 'link' }>;
    if (linkEdit || !d.url) {

      const isEdit = !!d.url;
      inner = (
        <div
          className="flex w-full flex-col gap-1.5 p-[10px]"
          style={{ background: 'var(--card-bg)', border: `1px solid var(--card-border)`, borderRadius: 'var(--radius-card)' }}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
            <Link2 size={13} />
            {isEdit ? 'Изменить ссылку' : 'Новая ссылка'}
          </div>
          <input
            ref={linkUrlRef}
            data-nodrag
            className="min-w-0 rounded border px-2 py-1 outline-none focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--card-border)', fontSize: 12.5, color: 'var(--text-main)', background: 'transparent', width: '100%' }}
            placeholder="https://example.com"
            value={urlDraft}
            onChange={(e) => setUrlDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                saveLink();
              } else if (e.key === 'Escape') {
                cancelLinkEditor();
              }
            }}
          />
          <input
            data-nodrag
            className="min-w-0 rounded border px-2 py-1 outline-none focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--card-border)', fontSize: 12.5, color: 'var(--text-main)', background: 'transparent', width: '100%' }}
            placeholder="Название ссылки"
            value={titleDraft}
            onChange={(e) => setTitleDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter') {
                e.preventDefault();
                saveLink();
              } else if (e.key === 'Escape') {
                cancelLinkEditor();
              }
            }}
          />
          <textarea
            data-nodrag
            className="min-w-0 resize-none rounded border px-2 py-1 outline-none focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--card-border)', fontSize: 12.5, color: 'var(--text-main)', background: 'transparent', width: '100%', height: 44 }}
            placeholder="Краткое описание (необязательно)"
            value={descDraft}
            onChange={(e) => setDescDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') cancelLinkEditor();
            }}
          />
          <div className="flex items-center justify-end gap-1.5">
            {isEdit ? (
              <button
                data-nodrag
                className="rounded border px-2 py-1"
                style={{ borderColor: 'var(--card-border)', color: 'var(--text-secondary)', fontSize: 12, background: 'transparent' }}
                onClick={(e) => {
                  e.stopPropagation();
                  cancelLinkEditor();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                Отмена
              </button>
            ) : null}
            <button
              data-nodrag
              className="rounded px-2.5 py-1 text-white"
              style={{ background: 'var(--accent)', fontSize: 12 }}
              onClick={(e) => {
                e.stopPropagation();
                saveLink();
              }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              Сохранить
            </button>
          </div>
        </div>
      );
    } else {
      let host = d.url;
      try {
        host = new URL(d.url).hostname.replace(/^www\./, '');
      } catch {
        host = d.url.replace(/^https?:\/\//, '');
      }
      inner = (
        <div
          className="flex flex-1 w-full items-start gap-2.5 p-[10px]"
          style={{ background: 'var(--card-bg)', border: `1px solid var(--card-border)`, borderRadius: 'var(--radius-card)' }}
          onDoubleClick={onDoubleClick}
        >
          <div
            className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full"
            style={{ background: 'var(--chip-bg)', color: 'var(--text-secondary)' }}
          >
            <Link2 size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main)' }}>
              {d.title || host}
            </div>
            {d.description ? (
              <div
                className="break-words"
                style={{
                  fontSize: 11.5,
                  lineHeight: 1.4,
                  color: 'var(--text-muted)',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {d.description}
              </div>
            ) : null}
            <div className="truncate" style={{ fontSize: 11, color: 'var(--text-faint)' }}>
              {d.url.replace(/^https?:\/\//, '')}
            </div>
          </div>
          <ArrowUpRight size={14} style={{ color: 'var(--text-muted)', marginTop: 4, flexShrink: 0 }} />
        </div>
      );
    }
  } else if (card.type === 'board') {
    const d = card.data as Extract<Card['data'], { kind: 'board' }>;
    inner = (
      <div
        className="flex h-full w-full flex-col overflow-hidden"
        style={{ background: 'var(--card-bg)', border: `1px solid var(--card-border)`, borderRadius: 'var(--radius-card)' }}
        onDoubleClick={onDoubleClick}
      >
        <div className="min-h-0 flex-1 p-[6px] pb-0">
          <BoardThumb boardId={d.boardId} width={card.w - 12} height={card.h - 44} />
        </div>
        <div className="flex items-center gap-1.5 px-[8px] py-[6px]">
          {}
          <IconChip
            small
            icon={card.icon}
            onClick={() => setPanel(panel === 'icon' ? null : 'icon')}
          />
          <span className="truncate" style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-main)' }}>
            <BoardTitle boardId={d.boardId} />
          </span>
          <ArrowUpRight size={13} style={{ color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }} />
        </div>
      </div>
    );
  } else if (card.type === 'column') {
    const d = card.data as Extract<Card['data'], { kind: 'column' }>;
    inner = <ColumnBody cardId={cardId} boardId={boardId} card={card} d={d} />;
  } else if (card.type === 'catalog') {
    const d = card.data as Extract<Card['data'], { kind: 'catalog' }>;
    inner = <CatalogBody cardId={cardId} card={card} d={d} />;
  } else if (card.type === 'subject' || card.type === 'object') {
    inner = (
      <EntityVisualBody
        cardId={cardId}
        card={card}
        kind={card.type}
        expanded={entExpanded}
        onToggleExpanded={() => {
          setEntExpanded(!entExpanded);
          if (entExpanded) setPanel(null);
        }}
        iconPanelOpen={panel === 'icon'}
        onToggleIcon={() => setPanel(panel === 'icon' ? null : 'icon')}
      />
    );
  } else if (card.type === 'organization') {
    inner = (
      <EntityBody
        cardId={cardId}
        card={card}
        kind="organization"
        iconPanelOpen={panel === 'icon'}
        onToggleIcon={() => setPanel(panel === 'icon' ? null : 'icon')}
      />
    );
  }

  const showMeta = !isDraw;
  const metaVisible = showMeta && showHandles;

  return (
    <div
      ref={rootRef}
      data-card-id={cardId}
      data-column-id={card.type === 'column' ? cardId : undefined}
      className={shellClass}
      style={mergedStyle}
      onPointerDown={onPointerDown}
      onClick={onShellClick}
      onMouseEnter={onCardEnter}
      onMouseLeave={onCardLeave}
      onDoubleClick={card.type === 'column' ? onDoubleClick : undefined}
      onContextMenu={onContextMenu}
      onDragOver={card.type === 'image' ? (e) => e.preventDefault() : undefined}
      onDrop={card.type === 'image' ? onDropFile : undefined}
    >
      {}
      {showMeta && alarmDue ? <div className="deadline-overlay" /> : null}

      {inner}

      {card.type !== 'note' && card.type !== 'shape' && card.color ? (
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0"
          style={{
            height: 8,
            background: stripColor(card, theme, mixCards),
            borderBottomLeftRadius: 'calc(var(--radius-card) - 1px)',
            borderBottomRightRadius: 'calc(var(--radius-card) - 1px)',
          }}
        />
      ) : null}

      {card.tags && card.tags.length ? (
        <div
          className="pointer-events-none absolute inset-0 rounded-[inherit]"
          style={{ background: tagTint(card, theme, mixCards), opacity: 0.22 }}
        />
      ) : null}

      {}
      {showMeta ? <StateBadges card={card} due={alarmDue} /> : null}
      {showMeta && panel === 'alarm' ? (
        <div
          style={{
            position: 'absolute',
            zIndex: 60,
            bottom: 34,
            right: 0,
          }}
        >
          <AlarmPanel
            value={card.alarmAt ?? null}
            onSave={(v) => {
              useAppStore.getState().setCardMeta(cardId, { alarmAt: v });
              setPanel(null);
            }}
            onClose={() => setPanel(null)}
          />
        </div>
      ) : null}

      {}
      {showMeta && panel === 'icon' && card.type === 'board' ? (
        <div style={{ position: 'absolute', top: 4, left: 4, right: 4, zIndex: 60 }}>
          <EmojiPickerPanel
            icon={card.icon}
            onPick={(em) => useAppStore.getState().setCardMeta(cardId, { icon: em })}
            onClear={() => {
              useAppStore.getState().setCardMeta(cardId, { icon: undefined });
              setPanel(null);
            }}
            onClose={() => setPanel(null)}
          />
        </div>
      ) : null}

      {
}
      {!isDraw ? (
        <div
          data-nodrag
          className="mln-drag-handle"
          style={{
            opacity: showHandles && !card.locked ? 1 : 0,
            pointerEvents: showHandles && !card.locked ? 'auto' : 'none',
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.stopPropagation();
            beginDrag(e);
          }}
        >
          <span className="mln-knob">
            <GripHorizontal size={13} strokeWidth={2} />
          </span>
        </div>
      ) : null}

      {
}
      <button
        data-nodrag
        aria-label="Создать связь"
        className="mln-dot mln-dot-left"
        style={{ opacity: showHandles && !isDraw ? 1 : 0, pointerEvents: showHandles && !isDraw ? 'auto' : 'none' }}
        onPointerDown={(e) => startConnect(e, cardId)}
      />
      <button
        data-nodrag
        aria-label="Создать связь"
        className="mln-dot mln-dot-right"
        style={{ opacity: showHandles && !isDraw ? 1 : 0, pointerEvents: showHandles && !isDraw ? 'auto' : 'none' }}
        onPointerDown={(e) => startConnect(e, cardId)}
      />
      <button
        data-nodrag
        aria-label="Создать связь"
        className="mln-dot mln-dot-top"
        style={{ opacity: showHandles && !isDraw ? 1 : 0, pointerEvents: showHandles && !isDraw ? 'auto' : 'none' }}
        onPointerDown={(e) => startConnect(e, cardId)}
      />
      <button
        data-nodrag
        aria-label="Создать связь"
        className="mln-dot mln-dot-bottom"
        style={{ opacity: showHandles && !isDraw ? 1 : 0, pointerEvents: showHandles && !isDraw ? 'auto' : 'none' }}
        onPointerDown={(e) => startConnect(e, cardId)}
      />

      {
}
      {/* Комментарии: бейдж на правом краю + панель справа (как в milanote) */}
      {(card.comments?.length ?? 0) > 0 || commentsOpen ? (
        <button
          data-nodrag
          aria-label="Комментарии"
          className="comment-badge"
          onClick={(e) => {
            e.stopPropagation();
            useAppStore.getState().toggleCommentsOpen(cardId);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <MessageSquare size={12} />
          <span>{card.comments?.length ?? 0}</span>
        </button>
      ) : null}
      {commentsOpen ? (
        <div
          data-nodrag
          className="comments-thread"
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          <div className="ct-list">
            {(card.comments ?? []).length === 0 ? (
              <div className="ct-empty">Комментариев пока нет</div>
            ) : (
              (card.comments ?? []).map((c) => (
                <div key={c.id} className="ct-msg">
                  <div className="ct-meta">
                    <span className="ct-author">Вы</span>
                    <button
                      className="ct-del"
                      aria-label="Удалить комментарий"
                      onClick={(e) => {
                        e.stopPropagation();
                        useAppStore.getState().deleteComment(cardId, c.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <div className="ct-text">{c.text}</div>
                </div>
              ))
            )}
          </div>
          <input
            data-nodrag
            className="ct-input"
            placeholder="Комментарий…"
            value={ctDraft}
            onChange={(e) => setCtDraft(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Enter' && ctDraft.trim()) {
                useAppStore.getState().addComment(cardId, ctDraft.trim());
                setCtDraft('');
              }
              if (e.key === 'Escape') e.currentTarget.blur();
            }}
          />
        </div>
      ) : null}

      {!isDraw ? (
        <div
          data-nodrag
          className="mln-resize"
          style={{
            opacity: showHandles && !card.locked ? 1 : 0,
            pointerEvents: showHandles && !card.locked ? 'auto' : 'none',
          }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (card.locked) return;
            startResize(e, cardId, card, autoH, autoH ? contentHeightOf(rootRef.current) : card.h);
          }}
        >
          <MoveDiagonal size={10} strokeWidth={2.2} />
        </div>
      ) : null}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) readImage(f);
          e.target.value = '';
        }}
      />
    </div>
  );
}

function BoardTitle({ boardId }: { boardId: string }) {
  const title = useAppStore((s) => s.boards[boardId]?.title);
  return <>{title || 'Без названия'}</>;
}

function ColumnBody({
  cardId,
  boardId,
  card,
  d,
}: {
  cardId: string;
  boardId: string;
  card: Card;
  d: Extract<Card['data'], { kind: 'column' }>;
}) {
  const board = useAppStore((s) => s.boards[boardId]);
  const dropPreview = useAppStore((s) => s.dropPreview);
  const editing = useAppStore((s) => s.editingId === cardId);
  const titleRef = useRef<HTMLInputElement>(null);
  const isDropTarget = dropPreview?.columnId === cardId;

  const children = d.cardIds
    .map((cid) => board?.cards.find((c) => c.id === cid))
    .filter((c): c is Card => !!c);

  return (
    <div
      className="flex-1 w-full p-[8px]"
      style={{
        background: isDropTarget ? 'var(--accent-soft)' : 'var(--chip-bg)',
        border: `1px ${isDropTarget ? 'dashed var(--accent)' : 'solid var(--card-border)'}`,
        borderRadius: 'var(--radius-card)',
      }}
    >
      <div className="mb-1.5 px-1">
        {editing ? (
          <input
            data-nodrag
            ref={titleRef}
            autoFocus
            className="w-full border-b outline-none"
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', borderColor: 'var(--accent)', background: 'transparent' }}
            value={d.title}
            placeholder="Название колонки"
            onFocus={() => pushOnce(card)}
            onChange={(e) => useAppStore.getState().updateCardData(cardId, { kind: 'column', title: e.target.value, cardIds: d.cardIds })}
            onBlur={blurEndEditing}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape' || e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        ) : (
          <div
            className="truncate"
            style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              useAppStore.getState().setEditing(cardId);
            }}
          >
            {d.title || <span style={{ color: 'var(--text-muted)' }}>Колонка</span>}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-[8px]">
        {children.map((child, i) => (
          <div key={child.id} data-child-id={child.id}>
            {isDropTarget && dropPreview?.index === i ? <InsertLine /> : null}
            <CardView cardId={child.id} boardId={boardId} />
          </div>
        ))}
        {isDropTarget && (dropPreview?.index ?? 0) >= children.length ? <InsertLine /> : null}
        {children.length === 0 && !isDropTarget ? (
          <div
            className="flex h-[64px] items-center justify-center rounded-[4px] border border-dashed"
            style={{ borderColor: 'var(--panel-border)', color: 'var(--text-muted)', fontSize: 12 }}
          >
            Перетащите карточку сюда
          </div>
        ) : null}
      </div>
    </div>
  );
}

function InsertLine() {
  return <div className="my-[-2px] h-[3px] w-full rounded-full" style={{ background: 'var(--accent)' }} />;
}

/** Активное перетаскивание ссылки между каталогами / в блок «Ссылка» */
interface LinkDragSession {
  link: CatalogLink;
  fromCardId: string;
  ghost: HTMLElement;
  line: HTMLElement;
  startX: number;
  startY: number;
  moved: boolean;
}

let linkDrag: LinkDragSession | null = null;

/** Убрать полосу-индикатор вставки из списка, где она сейчас стоит */
function detachLinkLine(line: HTMLElement) {
  line.parentElement?.removeChild(line);
}

/** Найти список каталога под точкой: строка или тело каталога */
function linkDropListAt(x: number, y: number): { list: HTMLElement; cardId: string; row: HTMLElement | null } | null {
  const els = document.elementsFromPoint(x, y);
  for (const el of els) {
    const rowEl = el.closest('[data-catalog-row]') as HTMLElement | null;
    if (rowEl) {
      const list = rowEl.closest('[data-catalog-list]') as HTMLElement | null;
      if (list?.dataset.catalogList) return { list, cardId: list.dataset.catalogList, row: rowEl };
    }
    const bodyEl = el.closest('[data-catalog-body]') as HTMLElement | null;
    if (bodyEl?.dataset.catalogBody) {
      const list = bodyEl.querySelector('[data-catalog-list]') as HTMLElement | null;
      if (list) return { list, cardId: bodyEl.dataset.catalogBody, row: null };
    }
  }
  return null;
}

/** Вставить ссылку в каталог-цель на позицию index (с удалением из источника) */
function moveCatalogLink(link: CatalogLink, fromCardId: string, toCardId: string, index: number) {
  const st = useAppStore.getState();
  const board = Object.values(st.boards).find((b) => b.cards.some((c) => c.id === fromCardId));
  if (!board) return;
  const srcCard = board.cards.find((c) => c.id === fromCardId);
  const dstCard = board.cards.find((c) => c.id === toCardId);
  if (!srcCard || !dstCard || srcCard.data.kind !== 'catalog' || dstCard.data.kind !== 'catalog') return;

  const srcLinks = srcCard.data.links.filter((l) => l.id !== link.id);
  if (fromCardId === toCardId) {
    // Перестановка внутри одного каталога: индекс после удаления корректируется сам
    const i = Math.max(0, Math.min(index, srcLinks.length));
    srcLinks.splice(i, 0, link);
    st.updateCardData(fromCardId, { kind: 'catalog', category: srcCard.data.category, title: srcCard.data.title, links: srcLinks });
    return;
  }
  const dstLinks = dstCard.data.links.slice();
  const i = Math.max(0, Math.min(index, dstLinks.length));
  dstLinks.splice(i, 0, link);
  st.updateCardData(fromCardId, { kind: 'catalog', category: srcCard.data.category, title: srcCard.data.title, links: srcLinks });
  st.updateCardData(toCardId, { kind: 'catalog', category: dstCard.data.category, title: dstCard.data.title, links: dstLinks });
}

/**
 * Перетаскивание ссылки за «рукоятку»: менять местами внутри списка,
 * переносить между каталогами, выносить наружу — превращать в блок «Ссылка».
 */
function startCatalogLinkDrag(e: React.PointerEvent, link: CatalogLink, fromCardId: string) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();

  const ghost = document.createElement('div');
  ghost.textContent = link.title || (link.url ? link.url.replace(/^https?:\/\//, '') : 'Ссылка');
  Object.assign(ghost.style, {
    position: 'fixed',
    zIndex: '10000',
    maxWidth: '260px',
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: '500',
    color: 'var(--text-main)',
    background: 'var(--card-bg)',
    border: '1px solid var(--accent)',
    borderRadius: '8px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
    pointerEvents: 'none',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    left: `${e.clientX + 14}px`,
    top: `${e.clientY + 10}px`,
  } as Partial<CSSStyleDeclaration>);
  document.body.append(ghost);

  const line = document.createElement('div');
  line.style.height = '3px';
  line.style.width = '100%';
  line.style.borderRadius = '2px';
  line.style.background = 'var(--accent)';
  line.style.margin = '1px 0';

  const s: LinkDragSession = { link, fromCardId, ghost, line, startX: e.clientX, startY: e.clientY, moved: false };
  linkDrag = s;

  const move = (ev: PointerEvent) => {
    ghost.style.left = `${ev.clientX + 14}px`;
    ghost.style.top = `${ev.clientY + 10}px`;
    if (!s.moved) {
      if (Math.hypot(ev.clientX - s.startX, ev.clientY - s.startY) < 4) return;
      s.moved = true;
      useAppStore.getState().pushHistory();
    }
    const target = linkDropListAt(ev.clientX, ev.clientY);
    if (target && line.parentElement !== target.list) {
      detachLinkLine(line);
      target.list.append(line);
    } else if (!target) {
      detachLinkLine(line);
    }
    if (target?.row) {
      target.list.insertBefore(line, target.row);
    } else if (target) {
      target.list.append(line);
    }
  };

  const up = (ev: PointerEvent) => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    detachLinkLine(line);
    ghost.remove();
    linkDrag = null;
    if (!s.moved) return;

    const st = useAppStore.getState();
    const target = linkDropListAt(ev.clientX, ev.clientY);
    if (target) {
      // Индекс = число строк списка до места вставки, без собственной строки источника
      const srcRow = target.list.querySelector(`[data-catalog-row][data-row-id="${s.link.id}"]`);
      let index = 0;
      for (const child of Array.from(target.list.children)) {
        if (child === line) break;
        if (!(child instanceof HTMLElement) || !child.dataset.rowId) continue;
        if (child === srcRow) continue;
        index++;
      }
      moveCatalogLink(s.link, s.fromCardId, target.cardId, index);
      return;
    }
    // Вынос наружу: над пустым листом — превращаем в блок «Ссылка»
    const overAnyCatalog = !!document.elementsFromPoint(ev.clientX, ev.clientY).find((el) => (el as Element).closest?.('[data-catalog-body]'));
    if (!overAnyCatalog) {
      const w = clientToWorld(ev.clientX, ev.clientY);
      if (w) {
        const id = st.addCard('link', w.x - 130, w.y - 40);
        if (id) {
          st.setSelection([id]);
          st.updateCardData(id, {
            kind: 'link',
            url: s.link.url,
            title: s.link.title || (s.link.url ? (() => { try { return new URL(s.link.url).hostname.replace(/^www\./, ''); } catch { return s.link.url; } })() : 'Ссылка'),
            description: s.link.task ?? '',
          });
        }
      }
    }
  };

  const cancel = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', up);
    window.removeEventListener('pointercancel', cancel);
    detachLinkLine(line);
    ghost.remove();
    linkDrag = null;
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up);
  window.addEventListener('pointercancel', cancel);
}

/** Сравнение названий: сначала русский алфавит, потом латиница */
const azCollator = new Intl.Collator('ru');
function isCyrillicStart(s: string): boolean {
  return /[а-яё]/i.test(s.trim()[0] ?? '');
}
function azCompare(a: CatalogLink, b: CatalogLink, hostOf: (url: string) => string): number {
  const ta = (a.title || hostOf(a.url) || '').toLowerCase();
  const tb = (b.title || hostOf(b.url) || '').toLowerCase();
  const ra = isCyrillicStart(ta);
  const rb = isCyrillicStart(tb);
  if (ra !== rb) return ra ? -1 : 1;
  return azCollator.compare(ta, tb);
}

function CatalogBody({
  cardId,
  card,
  d,
}: {
  cardId: string;
  card: Card;
  d: Extract<Card['data'], { kind: 'catalog' }>;
}) {
  const [editLinkId, setEditLinkId] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState('');
  const [titleDraft, setTitleDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [sortAZ, setSortAZ] = useState(false);
  const urlRef = useRef<HTMLInputElement>(null);

  const patch = (
    p: Partial<{ category: CatalogCategory; title: string; links: CatalogLink[] }>,
    push = false
  ) => {
    if (push) pushOnce(card);
    useAppStore.getState().updateCardData(cardId, {
      kind: 'catalog',
      category: p.category ?? d.category,
      title: p.title ?? d.title,
      links: p.links ?? d.links,
    });
  };

  const hostOf = (url: string) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url.replace(/^https?:\/\//, '');
    }
  };

  const openLinkEditor = (link: CatalogLink) => {
    setEditLinkId(link.id);
    setUrlDraft(link.url);
    setTitleDraft(link.title);
    setTaskDraft(link.task ?? '');
    setTimeout(() => urlRef.current?.focus(), 0);
  };

  const addLink = () => {
    const link: CatalogLink = { id: uid(), url: '', title: '' };
    patch({ links: [...d.links, link] }, true);
    setEditLinkId(link.id);
    setUrlDraft('');
    setTitleDraft('');
    setTaskDraft('');
    setTimeout(() => urlRef.current?.focus(), 0);
  };

  const saveLink = () => {
    let url = urlDraft.trim();
    const title = titleDraft.trim();
    const task = taskDraft.trim();
    if (!url) {

      patch({ links: d.links.filter((l) => l.id !== editLinkId) }, true);
      setEditLinkId(null);
      return;
    }
    if (!/^https?:\/\//.test(url)) url = 'https://' + url;
    const host = hostOf(url);
    patch(
      { links: d.links.map((l) => (l.id === editLinkId ? { ...l, url, title: title || host, task } : l)) },
      true
    );
    setEditLinkId(null);
  };

  const removeLink = (id: string) => {
    patch({ links: d.links.filter((l) => l.id !== id) }, true);
    if (editLinkId === id) setEditLinkId(null);
  };

  return (
    <div
      data-catalog-body={cardId}
      className="flex w-full flex-1 flex-col p-[10px]"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        color: 'var(--text-main)',
        borderRadius: 'var(--radius-card)',
        minHeight: 60,
      }}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {}
      <div className="flex flex-wrap items-center gap-1">
        {(Object.keys(CATALOG_CATEGORIES) as CatalogCategory[]).map((cat) => {
          const active = d.category === cat;
          return (
            <button
              key={cat}
              data-nodrag
              className="rounded-full px-2 py-[2px] transition-colors"
              style={{
                fontSize: 10.5,
                lineHeight: 1.4,
                fontWeight: active ? 600 : 400,
                background: active ? 'var(--accent-soft)' : 'var(--chip-bg)',
                color: active ? 'var(--accent-strong)' : 'var(--text-muted)',
                border: `1px solid ${active ? 'transparent' : 'var(--chip-border)'}`,
              }}
              onClick={(e) => {
                e.stopPropagation();
                patch({ category: cat }, true);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
            >
              {CATALOG_CATEGORIES[cat]}
            </button>
          );
        })}
        <button
          data-nodrag
          aria-label="Расположить по алфавиту"
          title="По алфавиту: сначала русский, потом латиница"
          className="ml-auto rounded-full px-2 py-[2px] transition-colors"
          style={{
            fontSize: 10.5,
            lineHeight: 1.4,
            fontWeight: sortAZ ? 600 : 400,
            background: sortAZ ? 'var(--accent-soft)' : 'var(--chip-bg)',
            color: sortAZ ? 'var(--accent-strong)' : 'var(--text-muted)',
            border: `1px solid ${sortAZ ? 'transparent' : 'var(--chip-border)'}`,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setSortAZ((v) => !v);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
        >
          А-Я
        </button>
      </div>

      {}
      <input
        data-nodrag
        className="mt-1.5 w-full border-0 bg-transparent p-0 outline-none"
        style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.35, color: 'var(--text-main)' }}
        value={d.title}
        placeholder=""
        onFocus={() => pushOnce(card)}
        onChange={(e) => patch({ title: e.target.value })}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') e.currentTarget.blur();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      />

      <div className="mt-1.5 mb-1 h-px w-full" style={{ background: 'var(--card-border)' }} />

      {}
      <div className="flex flex-col gap-[2px]" data-catalog-list={cardId}>
        {(sortAZ ? [...d.links].sort((a, b) => azCompare(a, b, hostOf)) : d.links).map((link) =>
          editLinkId === link.id ? (
            <div key={link.id} className="flex flex-col gap-1 rounded px-1 py-1" style={{ background: 'var(--chip-bg)' }}>
              <input
                ref={urlRef}
                data-nodrag
                className="w-full rounded border px-2 py-1 outline-none focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--card-border)', fontSize: 12, color: 'var(--text-main)', background: 'transparent' }}
                placeholder="https://example.com"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveLink();
                  } else if (e.key === 'Escape') {
                    setEditLinkId(null);
                  }
                }}
              />
              <input
                data-nodrag
                className="w-full rounded border px-2 py-1 outline-none focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--card-border)', fontSize: 12, color: 'var(--text-main)', background: 'transparent' }}
                placeholder="Название ссылки"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveLink();
                  } else if (e.key === 'Escape') {
                    setEditLinkId(null);
                  }
                }}
              />
              <input
                data-nodrag
                className="w-full rounded border px-2 py-1 outline-none focus:border-[var(--accent)]"
                style={{ borderColor: 'var(--card-border)', fontSize: 12, color: 'var(--text-main)', background: 'transparent' }}
                placeholder="Задача — зачем ссылка, что с ней делать"
                value={taskDraft}
                onChange={(e) => setTaskDraft(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    saveLink();
                  } else if (e.key === 'Escape') {
                    setEditLinkId(null);
                  }
                }}
              />
              <div className="flex items-center justify-end gap-1.5">
                <button
                  data-nodrag
                  className="rounded px-2 py-[3px]"
                  style={{ fontSize: 11.5, color: 'var(--text-secondary)', border: '1px solid var(--card-border)', background: 'transparent' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditLinkId(null);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Отмена
                </button>
                <button
                  data-nodrag
                  className="rounded px-2.5 py-[3px] text-white"
                  style={{ fontSize: 11.5, background: 'var(--accent)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    saveLink();
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  Сохранить
                </button>
              </div>
            </div>
          ) : (
            <div key={link.id} className="group/link flex items-start gap-2 rounded px-1 py-[3px] hover:bg-[var(--hover-bg)]" data-catalog-row data-row-id={link.id}>
              <span
                data-nodrag
                aria-label="Перетащить ссылку"
                title="Перетащить: поменять порядок, перенести в другой каталог или вынести как блок «Ссылка»"
                className="mt-[1px] flex h-[18px] w-[12px] shrink-0 cursor-grab items-center justify-center opacity-40 transition-opacity group-hover/link:opacity-100"
                onPointerDown={(e) => startCatalogLinkDrag(e, link, cardId)}
                onClick={(e) => e.stopPropagation()}
                onDoubleClick={(e) => e.stopPropagation()}
              >
                <GripHorizontal size={12} style={{ color: 'var(--text-muted)' }} />
              </span>
              <Link2 size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
              <div className="min-w-0 flex-1">
                <div
                  className="whitespace-pre-wrap break-words"
                  style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--text-main)', lineHeight: 1.35 }}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (link.url) openLinkAfterConfirm(link.url);
                  }}
                >
                  {link.title || (link.url ? hostOf(link.url) : 'Без названия')}
                </div>
                {link.url ? (
                  <div
                    className="break-all"
                    style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.35 }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      openLinkAfterConfirm(link.url);
                    }}
                  >
                    {link.url.replace(/^https?:\/\//, '')}
                  </div>
                ) : null}
                {link.task ? (
                  <div className="break-words" style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35 }}>
                    {link.task}
                  </div>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/link:opacity-100">
                <button
                  data-nodrag
                  aria-label="Изменить ссылку"
                  className="flex h-[18px] w-[18px] items-center justify-center rounded"
                  style={{ color: 'var(--text-muted)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openLinkEditor(link);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <Pencil size={11} />
                </button>
                <button
                  data-nodrag
                  aria-label="Удалить ссылку"
                  className="flex h-[18px] w-[18px] items-center justify-center rounded"
                  style={{ color: 'var(--danger, #D25454)' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeLink(link.id);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                  <X size={12} />
                </button>
              </div>
            </div>
          )
        )}
        {d.links.length === 0 && !editLinkId ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '2px 4px' }}>
            Добавьте первую ссылку
          </div>
        ) : null}
        <button
          data-nodrag
          className="mt-0.5 flex items-center gap-1.5 rounded px-1 py-[3px] text-left"
          style={{ color: 'var(--text-muted)', fontSize: 12 }}
          onClick={(e) => {
            e.stopPropagation();
            addLink();
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Plus size={12} />
          Добавить ссылку
        </button>
      </div>
    </div>
  );
}

export const CardView = memo(CardViewInner);
