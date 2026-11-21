

type TickFn = (now: number) => void;

const TICK_MS = 15_000;

const subs = new Set<TickFn>();
let timer: ReturnType<typeof setInterval> | null = null;

function ensureTimer() {
  if (timer) return;
  timer = setInterval(() => {
    const now = Date.now();
    for (const fn of subs) {
      try {
        fn(now);
      } catch {

      }
    }
  }, TICK_MS);

  const t = timer as unknown as { unref?: () => void };
  if (typeof t.unref === 'function') t.unref();
}

export function subscribeToTick(fn: TickFn): () => void {
  subs.add(fn);
  ensureTimer();
  return () => {
    subs.delete(fn);
    if (!subs.size && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}
