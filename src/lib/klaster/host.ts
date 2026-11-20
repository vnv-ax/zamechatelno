// Мост к обёртке (WebView2 host): сайт просит хранилище сохранить/отдать данные.
// В браузерной версии (без обёртки) bridge недоступен — используется localStorage.

type WebViewMessageEvent = { data: { id: number; ok: boolean; data?: string; error?: string } };
type WebView = {
  postMessage: (msg: unknown) => void;
  addEventListener: (type: 'message', cb: (e: WebViewMessageEvent) => void) => void;
};

function getWebView(): WebView | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { chrome?: { webview?: WebView } };
  if (w.chrome?.webview?.postMessage) return w.chrome.webview;
  return null;
}

export function hostAvailable(): boolean {
  return getWebView() !== null;
}

const pending = new Map<number, { resolve: (v: string) => void; reject: (e: Error) => void }>();
let seq = 0;
let wired = false;

function ensureListener(): void {
  const wv = getWebView();
  if (!wv || wired) return;
  wired = true;
  wv.addEventListener('message', (e) => {
    const msg = e?.data;
    if (!msg || typeof msg.id !== 'number') return;
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.ok) p.resolve(msg.data ?? '');
    else p.reject(new Error(msg.error || 'Ошибка хранилища'));
  });
}

export function hostCall(op: 'load' | 'save' | 'export', payload?: string): Promise<string> {
  const wv = getWebView();
  if (!wv) return Promise.reject(new Error('Обёртка недоступна'));
  ensureListener();
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    wv.postMessage({ id, op, payload });
    window.setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error('Таймаут хранилища'));
      }
    }, 20000);
  });
}
