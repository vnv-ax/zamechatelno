'use client';

import { flushSync } from 'react-dom';

/**
 * Тип анимации перехода между экранами.
 * Сейчас единственная анимация — 'bokeh' (Bokeh Dissolve из gl-transitions):
 * уходящий экран расфокусируется в мягкие светящиеся диски, приходящий
 * наводится на резкость из собственного боке. Реализация — в globals.css
 * (секция «Анимации перехода»).
 */
export type ViewTransitionKind = 'bokeh';

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
