

'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAppStore, findColumnOf } from '@/lib/klaster/store';
import type { DrawTool } from '@/lib/klaster/store';
import { measuredSizes } from '@/lib/klaster/types';
import type { DrawStroke, Viewport } from '@/lib/klaster/types';
import { renderStroke } from '@/lib/klaster/stroke';
import { canvasHandle, clientToWorld } from '@/lib/klaster/canvasHandle';
import { CardView } from './CardView';
import { Connections } from './Connections';
import { DrawPanel } from './DrawPanel';

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

let vpPersistTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleVpPersist(boardId: string) {
  if (vpPersistTimer) clearTimeout(vpPersistTimer);
  vpPersistTimer = setTimeout(() => {
    useAppStore.getState().setViewport(boardId, { ...canvasHandle.view });
  }, 220);
}

function applyVp(v: Viewport) {
  canvasHandle.view = v;
  canvasHandle.zoom = v.zoom;
  if (canvasHandle.world) {
    canvasHandle.world.style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
  }
}

function commitDrawingSession(boardId: string, strokes: DrawStroke[]) {
  const validStrokes = strokes.filter((stroke) => stroke.points.length >= 2);
  if (!validStrokes.length) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const stroke of validStrokes) {
    for (let i = 0; i < stroke.points.length; i += 2) {
      minX = Math.min(minX, stroke.points[i]);
      maxX = Math.max(maxX, stroke.points[i]);
      minY = Math.min(minY, stroke.points[i + 1]);
      maxY = Math.max(maxY, stroke.points[i + 1]);
    }
  }

  const maxWidth = Math.max(...validStrokes.map((stroke) => stroke.width * (stroke.style === 'marker' ? 1.7 : 1)));
  const pad = 8 + maxWidth;
  const x = minX - pad;
  const y = minY - pad;
  const relativeStrokes = validStrokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((value, i) => value - (i % 2 === 0 ? x : y)),
  }));
  const first = relativeStrokes[0];
  const id = useAppStore.getState().addDrawObject(boardId, x, y, maxX - minX + pad * 2, maxY - minY + pad * 2, {
    kind: 'draw',
    width: first.width,
    style: first.style,
    color: first.color,
    points: first.points,
    strokes: relativeStrokes,
  });
  if (id) useAppStore.getState().setSelection([id]);
}

function paintStrokeGroup(group: SVGGElement, rendered: ReturnType<typeof renderStroke>, color: string) {
  group.replaceChildren();
  if (!rendered.path) return;
  for (const layer of [rendered, ...(rendered.layers ?? [])]) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', layer.path);
    path.setAttribute('opacity', String(layer.opacity));
    path.setAttribute('stroke-linejoin', 'round');
    if (layer.kind === 'filled') {
      path.setAttribute('fill', color);
    } else {
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', color);
      if (layer.width) path.setAttribute('stroke-width', String(layer.width));
      path.setAttribute('stroke-linecap', layer.cap ?? 'round');
      if (layer.dashArray) path.setAttribute('stroke-dasharray', layer.dashArray);
    }
    group.append(path);
  }
}

export function zoomTo(boardId: string, z: number) {

  const v0 = canvasHandle.view;
  const v: Viewport = {
    x: v0.x * (z / v0.zoom),
    y: v0.y * (z / v0.zoom),
    zoom: z,
  };
  applyVp(v);
  useAppStore.getState().setViewport(boardId, { ...v });
}

export function fitView(boardId: string) {
  const board = useAppStore.getState().boards[boardId];
  const outer = canvasHandle.outer;
  if (!board || !outer) return;
  const childIds = new Set<string>();
  for (const c of board.cards) {
    if (c.data.kind === 'column') for (const cid of c.data.cardIds) childIds.add(cid);
  }
  const cards = board.cards.filter((c) => !childIds.has(c.id));
  if (!cards.length) {
    zoomTo(boardId, 1);
    return;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of cards) {
    const m = measuredSizes.get(c.id);
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
    maxX = Math.max(maxX, c.x + c.w);
    maxY = Math.max(maxY, c.y + (m?.h ?? c.h));
  }
  const bw = Math.max(1, maxX - minX);
  const bh = Math.max(1, maxY - minY);
  const rect = outer.getBoundingClientRect();
  const zoom = clamp(Math.min((rect.width - 140) / bw, (rect.height - 180) / bh, 1.1), 0.05, 1.1);

  const v: Viewport = {
    x: -(minX + bw / 2) * zoom,
    y: -(minY + bh / 2) * zoom,
    zoom,
  };
  applyVp(v);
  useAppStore.getState().setViewport(boardId, { ...v });
}

interface Marquee {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export function Canvas({ boardId }: { boardId: string }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const board = useAppStore((s) => s.boards[boardId]);
  const vp = useAppStore((s) => s.viewports[boardId]);
  const drawMode = useAppStore((s) => s.drawMode);
  const drawCancelled = useAppStore((s) => s.drawCancelled);
  const drawTool = useAppStore((s) => s.drawTool);
  const [marquee, setMarquee] = useState<Marquee | null>(null);
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [panning, setPanning] = useState(false);
  const draftStrokesRef = useRef<DrawStroke[]>([]);
  const draftLayerRef = useRef<SVGGElement>(null);
  const livePathRef = useRef<SVGGElement>(null);
  const wasDrawMode = useRef(drawMode);
  const drawSessionBoardId = useRef(boardId);

  const touchPtrs = useRef<Map<number, { x: number; y: number }>>(new Map());
  const gestureCancel = useRef<(() => void) | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number; wx: number; wy: number } | null>(null);

  const lastCanvasDown = useRef<{ t: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (!wasDrawMode.current && drawMode) drawSessionBoardId.current = boardId;
    if (wasDrawMode.current && !drawMode) {
      gestureCancel.current?.();
      if (!drawCancelled) commitDrawingSession(drawSessionBoardId.current, draftStrokesRef.current);
      draftStrokesRef.current = [];
      draftLayerRef.current?.replaceChildren();
    }
    wasDrawMode.current = drawMode;
  }, [boardId, drawCancelled, drawMode]);

  useEffect(
    () => () => {
      if (!wasDrawMode.current) return;
      gestureCancel.current?.();
      if (!useAppStore.getState().drawCancelled) {
        commitDrawingSession(drawSessionBoardId.current, draftStrokesRef.current);
      }
    },
    []
  );

  // Вид листа выставляется синхронно при монтировании (слой DOM), чтобы кадр
  // не «прыгал» и чтобы снимок анимации перехода сразу был в нужной позиции.
  useLayoutEffect(() => {
    canvasHandle.outer = outerRef.current;
    canvasHandle.world = worldRef.current;
    // Сразу выставляем сохранённый вид листа. Без этого DOM-слой остаётся
    // без смещения, а canvasHandle.view хранит вид прошлого листа — и первый
    // же сдвиг (WASD/свайп) «прыгает», как будто лист заново центрируется.
    applyVp(useAppStore.getState().viewports[boardId] ?? { x: 0, y: 0, zoom: 1 });
    return () => {
      // Сбрасываем отложенную запись вида, чтобы она не записала вид нового
      // листа в предыдущий при быстром переходе между листами.
      if (vpPersistTimer) {
        clearTimeout(vpPersistTimer);
        vpPersistTimer = null;
      }
      // Сохраняем текущий вид, чтобы при переключении темы или листа
      // он не сбросился на устаревшее значение (иначе экран дёргается).
      useAppStore.getState().setViewport(boardId, { ...canvasHandle.view });
      if (canvasHandle.outer === outerRef.current) canvasHandle.outer = null;
      if (canvasHandle.world === worldRef.current) canvasHandle.world = null;
    };
  }, [boardId]);

  useEffect(() => {
    if (vp && (vp.x !== canvasHandle.view.x || vp.y !== canvasHandle.view.y || vp.zoom !== canvasHandle.view.zoom)) {
      applyVp(vp);
    }
  }, [boardId, vp]);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const v = canvasHandle.view;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.0022);
        const nz = clamp(v.zoom * factor, 0.05, 4);
        const sx = e.clientX - rect.left - rect.width / 2;
        const sy = e.clientY - rect.top - rect.height / 2;
        const nx = sx - ((sx - v.x) / v.zoom) * nz;
        const ny = sy - ((sy - v.y) / v.zoom) * nz;
        applyVp({ x: nx, y: ny, zoom: nz });
      } else {
        const dx = e.shiftKey ? e.deltaY : e.deltaX;
        const dy = e.shiftKey ? 0 : e.deltaY;
        applyVp({ x: v.x - dx, y: v.y - dy, zoom: v.zoom });
      }
      scheduleVpPersist(boardId);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [boardId]);

  // Колесо мыши над открытым прокручиваемым списком (иконки, смайлы и т.п.)
  // листает сам список, а не холст.
  useEffect(() => {
    const onDocWheel = (e: WheelEvent) => {
      const t = e.target;
      if (!(t instanceof Element)) return;
      let node: HTMLElement | null = t.parentElement;
      while (node && node !== document.body) {
        const oy = getComputedStyle(node).overflowY;
        if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
          e.stopPropagation();
          return;
        }
        node = node.parentElement;
      }
    };
    document.addEventListener('wheel', onDocWheel, true);
    return () => document.removeEventListener('wheel', onDocWheel, true);
  }, []);

  useEffect(() => {
    const isEditable = (t: EventTarget | null) =>
      t instanceof HTMLElement && t.matches('input, textarea, select, [contenteditable="true"]');
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isEditable(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useEffect(() => {
    const PAN_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD']);
    const PAN_SPEED = 620;
    const held = new Set<string>();
    let raf = 0;
    let prevT = 0;

    const keyOf = (e: KeyboardEvent): string => {
      if (e.code && PAN_KEYS.has(e.code)) return e.code;
      switch (e.key.toLowerCase()) {
        case 'w': return 'KeyW';
        case 'a': return 'KeyA';
        case 's': return 'KeyS';
        case 'd': return 'KeyD';
        default: return '';
      }
    };

    const isBlocked = (e: KeyboardEvent) => {
      const st = useAppStore.getState();
      if (st.view !== 'board') return true;
      if (st.searchOpen || st.shortcutsOpen || st.exportOpen || st.contextMenu) return true;
      if (e.ctrlKey || e.metaKey || e.altKey) return true;
      const t = e.target;

      return (
        t instanceof HTMLElement &&
        (t.matches('input, textarea, select, [contenteditable="true"]') || t.isContentEditable)
      );
    };

    const tick = (t: number) => {
      const dt = prevT ? Math.min(64, t - prevT) : 16;
      prevT = t;
      let dx = 0;
      let dy = 0;
      if (held.has('KeyA')) dx += 1;
      if (held.has('KeyD')) dx -= 1;
      if (held.has('KeyW')) dy += 1;
      if (held.has('KeyS')) dy -= 1;
      if (dx || dy) {
        const k = (PAN_SPEED * dt) / 1000;
        const v = canvasHandle.view;
        applyVp({ x: v.x + dx * k, y: v.y + dy * k, zoom: v.zoom });
        scheduleVpPersist(boardId);
      }
      if (held.size) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = 0;
        prevT = 0;
      }
    };

    const down = (e: KeyboardEvent) => {
      const code = keyOf(e);
      if (!code || held.has(code) || isBlocked(e)) return;
      e.preventDefault();
      held.add(code);
      if (!raf) {
        prevT = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code && PAN_KEYS.has(e.code)) {
        held.delete(e.code);
        return;
      }

      if (!e.code) {
        const code = keyOf(e);
        if (code) held.delete(code);
      }
    };
    const clear = () => held.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      if (raf) cancelAnimationFrame(raf);
      held.clear();
    };
  }, [boardId]);

  useEffect(() => {
    const clear = (e: PointerEvent) => {
      if (e.pointerType === 'touch') touchPtrs.current.delete(e.pointerId);
    };
    window.addEventListener('pointerup', clear);
    window.addEventListener('pointercancel', clear);
    return () => {
      window.removeEventListener('pointerup', clear);
      window.removeEventListener('pointercancel', clear);
    };
  }, []);

  const startPan = (e: React.PointerEvent) => {
    setPanning(true);
    const sx = e.clientX;
    const sy = e.clientY;
    const start = { ...canvasHandle.view };
    const move = (ev: PointerEvent) => {
      applyVp({ x: start.x + (ev.clientX - sx), y: start.y + (ev.clientY - sy), zoom: start.zoom });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      gestureCancel.current = null;
      setPanning(false);
      scheduleVpPersist(boardId);
    };
    gestureCancel.current = finish;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const startDblHoldPan = (e: React.PointerEvent) => {
    setPanning(true);
    const sx = e.clientX;
    const sy = e.clientY;
    const start = { ...canvasHandle.view };
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
      applyVp({ x: start.x + (ev.clientX - sx), y: start.y + (ev.clientY - sy), zoom: start.zoom });
    };
    const finish = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
      gestureCancel.current = null;
      setPanning(false);
      scheduleVpPersist(boardId);
    };
    gestureCancel.current = finish;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', finish);
    window.addEventListener('pointercancel', finish);
  };

  const startMarquee = (e: React.PointerEvent) => {

    const base = outerRef.current?.getBoundingClientRect();
    const bx = base?.left ?? 0;
    const by = base?.top ?? 0;
    const sx = e.clientX - bx;
    const sy = e.clientY - by;
    let lastIds = '';
    const move = (ev: PointerEvent) => {
      const m = { x0: sx, y0: sy, x1: ev.clientX - bx, y1: ev.clientY - by };
      setMarquee(m);

      const a = clientToWorld(Math.min(m.x0, m.x1) + bx, Math.min(m.y0, m.y1) + by);
      const b = clientToWorld(Math.max(m.x0, m.x1) + bx, Math.max(m.y0, m.y1) + by);
      if (!a || !b) return;
      const st = useAppStore.getState();
      const bd = st.boards[boardId];
      if (!bd) return;
      const childIds = new Set<string>();
      for (const c of bd.cards) {
        if (c.data.kind === 'column') for (const cid of c.data.cardIds) childIds.add(cid);
      }
      const ids: string[] = [];
      for (const c of bd.cards) {
        if (childIds.has(c.id)) continue;
        const size = measuredSizes.get(c.id);
        const cx1 = c.x;
        const cy1 = c.y;
        const cx2 = c.x + c.w;
        const cy2 = c.y + (size?.h ?? c.h);
        const intersects = cx1 < b.x && cx2 > a.x && cy1 < b.y && cy2 > a.y;
        if (intersects) ids.push(c.id);
      }
      const key = ids.join(',');
      if (key !== lastIds) {
        lastIds = key;
        st.setSelection(ids);
      }
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      gestureCancel.current = null;
      setMarquee(null);
      if (Math.hypot(ev.clientX - bx - sx, ev.clientY - by - sy) < 4) {
        useAppStore.getState().clearSelection();
        useAppStore.getState().setEditing(null);
      }
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      gestureCancel.current = null;
      setMarquee(null);
    };
    gestureCancel.current = cancel;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const keepDraftStroke = (pts: number[], pressures: number[], tool: DrawTool) => {
    if (pts.length < 2) return;
    const stroke: DrawStroke = { ...tool, points: [...pts], pressures: [...pressures] };
    draftStrokesRef.current.push(stroke);
    const rendered = renderStroke(stroke.points, stroke.width, stroke.style, stroke.pressures);
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    paintStrokeGroup(group, rendered, stroke.color ?? 'var(--text-main)');
    draftLayerRef.current?.append(group);
  };

  const startStroke = (e: React.PointerEvent) => {
    const w0 = clientToWorld(e.clientX, e.clientY);
    if (!w0) return;

    const tool = { ...useAppStore.getState().drawTool };
    const pts: number[] = [w0.x, w0.y];
    const pressures = [e.pointerType === 'mouse' || e.pressure <= 0 ? 0.78 : e.pressure];
    let lastInput = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    const zoom = canvasHandle.zoom || 1;
    const pointerId = e.pointerId;
    let frame = 0;
    let finished = false;
    const path = livePathRef.current;
    if (path) path.style.display = '';
    const queuePreview = () => {
      if (!frame) frame = requestAnimationFrame(drawPreview);
    };
    const drawPreview = () => {
      frame = 0;
      if (!path) return;
      const rendered = renderStroke(pts, tool.width, tool.style, pressures);
      paintStrokeGroup(path, rendered, tool.color ?? 'var(--text-main)');
    };
    queuePreview();
    const addSamples = (ev: PointerEvent) => {
      const samples = typeof ev.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : [];
      const append = (sample: PointerEvent) => {
        const elapsed = Math.max(1, sample.timeStamp - lastInput.t);
        const speed = Math.hypot(sample.clientX - lastInput.x, sample.clientY - lastInput.y) / elapsed;
        lastInput = { x: sample.clientX, y: sample.clientY, t: sample.timeStamp };
        const w = clientToWorld(sample.clientX, sample.clientY);
        if (!w) return;
        const px = pts[pts.length - 2];
        const py = pts[pts.length - 1];
        if (Math.hypot(w.x - px, w.y - py) * zoom < 0.5) return;
        pts.push(w.x, w.y);
        const speedPressure = clamp(0.96 - Math.min(speed / 1.5, 1) * 0.68, 0.28, 0.96);
        pressures.push(sample.pointerType === 'mouse' || sample.pressure <= 0 ? speedPressure : sample.pressure);
      };
      for (const sample of samples.length ? samples : [ev]) append(sample);
      if (samples.length) append(ev);
      queuePreview();
    };
    const detach = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      gestureCancel.current = null;
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId === pointerId) addSamples(ev);
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId || finished) return;
      addSamples(ev);
      finished = true;
      detach();
      if (frame) cancelAnimationFrame(frame);
      drawPreview();
      if (path) path.style.display = 'none';
      keepDraftStroke(pts, pressures, tool);
    };
    const cancel = (ev?: PointerEvent) => {
      if ((ev && ev.pointerId !== pointerId) || finished) return;
      finished = true;
      detach();
      if (frame) cancelAnimationFrame(frame);
      if (path) path.style.display = 'none';
    };
    gestureCancel.current = cancel;
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  };

  const startPinch = () => {
    const outer = outerRef.current;
    const pts = [...touchPtrs.current.values()];
    if (!outer || pts.length < 2) return;
    const rect = outer.getBoundingClientRect();
    const ax = pts[0].x - rect.left - rect.width / 2;
    const ay = pts[0].y - rect.top - rect.height / 2;
    const bx = pts[1].x - rect.left - rect.width / 2;
    const by = pts[1].y - rect.top - rect.height / 2;
    const v0 = canvasHandle.view;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    pinchRef.current = {
      dist: Math.max(20, Math.hypot(bx - ax, by - ay)),
      zoom: v0.zoom,

      wx: (mx - v0.x) / v0.zoom,
      wy: (my - v0.y) / v0.zoom,
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerType !== 'touch' || !touchPtrs.current.has(ev.pointerId)) return;
      touchPtrs.current.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      const pin = pinchRef.current;
      if (!pin || !outerRef.current) return;
      const cur = [...touchPtrs.current.values()];
      if (cur.length < 2) return;
      const r = outerRef.current.getBoundingClientRect();
      const cax = cur[0].x - r.left - r.width / 2;
      const cay = cur[0].y - r.top - r.height / 2;
      const cbx = cur[1].x - r.left - r.width / 2;
      const cby = cur[1].y - r.top - r.height / 2;
      const dist = Math.max(20, Math.hypot(cbx - cax, cby - cay));
      const nz = clamp(pin.zoom * (dist / pin.dist), 0.05, 4);
      const nmx = (cax + cbx) / 2;
      const nmy = (cay + cby) / 2;

      applyVp({ x: nmx - pin.wx * nz, y: nmy - pin.wy * nz, zoom: nz });
      scheduleVpPersist(boardId);
    };
    const up = () => {
      if (touchPtrs.current.size >= 2) return;
      pinchRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      scheduleVpPersist(boardId);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.target !== outerRef.current && e.target !== worldRef.current) return;
    useAppStore.getState().openContextMenu(null);
    // Тап по пустому месту листа сворачивает все открытые ветки комментариев.
    useAppStore.getState().closeComments();

    if (e.pointerType === 'touch') {
      touchPtrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touchPtrs.current.size >= 2) {
        gestureCancel.current?.();
        gestureCancel.current = null;
        startPinch();
      } else if (drawMode) {
        e.preventDefault();
        startStroke(e);
      } else {
        e.preventDefault();
        const x0 = e.clientX;
        const y0 = e.clientY;
        let lpMoved = false;
        const onLpMove = (ev: PointerEvent) => {
          if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 10) lpMoved = true;
        };
        const stopLp = () => {
          window.removeEventListener('pointermove', onLpMove);
          window.removeEventListener('pointerup', stopLp);
          window.removeEventListener('pointercancel', stopLp);
        };
        window.addEventListener('pointermove', onLpMove);
        window.addEventListener('pointerup', stopLp, { once: true });
        window.addEventListener('pointercancel', stopLp, { once: true });
        window.setTimeout(() => {
          stopLp();
          if (lpMoved) return;
          gestureCancel.current?.();
          gestureCancel.current = null;
          setPanning(false);
          const w = clientToWorld(x0, y0);
          useAppStore.getState().openContextMenu({
            kind: 'canvas',
            x: x0,
            y: y0,
            wx: w?.x ?? 0,
            wy: w?.y ?? 0,
          });
        }, 600);
        startPan(e);
      }
      return;
    }

    if (e.button === 1 || (e.button === 0 && spaceHeld)) {
      e.preventDefault();
      startPan(e);
      return;
    }
    if (e.button === 0 && drawMode) {
      e.preventDefault();
      startStroke(e);
      return;
    }
    if (e.button === 0) {

      const now = performance.now();
      const last = lastCanvasDown.current;
      lastCanvasDown.current = { t: now, x: e.clientX, y: e.clientY };
      if (last && now - last.t < 400 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 8) {
        e.preventDefault();
        startDblHoldPan(e);
        return;
      }
      startMarquee(e);
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    if (e.target !== outerRef.current && e.target !== worldRef.current) return;
    e.preventDefault();
    const w = clientToWorld(e.clientX, e.clientY);
    useAppStore.getState().openContextMenu({
      kind: 'canvas',
      x: e.clientX,
      y: e.clientY,
      wx: w?.x ?? 0,
      wy: w?.y ?? 0,
    });
  };

  const topLevel = board ? board.cards.filter((c) => !findColumnOf(board, c.id)) : [];

  return (
    <div
      ref={outerRef}
      data-canvas-root
      className="absolute inset-0 overflow-hidden"
      style={{
        touchAction: 'none',
        backgroundColor: 'var(--canvas-bg)',
        backgroundImage:
          'radial-gradient(130% 115% at 50% 40%, var(--canvas-glow, transparent) 0%, transparent 55%),' +
          'radial-gradient(150% 130% at 50% 55%, transparent 55%, var(--canvas-vignette, transparent) 100%)',
      }}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      <div
        ref={worldRef}
        className="absolute left-1/2 top-1/2 h-0 w-0"
        style={{ transformOrigin: '0 0' }}
      >
        <Connections boardId={boardId} />
        {}
        <svg className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-visible">
          <g ref={draftLayerRef} />
          <g
            ref={livePathRef}
            style={{ display: 'none' }}
          />
        </svg>
        {topLevel.map((c) => (
          <CardView key={c.id} cardId={c.id} boardId={boardId} />
        ))}
      </div>

      {}
      <DrawPanel boardId={boardId} />

      {marquee ? (
        <div
          className="marquee absolute z-40 rounded-[2px]"
          style={{
            left: Math.min(marquee.x0, marquee.x1),
            top: Math.min(marquee.y0, marquee.y1),
            width: Math.abs(marquee.x1 - marquee.x0),
            height: Math.abs(marquee.y1 - marquee.y0),
            border: '1px solid var(--accent)',
            background: 'color-mix(in srgb, var(--accent) 10%, transparent)',
            pointerEvents: 'none',
          }}
        />
      ) : null}
    </div>
  );
}

// Навигация к блоку: центрируем вид на карточке и подсвечиваем её.
export function focusCard(boardId: string, cardId: string) {
  const st = useAppStore.getState();
  const board = st.boards[boardId];
  if (!board) return;
  const card = board.cards.find((c) => c.id === cardId);
  if (!card) return;
  const m = measuredSizes.get(cardId);
  const h = m?.h ?? card.h;
  const cx = card.x + card.w / 2;
  const cy = card.y + h / 2;
  const zoom = canvasHandle.zoom || 1;
  // Слой листа уже привязан к центру экрана (left-1/2 top-1/2), поэтому
  // центр карточки совмещается с ним напрямую, без добавления половины окна.
  const v: Viewport = {
    x: -cx * zoom,
    y: -cy * zoom,
    zoom,
  };
  applyVp(v);
  st.setViewport(boardId, { ...v });
  st.setSelection([cardId]);
  // короткая вспышка на карточке
  const el = document.querySelector(`[data-card-id="${cardId}"]`);
  if (el instanceof HTMLElement) {
    el.classList.add('card-flash');
    window.setTimeout(() => el.classList.remove('card-flash'), 1200);
  }
}

// Все входящие ссылки на блок: карточки, чей текст ссылается на #block:<id>
export function getBacklinks(boardId: string, cardId: string): { cardId: string; title: string; snippet: string; type: string }[] {
  const st = useAppStore.getState();
  const board = st.boards[boardId];
  if (!board) return [];
  const out: { cardId: string; title: string; snippet: string; type: string }[] = [];
  const marker = `#block:${cardId}`;
  for (const c of board.cards) {
    if (c.id === cardId) continue;
    if (c.data.kind === 'note' || c.data.kind === 'text') {
      const text = c.data.text || '';
      const i = text.indexOf(marker);
      if (i !== -1) {
        out.push({
          cardId: c.id,
          title: text.slice(0, 40).replace(/\n/g, ' ').trim(),
          snippet: text.slice(Math.max(0, i - 60), i).replace(/\n/g, ' ').trim(),
          type: c.type,
        });
      }
    }
  }
  return out;
}
