

'use client';

import { create } from 'zustand';
import type {
  Board,
  Card,
  CardData,
  CardMetaPatch,
  CardStatus,
  CalendarTask,
  CardType,
  Connection,
  ConnectionArrow,
  DrawStroke,
  Viewport,
} from './types';
import { cardDefaultSize, measuredSizes, DRAW_WIDTH } from './types';
import type { DrawStyle } from './types';

const ARROW_ORDER: ConnectionArrow[] = ['end', 'start', 'both', 'none'];

function nextArrow(a?: ConnectionArrow): ConnectionArrow {
  const i = ARROW_ORDER.indexOf(a ?? 'end');
  return ARROW_ORDER[(i + 1) % ARROW_ORDER.length];
}

import { uid } from './id';
import { ENTITY_ICON_NAMES } from './icons';
import { createSeed } from './demo';
import { isThemeId, THEME_BOOT_MS } from './theme';
import type { ThemeId } from './theme';
import { toast } from '@/hooks/use-toast';
import { hostAvailable, hostCall } from './host';
import { runViewTransition } from './viewTransition';
import type { ViewTransitionKind } from './viewTransition';

export type { ThemeId };

const STORAGE_KEY = 'klaster-app-v3';

let quotaWarned = false;

export type FontId =
  | 'golos'
  | 'inter'
  | 'jbmono'
  | 'plex'
  | 'piazzolla'
  | 'spectral'
  | 'literata'
  | 'pattaya'
  | 'vibes'
  | 'caveat'
  | 'shantell';

export const DEFAULT_FONT: FontId = 'jbmono';
export const DEFAULT_THEME: ThemeId = 'stylish';

/** Кегль текста в блоках: множитель к базовому размеру (1 = обычный). */
export const DEFAULT_CONTENT_SCALE = 1;
export const CONTENT_SCALE_MIN = 0.85;
export const CONTENT_SCALE_MAX = 1.6;

export function clampContentScale(v: number): number {
  if (!Number.isFinite(v)) return DEFAULT_CONTENT_SCALE;
  return Math.min(CONTENT_SCALE_MAX, Math.max(CONTENT_SCALE_MIN, v));
}

let themeBootTimer: ReturnType<typeof setTimeout> | null = null;

function applyFontToDom(font: FontId) {
  if (typeof document !== 'undefined') document.documentElement.dataset.font = font;
}

function applyContentScaleToDom(scale: number) {
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--content-scale', String(scale));
  }
}

function applyThemeToDom(theme: ThemeId) {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = theme;
}

function applyPlainBgToDom(plain: boolean) {
  if (typeof document !== 'undefined') document.documentElement.dataset.plainBg = plain ? 'true' : 'false';
}

interface HistorySnapshot {
  boards: Record<string, Board>;
}

export type ContextMenuKind = 'card' | 'canvas' | 'connection' | 'board-card';

export interface ContextMenuState {
  x: number;
  y: number;

  wx?: number;
  wy?: number;
  kind: ContextMenuKind;
  cardId?: string;
  connectionId?: string;
}

export interface DropPreview {
  columnId?: string;
  cardId?: string;
  index?: number;
}

export interface DrawTool {
  width: number;
  style: DrawStyle;
  color: string | null;
}

interface AppState {
  loaded: boolean;
  boards: Record<string, Board>;
  view: 'home' | 'board';
  breadcrumb: string[];
  viewports: Record<string, Viewport>;

  selection: string[];
  editingId: string | null;
  clipboard: Card[] | null;
  lastPastePos: { x: number; y: number } | null;

  dragNewType: CardType | null;
  dragging: boolean;
  dropPreview: DropPreview | null;
  connecting: { from: string; x: number; y: number } | null;
  extractGhost: { cardId: string; screenX: number; screenY: number } | null;
  contextMenu: ContextMenuState | null;
  drawMode: boolean;
  drawCancelled: boolean;
  drawTool: DrawTool;

  searchOpen: boolean;
  shortcutsOpen: boolean;
  exportOpen: boolean;

  /** фильтр подсветки по состоянию блока */
  statusFilter: CardStatus | null;
  /** фильтр подсветки по тегу (с поддержкой вложенных #a/b) */
  tagFilter: string | null;
  /** блоки с раскрытыми комментариями */
  commentsOpenIds: string[];
  /** блок с открытой панелью бэклинков (legacy) */
  backlinksOpen: string | null;
  /** нижняя инфо-панель (справа снизу, напротив масштаба) */
  bottomPanel: { kind: 'tag' | 'backlinks'; tag?: string; cardId?: string; boardId?: string } | null;
  /** календарные задачи */
  calendarTasks: CalendarTask[];

  font: FontId;
  theme: ThemeId;
  /** однотонный фон вместо паттерна темы */
  plainBg: boolean;
  /** кегль текста в блоках (множитель к базовому размеру) */
  contentScale: number;

  themeBoot: boolean;

  layoutTick: number;
  past: HistorySnapshot[];
  future: HistorySnapshot[];

  load: () => void;
  persist: () => void;
  setFont: (font: FontId) => void;
  setTheme: (theme: ThemeId) => void;
  togglePlainBg: () => void;
  setContentScale: (scale: number) => void;

  setView: (view: 'home' | 'board') => void;
  openBoardRoot: (boardId: string) => void;
  openSubBoard: (boardId: string) => void;
  navigateTo: (depth: number) => void;
  setViewport: (boardId: string, vp: Viewport) => void;
  getViewport: (boardId: string) => Viewport;

  pushHistory: () => void;
  undo: () => void;
  redo: () => void;
  bumpLayout: () => void;

  createBoard: (title: string) => string;
  deleteBoardTree: (boardId: string) => void;
  duplicateBoardTree: (boardId: string) => string;
  renameBoard: (boardId: string, title: string) => void;
  importBoards: (json: unknown) => boolean;

  addCard: (type: CardType, x: number, y: number) => string | null;
  addDrawObject: (
    boardId: string,
    x: number,
    y: number,
    w: number,
    h: number,
    data: Extract<CardData, { kind: 'draw' }>
  ) => string | null;
  updateCardData: (cardId: string, data: CardData) => void;

  setCardMeta: (cardId: string, patch: CardMetaPatch) => void;
  moveCards: (ids: string[], dx: number, dy: number) => void;
  resizeCard: (cardId: string, w: number, h: number) => void;
  setCardSize: (cardId: string, w: number, h: number) => void;
  deleteCards: (ids: string[]) => void;
  bringToFront: (cardId: string) => void;
  sendToBack: (cardId: string) => void;
  duplicateCards: (ids: string[]) => void;
  mergeStrokes: (ids: string[]) => void;

  setSelection: (ids: string[]) => void;
  toggleSelection: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setEditing: (id: string | null) => void;

  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: (x: number, y: number) => void;

  mergeIntoColumn: (draggedIds: string[], targetCardId: string) => void;
  moveCardToColumn: (cardId: string, columnId: string, index: number) => void;
  reorderInColumn: (cardId: string, columnId: string, index: number) => void;
  extractFromColumn: (cardId: string, x: number, y: number) => void;
  unstackColumn: (columnId: string) => void;

  addConnection: (from: string, to: string) => void;
  deleteConnection: (connectionId: string) => void;
  cycleConnectionArrow: (connectionId: string) => void;
  setConnectionArrow: (connectionId: string, arrow: ConnectionArrow) => void;
  setBoardTag: (ids: string[], label: string | null) => void;
  setConnecting: (connecting: { from: string; x: number; y: number } | null) => void;

  setDragNewType: (t: CardType | null) => void;
  setDragging: (dragging: boolean) => void;
  setDropPreview: (p: DropPreview | null) => void;
  setExtractGhost: (g: { cardId: string; screenX: number; screenY: number } | null) => void;
  openContextMenu: (m: ContextMenuState | null) => void;
  setDrawMode: (on: boolean) => void;
  cancelDrawMode: () => void;
  setDrawTool: (patch: Partial<DrawTool>) => void;
  setSearchOpen: (open: boolean) => void;
  setStatusFilter: (f: CardStatus | null) => void;
  setTagFilter: (t: string | null) => void;
  toggleCommentsOpen: (cardId: string) => void;
  closeComments: () => void;
  setBacklinksOpen: (cardId: string | null) => void;
  setBottomPanel: (p: { kind: 'tag' | 'backlinks'; tag?: string; cardId?: string; boardId?: string } | null) => void;
  addComment: (cardId: string, text: string) => void;
  deleteComment: (cardId: string, commentId: string) => void;
  addCalendarTask: (text: string, repeat: CalendarTask['repeat']) => string;
  toggleCalendarTaskDone: (taskId: string, dateKey: string) => void;
  deleteCalendarTask: (taskId: string) => void;
  setShortcutsOpen: (open: boolean) => void;
  setExportOpen: (open: boolean) => void;

  _mutBoard: (boardId: string, fn: (b: Board) => void, touch?: boolean) => void;
}

type PersistShape = {
  boards: Record<string, Board>;
  view: 'home' | 'board';
  breadcrumb: string[];
  viewports: Record<string, Viewport>;
  font?: FontId;
  theme?: ThemeId;
  plainBg?: boolean;
  contentScale?: number;
  drawTool?: DrawTool;
  calendarTasks?: CalendarTask[];
};

function saveToStorage(s: AppState) {
  try {
    const payload: PersistShape = {
      boards: s.boards,
      view: s.view,
      breadcrumb: s.breadcrumb,
      viewports: s.viewports,
      font: s.font,
      theme: s.theme,
      plainBg: s.plainBg,
      contentScale: s.contentScale,
      drawTool: s.drawTool,
      calendarTasks: s.calendarTasks,
    };
    const json = JSON.stringify(payload);
    if (hostAvailable()) {
      // Обёртка шифрует и пишет в папку приложения — квот нет
      void hostCall('save', json).catch(() => {});
      return;
    }
    localStorage.setItem(STORAGE_KEY, json);
  } catch {

    if (!quotaWarned) {
      quotaWarned = true;
      toast({
        title: 'Изменения не сохраняются',
        description:
          'Локальное хранилище браузера переполнено — обычно из-за изображений. Выгрузите листы в JSON и удалите крупные картинки.',
      });
    }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleSave(get: () => AppState) {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveToStorage(get()), 350);
}

/**
 * Тип анимации перехода между экранами: единая Bokeh Dissolve для всех переходов и тем.
 */
function viewTransitionKind(): ViewTransitionKind {
  return 'bokeh';
}

function clone<T>(v: T): T {
  return typeof structuredClone === 'function' ? structuredClone(v) : (JSON.parse(JSON.stringify(v)) as T);
}

function isCardData(v: unknown): v is CardData {
  return !!v && typeof v === 'object' && 'kind' in (v as Record<string, unknown>);
}

function sanitizeTool(v: unknown): DrawTool {
  const t = (v ?? {}) as Partial<DrawTool>;
  const width = typeof t.width === 'number' && t.width > 0 && t.width <= 40 ? t.width : DRAW_WIDTH;
  const style: DrawStyle =
    t.style === 'pen' || t.style === 'brush' || t.style === 'edge' || t.style === 'marker' ? t.style : 'pen';
  const color = typeof t.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(t.color) ? t.color : null;
  return { width, style, color };
}

function cloneTree(
  boards: Record<string, Board>,
  rootId: string,
  idMap: Map<string, string> = new Map()
): { clones: Board[]; rootCloneId: string } {
  const src = boards[rootId];
  if (!src) return { clones: [], rootCloneId: '' };
  const newId = uid();
  idMap.set(rootId, newId);
  const cardIdMap = new Map<string, string>();
  for (const c of src.cards) cardIdMap.set(c.id, uid());

  const cloned: Board = {
    ...clone(src),
    id: newId,
    cards: src.cards.map((c) => {
      const copy = clone(c);
      copy.id = cardIdMap.get(c.id)!;
      if (copy.data.kind === 'column') {
        copy.data = {
          ...copy.data,
          cardIds: copy.data.cardIds.map((cid) => cardIdMap.get(cid) ?? cid),
        };
      }
      if (copy.data.kind === 'board' && boards[copy.data.boardId]) {
        copy.data = { ...copy.data, boardId: copy.data.boardId + '__pending' };
      }
      return copy;
    }),
    connections: src.connections.map((cn) => ({
      id: uid(),
      from: cardIdMap.get(cn.from) ?? cn.from,
      to: cardIdMap.get(cn.to) ?? cn.to,
    })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const clones: Board[] = [cloned];

  for (const c of src.cards) {
    if (c.data.kind === 'board' && boards[c.data.boardId]) {
      const sub = cloneTree(boards, c.data.boardId, idMap);
      clones.push(...sub.clones);
      const pendingCard = cloned.cards.find((cc) => cc.data.kind === 'board' && cc.data.boardId === c.data.boardId + '__pending');
      if (pendingCard && pendingCard.data.kind === 'board') {
        pendingCard.data = { ...pendingCard.data, boardId: idMap.get(c.data.boardId)! };
      }
    }
  }
  return { clones, rootCloneId: newId };
}

function collectDescendants(boards: Record<string, Board>, rootId: string, acc: string[] = []): string[] {
  acc.push(rootId);
  const b = boards[rootId];
  if (!b) return acc;
  for (const c of b.cards) {
    if (c.data.kind === 'board' && boards[c.data.boardId] && !acc.includes(c.data.boardId)) {
      collectDescendants(boards, c.data.boardId, acc);
    }
  }
  return acc;
}

export function findCardInBoards(boards: Record<string, Board>, cardId: string): { boardId: string; card: Card } | null {
  for (const b of Object.values(boards)) {
    const card = b.cards.find((c) => c.id === cardId);
    if (card) return { boardId: b.id, card };
  }
  return null;
}

export function buildBreadcrumbPath(boards: Record<string, Board>, targetId: string): string[] {

  const parentOf = new Map<string, string>();
  for (const b of Object.values(boards)) {
    for (const c of b.cards) {
      if (c.data.kind === 'board' && boards[c.data.boardId]) {
        parentOf.set(c.data.boardId, b.id);
      }
    }
  }
  const chain: string[] = [targetId];
  let cur = targetId;
  while (parentOf.has(cur)) {
    const p = parentOf.get(cur)!;
    chain.unshift(p);
    cur = p;
  }
  return chain;
}

function makeCard(type: CardType, x: number, y: number, subBoardId?: string, tool?: DrawTool): Card {
  const def = cardDefaultSize(type);
  let data: CardData;
  switch (type) {
    case 'note': data = { kind: 'note', text: '', color: 'notebook' }; break;
    case 'text': data = { kind: 'text', text: '' }; break;
    case 'todo': data = { kind: 'todo', title: '', items: [] }; break;
    case 'image': data = { kind: 'image', src: '', alt: '' }; break;
    case 'link': data = { kind: 'link', url: '', title: '', description: '' }; break;
    case 'board': data = { kind: 'board', boardId: subBoardId ?? '' }; break;
    case 'column': data = { kind: 'column', title: '', cardIds: [] }; break;
    case 'draw':
      data = {
        kind: 'draw',
        width: tool?.width ?? DRAW_WIDTH,
        style: tool?.style ?? 'pen',
        color: tool?.color ?? null,
        points: [],
      };
      break;
    case 'catalog':
      data = { kind: 'catalog', category: 'theme', title: '', links: [] };
      break;
    case 'subject':
      data = { kind: 'subject', name: '', role: '', contacts: '', about: '', photo: '' };
      break;
    case 'organization':
      data = { kind: 'organization', name: '', orgType: '', sphere: '', contacts: '', address: '' };
      break;
    case 'object':
      data = { kind: 'object', name: '', objType: '', status: '', about: '', photo: '' };
      break;
    case 'shape':
      data = { kind: 'shape', shape: 'circle', color: 'classic-blue' };
      break;
  }
  return { id: uid(), type, x, y, w: def.w, h: def.h, data };
}

const DEFAULT_VP: Viewport = { x: 0, y: 0, zoom: 1 };

const COLOR_MIGRATION: Record<string, string> = {
  yellow: 'yellow',
  green: 'greenery',
  blue: 'classic-blue',
  pink: 'magenta',
  orange: 'coral',
  purple: 'peri',
  gray: 'gray',
};

function migrateEntityCards(boards: Record<string, Board>): void {
  for (const b of Object.values(boards)) {
    for (const c of b.cards) {
      if (c.type !== 'subject' && c.type !== 'object' && c.type !== 'organization') continue;
      const d = c.data as { kind: string; photo?: string };
      if (d.photo === undefined) d.photo = '';
      if (c.icon && !ENTITY_ICON_NAMES.has(c.icon)) c.icon = undefined;
    }
    for (const c of b.cards) {
      if (c.color) c.color = (COLOR_MIGRATION[c.color] ?? c.color) as Card['color'];
      if (c.tags) c.tags = c.tags.map((t) => (COLOR_MIGRATION[t] ?? t));
      if (c.type === 'note' && c.data.kind === 'note') {
        c.data.color = (COLOR_MIGRATION[c.data.color] ?? c.data.color) as typeof c.data.color;
      }
      if (c.type === 'shape' && c.data.kind === 'shape') {
        c.data.color = (COLOR_MIGRATION[c.data.color] ?? c.data.color) as typeof c.data.color;
      }
    }
  }
}

export const useAppStore = create<AppState>()((set, get) => {
  const mutBoard: AppState['_mutBoard'] = (boardId, fn, touch = true) => {
    set((s) => {
      const b = s.boards[boardId];
      if (!b) return s;
      const copy = clone(b);
      fn(copy);
      if (touch) copy.updatedAt = Date.now();
      return { boards: { ...s.boards, [boardId]: copy } };
    });
    scheduleSave(get);
  };

  const currentBoardId = () => {
    const s = get();
    return s.breadcrumb.length ? s.breadcrumb[s.breadcrumb.length - 1] : null;
  };

  const expandWithChildren = (boards: Record<string, Board>, ids: string[]): string[] => {
    const out = new Set<string>();
    const allCards = new Map<string, { card: Card; boardId: string }>();
    for (const b of Object.values(boards)) for (const c of b.cards) allCards.set(c.id, { card: c, boardId: b.id });
    for (const id of ids) {
      const found = allCards.get(id);
      if (!found) continue;
      out.add(id);
      if (found.card.data.kind === 'column') {
        for (const cid of found.card.data.cardIds) out.add(cid);
      }
    }
    return [...out];
  };

  return {
    loaded: false,
    boards: {},
    view: 'home',
    breadcrumb: [],
    viewports: {},
    selection: [],
    editingId: null,
    clipboard: null,
    lastPastePos: null,
    dragNewType: null,
    dragging: false,
    dropPreview: null,
    connecting: null,
    extractGhost: null,
    contextMenu: null,
    drawMode: false,
    drawCancelled: false,
    drawTool: { width: DRAW_WIDTH, style: 'pen', color: null },
    statusFilter: null,
    tagFilter: null,
    commentsOpenIds: [],
    backlinksOpen: null,
    bottomPanel: null,
    calendarTasks: [],
    searchOpen: false,
    shortcutsOpen: false,
    exportOpen: false,
    font: DEFAULT_FONT,
    theme: DEFAULT_THEME,
    plainBg: false,
    contentScale: DEFAULT_CONTENT_SCALE,
    themeBoot: false,
    layoutTick: 0,
    past: [],
    future: [],

    load: () => {
      const apply = (raw: string | null) => {
        try {
          if (raw) {
            const data = JSON.parse(raw) as PersistShape;
            if (data && data.boards && typeof data.boards === 'object') {
              migrateEntityCards(data.boards);
              set({
                boards: data.boards,
                view: data.view === 'board' && data.breadcrumb?.length ? 'board' : 'home',
                breadcrumb: Array.isArray(data.breadcrumb) ? data.breadcrumb : [],
                viewports: data.viewports ?? {},
                font: data.font ?? DEFAULT_FONT,
                theme: isThemeId(data.theme) ? data.theme : DEFAULT_THEME,
                plainBg: data.plainBg === true,
                contentScale: clampContentScale(data.contentScale ?? DEFAULT_CONTENT_SCALE),
                drawTool: sanitizeTool(data.drawTool),
                calendarTasks: Array.isArray(data.calendarTasks) ? data.calendarTasks : [],
                loaded: true,
              });
              applyFontToDom(get().font);
              applyThemeToDom(get().theme);
              applyPlainBgToDom(get().plainBg);
              applyContentScaleToDom(get().contentScale);
              scheduleSave(get);
              return;
            }
          }
        } catch {
        }
        applyFontToDom(DEFAULT_FONT);
        applyThemeToDom(DEFAULT_THEME);
        applyPlainBgToDom(false);
        applyContentScaleToDom(DEFAULT_CONTENT_SCALE);
        const seed = createSeed();
        set({
          boards: seed.boards,
          view: 'home',
          breadcrumb: [],
          viewports: {},
          loaded: true,
        });
        scheduleSave(get);
      };
      if (hostAvailable()) {
        void hostCall('load')
          .then((raw) => apply(raw))
          .catch(() => apply(null));
        return;
      }
      try {
        apply(localStorage.getItem(STORAGE_KEY));
      } catch {
        apply(null);
      }
    },

    persist: () => {
      saveToStorage(get());
    },

    setFont: (font) => {
      set({ font });
      applyFontToDom(font);
      scheduleSave(get);
    },

    setContentScale: (scale) => {
      const contentScale = clampContentScale(scale);
      set({ contentScale });
      applyContentScaleToDom(contentScale);
      scheduleSave(get);
    },

    setTheme: (theme) => {
      if (theme === get().theme) return;

      if ((theme === 'stylish' || theme === 'stylish-dark') && get().font === DEFAULT_FONT) {
        set({ font: 'inter' });
        applyFontToDom('inter');
      }

      set({ theme, themeBoot: true });
      applyThemeToDom(theme);
      get().bumpLayout();
      if (themeBootTimer) clearTimeout(themeBootTimer);
      themeBootTimer = setTimeout(() => {
        themeBootTimer = null;
        set({ themeBoot: false });
      }, THEME_BOOT_MS);
      scheduleSave(get);
    },

    togglePlainBg: () => {
      const plainBg = !get().plainBg;
      set({ plainBg });
      applyPlainBgToDom(plainBg);
      scheduleSave(get);
    },

    setView: (view) => {
      if (view === get().view) return;
      runViewTransition(viewTransitionKind(), () => {
        set({ view, editingId: null, contextMenu: null, drawMode: false });
      });
      scheduleSave(get);
    },

    openBoardRoot: (boardId) => {
      if (!get().boards[boardId]) return;
      runViewTransition(viewTransitionKind(), () => {
        set({ view: 'board', breadcrumb: [boardId], selection: [], editingId: null, contextMenu: null, drawMode: false });
      });
      scheduleSave(get);
    },

    openSubBoard: (boardId) => {
      if (!get().boards[boardId]) return;
      runViewTransition(viewTransitionKind(), () => {
        set((s) => ({
          view: 'board',
          breadcrumb: [...s.breadcrumb, boardId],
          selection: [],
          editingId: null,
          contextMenu: null,
          drawMode: false,
        }));
      });
      scheduleSave(get);
    },

    navigateTo: (depth) => {
      const nextDepth = Math.max(1, depth + 1);
      if (nextDepth === get().breadcrumb.length) return;
      runViewTransition(viewTransitionKind(), () => {
        set((s) => {
          const bc = s.breadcrumb.slice(0, Math.max(1, depth + 1));
          return { breadcrumb: bc, selection: [], editingId: null, contextMenu: null, drawMode: false };
        });
      });
      scheduleSave(get);
    },

    setViewport: (boardId, vp) => {
      set((s) => ({ viewports: { ...s.viewports, [boardId]: vp } }));
      scheduleSave(get);
    },

    getViewport: (boardId) => get().viewports[boardId] ?? DEFAULT_VP,

    pushHistory: () => {
      set((s) => ({
        past: [...s.past.slice(-99), { boards: clone(s.boards) }],
        future: [],
      }));
    },

    undo: () => {
      const s = get();
      if (!s.past.length) return;
      const prev = s.past[s.past.length - 1];
      set({
        past: s.past.slice(0, -1),
        future: [...s.future, { boards: clone(s.boards) }],
        boards: prev.boards,
        selection: [],
        editingId: null,
      });
      scheduleSave(get);
    },

    redo: () => {
      const s = get();
      if (!s.future.length) return;
      const next = s.future[s.future.length - 1];
      set({
        future: s.future.slice(0, -1),
        past: [...s.past, { boards: clone(s.boards) }],
        boards: next.boards,
        selection: [],
        editingId: null,
      });
      scheduleSave(get);
    },

    bumpLayout: () => set((s) => ({ layoutTick: s.layoutTick + 1 })),

    createBoard: (title) => {
      const id = uid();
      const now = Date.now();
      const b: Board = { id, title, cards: [], connections: [], createdAt: now, updatedAt: now };
      set((s) => ({ boards: { ...s.boards, [id]: b } }));
      scheduleSave(get);
      return id;
    },

    deleteBoardTree: (boardId) => {
      set((s) => {
        const ids = collectDescendants(s.boards, boardId);
        const boards = { ...s.boards };
        for (const id of ids) delete boards[id];
        const breadcrumb = s.breadcrumb.filter((id) => boards[id]);
        return {
          boards,
          breadcrumb: breadcrumb.length ? breadcrumb : [],
          view: breadcrumb.length ? s.view : 'home',
          selection: [],
          editingId: null,
        };
      });
      scheduleSave(get);
    },

    duplicateBoardTree: (boardId) => {
      const s = get();
      if (!s.boards[boardId]) return '';
      const { clones, rootCloneId } = cloneTree(s.boards, boardId);
      set((st) => {
        const boards = { ...st.boards };
        for (const b of clones) boards[b.id] = b;
        return { boards };
      });
      scheduleSave(get);
      return rootCloneId;
    },

    renameBoard: (boardId, title) => {
      mutBoard(boardId, (b) => {
        b.title = title;
      }, false);
    },

    importBoards: (json) => {
      try {
        const parsed = json as { boards?: Record<string, Board> };
        if (!parsed?.boards || typeof parsed.boards !== 'object') return false;
        const incoming = Object.values(parsed.boards).filter(
          (b) => b && typeof b.id === 'string' && Array.isArray(b.cards) && b.cards.every((c) => isCardData(c.data))
        );
        if (!incoming.length) return false;

        const boards = { ...get().boards };
        const idMap = new Map<string, string>();
        for (const b of incoming) idMap.set(b.id, uid());
        for (const b of incoming) {
          const cardIdMap = new Map<string, string>();
          for (const c of b.cards) cardIdMap.set(c.id, uid());
          const copy = clone(b);
          copy.id = idMap.get(b.id)!;
          copy.cards = copy.cards.map((c) => {
            const nc = { ...c, id: cardIdMap.get(c.id)! };
            if (nc.data.kind === 'column') {
              nc.data = { ...nc.data, cardIds: nc.data.cardIds.map((cid) => cardIdMap.get(cid) ?? cid) };
            }
            if (nc.data.kind === 'board' && idMap.has(nc.data.boardId)) {
              nc.data = { ...nc.data, boardId: idMap.get(nc.data.boardId)! };
            }
            return nc;
          });
          copy.connections = copy.connections.map((cn: Connection) => ({
            id: uid(),
            from: cardIdMap.get(cn.from) ?? cn.from,
            to: cardIdMap.get(cn.to) ?? cn.to,
          }));
          boards[copy.id] = copy;
        }
        set({ boards });
        scheduleSave(get);
        return true;
      } catch {
        return false;
      }
    },

    addCard: (type, x, y) => {
      const boardId = currentBoardId();
      if (!boardId) return null;
      get().pushHistory();
      let subBoardId: string | undefined;
      if (type === 'board') {
        subBoardId = get().createBoard('Новый лист');
      }

      const card = makeCard(type, x, y, subBoardId, get().drawTool);
      mutBoard(boardId, (b) => {
        b.cards.push(card);
      });
      return card.id;
    },

    addDrawObject: (boardId, x, y, w, h, data) => {
      if (!get().boards[boardId]) return null;
      get().pushHistory();
      const card = makeCard('draw', x, y, undefined, get().drawTool);
      card.w = w;
      card.h = h;
      card.data = data;
      mutBoard(boardId, (b) => {
        b.cards.push(card);
      });
      return card.id;
    },

    updateCardData: (cardId, data) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        const idx = b.cards.findIndex((c) => c.id === cardId);
        if (idx < 0) return s;
        const newCard = { ...b.cards[idx], data };
        const nb = {
          ...b,
          cards: b.cards.map((c, i) => (i === idx ? newCard : c)),
          updatedAt: Date.now(),
        };
        return { boards: { ...s.boards, [boardId]: nb } };
      });
      scheduleSave(get);
    },

    setCardMeta: (cardId, patch) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        const card = b.cards.find((c) => c.id === cardId);
        if (!card) return;
        Object.assign(card, patch);

        if (card.vote === null) delete card.vote;
        if (card.alarmAt === null) delete card.alarmAt;
        if (card.locked === false) delete card.locked;
        if (card.icon === '') delete card.icon;
      });
    },

    moveCards: (ids, dx, dy) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      const s = get();
      const board = s.boards[boardId];
      if (!board) return;

      const lockedIds = new Set(
        board.cards.filter((c) => c.locked).map((c) => c.id)
      );
      const idSet = new Set(ids.filter((id) => !lockedIds.has(id)));
      if (!idSet.size) return;
      set((st) => {
        const b = st.boards[boardId];
        if (!b) return st;
        const nb = {
          ...b,
          cards: b.cards.map((c) => (idSet.has(c.id) ? { ...c, x: c.x + dx, y: c.y + dy } : c)),
          updatedAt: Date.now(),
        };
        return { boards: { ...st.boards, [boardId]: nb } };
      });
      scheduleSave(get);
    },

    resizeCard: (cardId, w, h) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      set((s) => {
        const b = s.boards[boardId];
        if (!b) return s;
        const nb = {
          ...b,
          cards: b.cards.map((c) =>
            c.id === cardId ? { ...c, w: Math.max(80, w), h: Math.max(40, h) } : c
          ),
          updatedAt: Date.now(),
        };
        return { boards: { ...s.boards, [boardId]: nb } };
      });
      scheduleSave(get);
    },

    setCardSize: (cardId, w, h) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      mutBoard(boardId, (b) => {
        const card = b.cards.find((c) => c.id === cardId);
        if (!card) return;
        card.w = w;
        card.h = h;
      }, false);
    },

    deleteCards: (ids) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      const s = get();
      const board = s.boards[boardId];
      if (!board) return;
      const idSet = new Set(expandWithChildren(s.boards, ids));
      mutBoard(boardId, (b) => {

        for (const c of b.cards) {
          if (c.data.kind === 'column') {
            c.data = { ...c.data, cardIds: c.data.cardIds.filter((cid) => !idSet.has(cid)) };
          }
        }
        b.cards = b.cards.filter((c) => !idSet.has(c.id));
        b.connections = b.connections.filter((cn) => !idSet.has(cn.from) && !idSet.has(cn.to));
      });
      set({ selection: [], editingId: null });
    },

    bringToFront: (cardId) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      mutBoard(boardId, (b) => {
        const idx = b.cards.findIndex((c) => c.id === cardId);
        if (idx >= 0) {
          const [card] = b.cards.splice(idx, 1);
          b.cards.push(card);
        }
      });
    },

    sendToBack: (cardId) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      mutBoard(boardId, (b) => {
        const idx = b.cards.findIndex((c) => c.id === cardId);
        if (idx >= 0) {
          const [card] = b.cards.splice(idx, 1);
          b.cards.unshift(card);
        }
      });
    },

    duplicateCards: (ids) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      const s = get();
      const board = s.boards[boardId];
      if (!board) return;
      const topIds = new Set(ids);
      const toCopy = board.cards.filter((c) => topIds.has(c.id));
      if (!toCopy.length) return;
      const idMap = new Map<string, string>();
      for (const c of toCopy) {
        idMap.set(c.id, uid());
        if (c.data.kind === 'column') for (const cid of c.data.cardIds) idMap.set(cid, uid());
      }
      mutBoard(boardId, (b) => {
        for (const c of toCopy) {
          const copy = clone(c);
          copy.id = idMap.get(c.id)!;
          copy.x += 24;
          copy.y += 24;
          if (copy.data.kind === 'column') {
            copy.data = {
              ...copy.data,
              cardIds: copy.data.cardIds.map((cid) => idMap.get(cid) ?? cid),
            };

            for (const childId of c.data.cardIds) {
              const child = b.cards.find((cc) => cc.id === childId);
              if (child) {
                const childCopy = clone(child);
                childCopy.id = idMap.get(childId)!;
                b.cards.push(childCopy);
              }
            }
          }
          if (copy.data.kind === 'board') {
            const dup = get().duplicateBoardTree(copy.data.boardId);
            if (dup) copy.data = { ...copy.data, boardId: dup };
          }
          b.cards.push(copy);
        }
        b.connections = [
          ...b.connections,
          ...b.connections
            .filter((cn) => idMap.has(cn.from) && idMap.has(cn.to))
            .map((cn) => ({ id: uid(), from: idMap.get(cn.from)!, to: idMap.get(cn.to)! })),
        ];
      });
      const newIds = toCopy.map((c) => idMap.get(c.id)!);
      set({ selection: newIds });
    },

    mergeStrokes: (ids) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      const s = get();
      const board = s.boards[boardId];
      if (!board) return;
      const strokes = board.cards.filter(
        (c) => c.type === 'draw' && c.data.kind === 'draw' && ids.includes(c.id) && !findColumnOf(board, c.id)
      );
      if (strokes.length < 2) return;
      get().pushHistory();
      const target = strokes[0];
      const targetData = target.data.kind === 'draw' ? target.data : null;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const absStrokes: DrawStroke[] = [];
      for (const st of strokes) {
        if (st.data.kind !== 'draw') continue;
        const source = st.data.strokes?.length
          ? st.data.strokes
          : [{ width: st.data.width, style: st.data.style, color: st.data.color, points: st.data.points }];
        for (const stroke of source) {
          const points: number[] = [];
          for (let i = 0; i < stroke.points.length; i += 2) {
            const ax = st.x + stroke.points[i];
            const ay = st.y + stroke.points[i + 1];
            points.push(ax, ay);
            minX = Math.min(minX, ax);
            maxX = Math.max(maxX, ax);
            minY = Math.min(minY, ay);
            maxY = Math.max(maxY, ay);
          }
          if (points.length >= 2) absStrokes.push({ ...stroke, points });
        }
      }
      if (!absStrokes.length) return;
      const pad = 8 + Math.max(...absStrokes.map((stroke) => stroke.width * (stroke.style === 'marker' ? 1.7 : 1)));
      const relativeStrokes = absStrokes.map((stroke) => ({
        ...stroke,
        points: stroke.points.map((v, i) => v - (i % 2 === 0 ? minX - pad : minY - pad)),
      }));
      const first = relativeStrokes[0];
      mutBoard(boardId, (b) => {
        const t = b.cards.find((c) => c.id === target.id);
        if (!t) return;
        t.x = minX - pad;
        t.y = minY - pad;
        t.w = maxX - minX + pad * 2;
        t.h = maxY - minY + pad * 2;
        t.data = {
          kind: 'draw',
          width: first.width,
          style: first.style ?? 'pen',
          color: first.color ?? null,
          points: first.points,
          strokes: relativeStrokes,
        };
        const dropIds = new Set(strokes.filter((st) => st.id !== target.id).map((st) => st.id));
        b.cards = b.cards.filter((c) => !dropIds.has(c.id));
        b.connections = b.connections.filter((cn) => !dropIds.has(cn.from) && !dropIds.has(cn.to));
      });
      set({ selection: [target.id] });
    },

    setSelection: (ids) => set({ selection: ids }),
    toggleSelection: (id) =>
      set((s) => ({
        selection: s.selection.includes(id) ? s.selection.filter((i) => i !== id) : [...s.selection, id],
      })),
    selectAll: () => {
      const boardId = currentBoardId();
      if (!boardId) return;
      set({ selection: get().boards[boardId]?.cards.map((c) => c.id) ?? [] });
    },
    clearSelection: () => set({ selection: [] }),
    setEditing: (id) => set({ editingId: id }),

    copySelection: () => {
      const boardId = currentBoardId();
      if (!boardId) return;
      const board = get().boards[boardId];
      const sel = new Set(get().selection);
      if (!board || !sel.size) return;
      const cards = board.cards.filter((c) => sel.has(c.id));
      set({ clipboard: clone(cards) });
    },

    cutSelection: () => {
      get().copySelection();
      get().deleteCards(get().selection);
    },

    pasteClipboard: (x, y) => {
      const boardId = currentBoardId();
      const clip = get().clipboard;
      if (!boardId || !clip?.length) return;
      const idMap = new Map<string, string>();
      for (const c of clip) {
        idMap.set(c.id, uid());
        if (c.data.kind === 'column') for (const cid of c.data.cardIds) idMap.set(cid, uid());
      }
      let minX = Infinity;
      let minY = Infinity;
      for (const c of clip) {
        minX = Math.min(minX, c.x);
        minY = Math.min(minY, c.y);
      }
      get().pushHistory();
      mutBoard(boardId, (b) => {
        for (const c of clip) {
          const copy = clone(c);
          copy.id = idMap.get(c.id)!;
          copy.x = x + (c.x - minX);
          copy.y = y + (c.y - minY);
          if (copy.data.kind === 'column') {
            copy.data = { ...copy.data, cardIds: copy.data.cardIds.map((cid) => idMap.get(cid) ?? cid) };
          }
          b.cards.push(copy);
        }
      });
      set({ selection: clip.map((c) => idMap.get(c.id)!) });
    },

    mergeIntoColumn: (draggedIds, targetCardId) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      const board = get().boards[boardId];
      if (!board) return;
      const target = board.cards.find((c) => c.id === targetCardId);
      const dragged = draggedIds
        .map((id) => board.cards.find((c) => c.id === id))
        .filter((c): c is Card => !!c && c.id !== targetCardId);
      if (!target || !dragged.length) return;

      get().pushHistory();

      const flatIds: string[] = [];
      const flatCards: Card[] = [];
      const removedColumnIds: string[] = [];
      for (const d of dragged) {
        if (d.data.kind === 'column') {
          removedColumnIds.push(d.id);
          for (const cid of d.data.cardIds) {
            const child = get().boards[boardId]?.cards.find((c) => c.id === cid);
            if (child) {
              flatIds.push(cid);
              flatCards.push(child);
            }
          }
        } else {
          flatIds.push(d.id);
          flatCards.push(d);
        }
      }

      if (target.data.kind === 'column') {
        mutBoard(boardId, (b) => {
          const col = b.cards.find((c) => c.id === targetCardId);
          if (col && col.data.kind === 'column') {
            col.data = { ...col.data, cardIds: [...col.data.cardIds, ...flatIds] };
            col.w = Math.max(col.w, ...flatCards.map((d) => d.w + 20), 160);
            const removed = new Set(removedColumnIds);
            b.cards = b.cards.filter((c) => !removed.has(c.id));
          }
        });
        set({ dropPreview: null });
        return;
      }

      const parentId = findColumnOf(get().boards[boardId], targetCardId);
      const newColId = uid();
      const newW = Math.max(target.w, ...flatCards.map((d) => d.w), 160) + 20;
      mutBoard(boardId, (b) => {
        const colCard: Card = {
          id: newColId,
          type: 'column',
          x: target.x,
          y: target.y,
          w: newW,
          h: 0,
          data: { kind: 'column', title: '', cardIds: [target.id, ...flatIds] },
        };

        if (parentId) {
          const parent = b.cards.find((c) => c.id === parentId);
          if (parent && parent.data.kind === 'column') {
            parent.data = {
              ...parent.data,
              cardIds: parent.data.cardIds.flatMap((cid) =>
                cid === targetCardId ? [newColId] : cid === draggedIds[0] ? [] : [cid]
              ),
            };
          }
        }

        for (const d of flatCards) {
          d.w = Math.min(d.w, newW - 20);
        }
        target.w = Math.min(target.w, newW - 20);

        const removed = new Set<string>(removedColumnIds);
        b.cards = b.cards.filter((c) => !removed.has(c.id));
        b.cards.push(colCard);
      });
      set({ dropPreview: null, selection: [newColId] });
    },

    moveCardToColumn: (cardId, columnId, index) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        const col = b.cards.find((c) => c.id === columnId);
        if (!col || col.data.kind !== 'column') return;

        for (const c of b.cards) {
          if (c.data.kind === 'column' && c.data.cardIds.includes(cardId)) {
            c.data = { ...c.data, cardIds: c.data.cardIds.filter((cid) => cid !== cardId) };
          }
        }
        const ids = [...col.data.cardIds];
        const idx = Math.max(0, Math.min(index, ids.length));
        ids.splice(idx, 0, cardId);
        col.data = { ...col.data, cardIds: ids };
        col.w = Math.max(col.w, (b.cards.find((c) => c.id === cardId)?.w ?? 0) + 20);
      });
      set({ dropPreview: null });
    },

    reorderInColumn: (cardId, columnId, index) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      mutBoard(boardId, (b) => {
        const col = b.cards.find((c) => c.id === columnId);
        if (!col || col.data.kind !== 'column') return;
        const ids = col.data.cardIds.filter((cid) => cid !== cardId);
        const idx = Math.max(0, Math.min(index, ids.length));
        ids.splice(idx, 0, cardId);
        col.data = { ...col.data, cardIds: ids };
      });
      set({ dropPreview: null });
    },

    extractFromColumn: (cardId, x, y) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        const card = b.cards.find((c) => c.id === cardId);
        for (const c of b.cards) {
          if (c.data.kind === 'column' && c.data.cardIds.includes(cardId)) {
            c.data = { ...c.data, cardIds: c.data.cardIds.filter((cid) => cid !== cardId) };
          }
        }
        if (card) {
          card.x = x - card.w / 2;
          card.y = y - 20;
        }
      });
    },

    unstackColumn: (columnId) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        const col = b.cards.find((c) => c.id === columnId);
        if (!col || col.data.kind !== 'column') return;
        let y = col.y;
        for (const cid of col.data.cardIds) {
          const child = b.cards.find((c) => c.id === cid);
          if (child) {
            child.x = col.x + 10;
            child.y = y;
            y += (measuredSizes.get(child.id)?.h ?? child.h) + 14;
            child.w = Math.max(child.w, col.w - 20);
          }
        }
        b.cards = b.cards.filter((c) => c.id !== columnId);
      });
      set({ selection: [] });
    },

    addConnection: (from, to) => {
      const boardId = currentBoardId();
      if (!boardId || from === to) return;
      const board = get().boards[boardId];
      if (!board) return;
      if (board.connections.some((cn) => (cn.from === from && cn.to === to) || (cn.from === to && cn.to === from))) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        b.connections = [...b.connections, { id: uid(), from, to }];
      });
    },

    deleteConnection: (connectionId) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        b.connections = b.connections.filter((cn) => cn.id !== connectionId);
      });
    },

    cycleConnectionArrow: (connectionId) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        b.connections = b.connections.map((cn) =>
          cn.id === connectionId ? { ...cn, arrow: nextArrow(cn.arrow) } : cn
        );
      });
    },

    setConnectionArrow: (connectionId, arrow) => {
      const boardId = currentBoardId();
      if (!boardId) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        b.connections = b.connections.map((cn) => (cn.id === connectionId ? { ...cn, arrow } : cn));
      });
    },

    setBoardTag: (ids, label) => {
      const boardId = currentBoardId();
      if (!boardId || !ids.length) return;
      get().pushHistory();
      mutBoard(boardId, (b) => {
        b.cards = b.cards.map((c) =>
          ids.includes(c.id)
            ? {
                ...c,
                tags: label
                  ? [...(c.tags ?? []).filter((t) => t !== label), label]
                  : (c.tags ?? []).filter((t) => t !== label),
              }
            : c
        );
      });
    },

    setConnecting: (connecting) => set({ connecting }),
    setDragNewType: (t) => set({ dragNewType: t }),
    setDragging: (dragging) => set({ dragging }),
    setDropPreview: (p) => set({ dropPreview: p }),
    setExtractGhost: (g) => set({ extractGhost: g }),
    openContextMenu: (m) => set({ contextMenu: m }),
    setDrawMode: (on) =>
      set(on ? { drawMode: true, drawCancelled: false, selection: [] } : { drawMode: false, drawCancelled: false }),
    cancelDrawMode: () => set({ drawMode: false, drawCancelled: true }),
    setDrawTool: (patch) =>
      set((s) => ({ drawTool: { ...s.drawTool, ...patch } })),
    setSearchOpen: (open) => set({ searchOpen: open }),
    setStatusFilter: (f) => set({ statusFilter: f }),
    setTagFilter: (t) => set({ tagFilter: t }),
    setBacklinksOpen: (cardId) => set({ backlinksOpen: cardId }),
    setBottomPanel: (p) => set({ bottomPanel: p }),
    toggleCommentsOpen: (cardId) =>
      set((s) => ({
        commentsOpenIds: s.commentsOpenIds.includes(cardId)
          ? s.commentsOpenIds.filter((i) => i !== cardId)
          : [...s.commentsOpenIds, cardId],
      })),
    closeComments: () => set({ commentsOpenIds: [] }),
    addComment: (cardId, text) => {
      const comment = { id: uid(), text, ts: Date.now() };
      set((s) => {
        const out: Record<string, Board> = {};
        for (const [bid, b] of Object.entries(s.boards)) {
          out[bid] = {
            ...b,
            cards: b.cards.map((c) =>
              c.id === cardId ? { ...c, comments: [...(c.comments ?? []), comment] } : c
            ),
          };
        }
        return { boards: out };
      });
      scheduleSave(get);
    },
    deleteComment: (cardId, commentId) => {
      set((s) => {
        const out: Record<string, Board> = {};
        for (const [bid, b] of Object.entries(s.boards)) {
          out[bid] = {
            ...b,
            cards: b.cards.map((c) =>
              c.id === cardId ? { ...c, comments: (c.comments ?? []).filter((k) => k.id !== commentId) } : c
            ),
          };
        }
        return { boards: out };
      });
      scheduleSave(get);
    },
    addCalendarTask: (text, repeat) => {
      const task: CalendarTask = { id: uid(), text, createdAt: Date.now(), repeat, doneDates: [], done: false };
      set((s) => ({ calendarTasks: [...s.calendarTasks, task] }));
      scheduleSave(get);
      return task.id;
    },
    toggleCalendarTaskDone: (taskId, dateKey) => {
      set((s) => ({
        calendarTasks: s.calendarTasks.map((t) => {
          if (t.id !== taskId) return t;
          if (t.repeat.kind === 'once') return { ...t, done: !t.done };
          return t.doneDates.includes(dateKey)
            ? { ...t, doneDates: t.doneDates.filter((d) => d !== dateKey) }
            : { ...t, doneDates: [...t.doneDates, dateKey] };
        }),
      }));
      scheduleSave(get);
    },
    deleteCalendarTask: (taskId) => {
      set((s) => ({ calendarTasks: s.calendarTasks.filter((t) => t.id !== taskId) }));
      scheduleSave(get);
    },
    setShortcutsOpen: (open) => set({ shortcutsOpen: open }),
    setExportOpen: (open) => set({ exportOpen: open }),
  };
});

export function findColumnOf(board: Board, cardId: string): string | null {
  for (const c of board.cards) {
    if (c.data.kind === 'column' && c.data.cardIds.includes(cardId)) return c.id;
  }
  return null;
}

export function getCard(board: Board | undefined, cardId: string): Card | undefined {
  return board?.cards.find((c) => c.id === cardId);
}
