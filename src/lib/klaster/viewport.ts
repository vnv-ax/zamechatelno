// Viewport-рендеринг (по мотивам kinopio, useViewportObserver + useFrameTaskQueue):
// карточки за пределами листа (с запасом) рисуются лёгкой заглушкой, чтобы тяжёлые
// листы не тормозили. Один IntersectionObserver на все карточки, запас (rootMargin)
// зависит от зума, появление — порциями по кадрам, чтобы «кататься» было быстро.

import { canvasHandle } from './canvasHandle';

type Entry = {
  el: HTMLElement;
  visible: boolean;
  listeners: Set<(v: boolean) => void>;
};

const entries = new Map<string, Entry>();
let observer: IntersectionObserver | null = null;
let observerRoot: HTMLElement | null = null;

let version = 0;
const versionListeners = new Set<() => void>();

// очередь появления: не больше 10 карточек за кадр
const revealQueue: string[] = [];
let revealRaf = 0;
const REVEAL_PER_FRAME = 10;

function notify() {
  version++;
  versionListeners.forEach((f) => f());
}

function pump() {
  revealRaf = 0;
  const batch = revealQueue.splice(0, REVEAL_PER_FRAME);
  for (const key of batch) {
    const e = entries.get(key);
    if (!e || e.visible) continue;
    e.visible = true;
    e.listeners.forEach((f) => f(true));
  }
  if (revealQueue.length) revealRaf = requestAnimationFrame(pump);
  else notify();
}

function currentRoot(): HTMLElement | null {
  return canvasHandle.outer ?? null;
}

function ensureObserver(): IntersectionObserver {
  const root = currentRoot();
  if (observer && observerRoot === root) return observer;
  if (observer) observer.disconnect();
  observerRoot = root;
  observer = new IntersectionObserver(
    (items) => {
      let changed = false;
      for (const item of items) {
        const key = (item.target as HTMLElement).dataset.vpKey;
        if (!key) continue;
        const e = entries.get(key);
        if (!e) continue;
        const now = item.isIntersecting;
        if (now === e.visible) continue;
        if (now) {
          // появление — через очередь кадров (быстрый пан без фризов)
          if (!revealQueue.includes(key)) revealQueue.push(key);
          if (!revealRaf) revealRaf = requestAnimationFrame(pump);
        } else {
          e.visible = false;
          e.listeners.forEach((f) => f(false));
          changed = true;
        }
      }
      if (changed || revealQueue.length) notify();
    },
    // запас вокруг листа: 3 экрана по горизонтали/вертикали — быстрый пан не успевает
    // оголить видимую зону, а далеко разлетевшиеся карточки всё же гасятся
    { root: root ?? null, rootMargin: '300% 300% 300% 300%' }
  );
  for (const [key, e] of entries) {
    e.el.dataset.vpKey = key;
    observer.observe(e.el);
  }
  return observer;
}

/** Следить за карточкой. Возвращает отписку. cb вызывается при смене видимости. */
export function observeCardVisibility(
  key: string,
  el: HTMLElement,
  cb: (visible: boolean) => void
): () => void {
  let e = entries.get(key);
  if (!e) {
    e = { el, visible: true, listeners: new Set() };
    entries.set(key, e);
    e.el.dataset.vpKey = key;
    ensureObserver().observe(el);
  }
  e.listeners.add(cb);
  return () => {
    e.listeners.delete(cb);
    if (!e.listeners.size) {
      observer?.unobserve(el);
      entries.delete(key);
    }
  };
}

/** Синхронное чтение видимости (для связей: связь рисуем, если виден хоть один конец) */
export function isCardVisibleSync(cardId: string): boolean {
  return entries.get('card:' + cardId)?.visible ?? true;
}

/** Подписка на «кто-то сменил видимость» — для перерисовки связей */
export function subscribeViewportVersion(cb: () => void): () => void {
  versionListeners.add(cb);
  return () => versionListeners.delete(cb);
}

export function getViewportVersion(): number {
  return version;
}
