'use client';

import { flushSync } from 'react-dom';

/**
 * Тип анимации перехода между экранами.
 * У каждой темы — своя манера (см. globals.css, секция
 * «Уникальные анимации тем»):
 *  - bokeh  — «Кинопио»: расфокус в боке и наводка на резкость;
 *  - iris   — «Академическая»: строгое сжатие с расфокусом;
 *  - paper  — «Академическая светлая»: лист уезжает вверх;
 *  - pop    — «Шао-ми»: пружинный въезд с перелётом;
 *  - ember  — «Шао-ми ночь»: тление через тепло и блюр;
 *  - swoosh — «Миюай»: горизонтальный слайд;
 *  - ion    — «Миюай ночь»: пульс свечения;
 *  - term   — «Линь»: мгновенная смена кадра;
 *  - scan   — «Линь тёмная»: прорисовка сверху, как развёртка;
 *  - plain  — «Простенькая»: честный кроссфейд;
 *  - breeze — «Тетрадная»: долгий нежный туман.
 */
export type ViewTransitionKind =
  | 'bokeh'
  | 'iris'
  | 'paper'
  | 'pop'
  | 'ember'
  | 'swoosh'
  | 'ion'
  | 'term'
  | 'scan'
  | 'plain'
  | 'breeze';

interface ViewTransitionLike {
  finished: Promise<void>;
}

type StartViewTransition = (callback: () => void) => ViewTransitionLike;

let running = false;

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Применяет изменение состояния (`update`) внутри анимации перехода.
 * Браузер снимает кадры «до»/«после», а маски заданы в CSS.
 * Если API недоступен или включён режим «меньше движения» — просто применяет изменение.
 */
export function runViewTransition(kind: ViewTransitionKind, update: () => void) {
  if (typeof document === 'undefined') {
    update();
    return;
  }

  const doc = document as unknown as { startViewTransition?: StartViewTransition };
  const start = doc.startViewTransition;

  if (!start || running || prefersReducedMotion()) {
    update();
    return;
  }

  running = true;
  const root = document.documentElement;
  root.dataset.vt = kind;

  let applied = false;
  const apply = () => {
    if (applied) return;
    applied = true;
    update();
  };

  const done = () => {
    running = false;
    delete root.dataset.vt;
  };

  try {
    const transition = start.call(doc, () => {
      // flushSync нужен, чтобы React успел перерисовать новый экран до снимка «после».
      try {
        flushSync(apply);
      } catch {
        apply();
      }
    });
    transition.finished.then(done, done);
  } catch {
    apply();
    done();
  }
}
