// «Резиновые» карточки (по мотивам kinopio, useStickyCard.js):
// при наведении и паузе карточка мягко тянется к курсору — сопротивление
// зависит от площади, при уходе курсора — пружинный отскок (Web Animations API).
// Включается только в теме «Кинопио».

export interface StickyHandle {
  /** курсор вошёл в карточку — начинаем отсчёт до «прилипания» */
  enter: () => void;
  /** курсор движется внутри карточки */
  move: (e: PointerEvent) => void;
  /** курсор ушёл — пружинный возврат */
  leave: () => void;
  /** мгновенный сброс без анимации (начался drag) */
  reset: () => void;
  dispose: () => void;
}

const reducedMotion = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function attachSticky(
  el: HTMLElement,
  isActive: () => boolean
): StickyHandle {
  let timer: number | null = null;
  let armed = false;
  let disposed = false;

  const clearTransform = () => {
    el.style.transform = '';
    el.style.willChange = '';
  };

  const currentTransform = () => el.style.transform || 'translate(0px, 0px)';

  const release = (spring: boolean) => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    armed = false;
    window.removeEventListener('pointermove', onMove);
    if (!spring) {
      clearTransform();
      return;
    }
    const m = currentTransform().match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
    if (!m) return;
    const tx = parseFloat(m[1]);
    const ty = parseFloat(m[2]);
    if (!tx && !ty) return;
    // пружинный отскок kinopio: серия затухающих качаний
    const swings = [-1, 0.7, -0.45, 0.25, -0.1, 0];
    const frames = swings.map((k) => ({ transform: `translate(${tx * k}px, ${ty * k}px)` }));
    el.animate(frames, { duration: 620, easing: 'ease-out' });
    el.style.transform = '';
  };

  function onMove(e: PointerEvent) {
    if (!armed || disposed) return;
    if (!isActive()) {
      release(false);
      return;
    }
    // не тянемся над кнопками/полями внутри карточки
    if ((e.target as HTMLElement)?.closest?.('[data-nodrag]')) {
      el.style.transform = '';
      return;
    }
    const rect = el.getBoundingClientRect();
    const halfW = rect.width / 2;
    const halfH = rect.height / 2;
    if (halfW < 4 || halfH < 4) return;
    const xPercent = Math.max(-1.3, Math.min(1.3, (e.clientX - (rect.left + halfW)) / halfW));
    const yPercent = Math.max(-1.3, Math.min(1.3, (e.clientY - (rect.top + halfH)) / halfH));
    // «жёсткость» от площади: большие карточки сопротивляются сильнее
    const resistance = Math.max(5, Math.sqrt(rect.width * rect.height) / 22);
    // усиленный мягкий эффект (×1.8 к оригиналу)
    const tx = (xPercent * halfW) / (resistance / 1.8);
    const ty = (yPercent * halfH) / (resistance / 1.8);
    el.style.willChange = 'transform';
    el.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px)`;
  }

  const handle = {
    enter: () => {
      if (disposed || armed || reducedMotion()) return;
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (disposed || !isActive()) return;
        armed = true;
        window.addEventListener('pointermove', onMove);
      }, 250);
    },
    move: (e: PointerEvent) => onMove(e),
    leave: () => release(true),
    reset: () => release(false),
    dispose: () => {
      disposed = true;
      release(false);
    },
  };
  return handle;
}
