// Подготовка изображений к хранению внутри листа.
//
// Блоки хранят картинки как data:-URL прямо в JSON состояния. Если оставить
// исходный файл как есть, один скриншот легко превращается в 5–10 МБ base64:
// такой JSON медленно парсится, медленно клонируется и целиком пишется на диск
// при каждом изменении. Поэтому перед сохранением уменьшаем сторону и
// подбираем качество так, чтобы картинка укладывалась в бюджет по байтам.

export const MAX_IMAGE_SIDE = 1280;
export const MAX_IMAGE_SRC_BYTES = 220 * 1024;
export const MAX_PHOTO_SIDE = 900;
export const MAX_PHOTO_BYTES = 160 * 1024;

export interface OptimizeImageOptions {
  maxSide?: number;
  maxBytes?: number;
}

/** Приблизительный размер бинарных данных в data:-URL (без учёта заголовка). */
export function dataUrlBytes(src: string): number {
  const comma = src.indexOf(',');
  return comma < 0 ? src.length : Math.floor(((src.length - comma - 1) * 3) / 4);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = src;
  });
}

let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    webpSupport = canvas.toDataURL('image/webp').startsWith('data:image/webp');
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

/**
 * Уменьшает/пережимает data:-картинку до разумных размеров.
 * Если картинка уже небольшая — возвращает исходную строку без перекодирования.
 */
export async function optimizeImageDataUrl(
  src: string,
  { maxSide = MAX_IMAGE_SIDE, maxBytes = MAX_IMAGE_SRC_BYTES }: OptimizeImageOptions = {}
): Promise<string> {
  if (typeof document === 'undefined') return src;
  if (!src.startsWith('data:image/')) return src;
  // SVG и GIF перекодировать нельзя: потеряется вектор/анимация.
  if (src.startsWith('data:image/svg') || src.startsWith('data:image/gif')) return src;

  const beforeBytes = dataUrlBytes(src);
  let img: HTMLImageElement;
  try {
    img = await loadImage(src);
  } catch {
    return src;
  }

  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) return src;

  const initialScale = Math.min(1, maxSide / Math.max(nw, nh));
  const needsWork = beforeBytes > maxBytes || initialScale < 1;
  if (!needsWork) return src;

  const mime = supportsWebp() ? 'image/webp' : 'image/jpeg';
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { alpha: mime === 'image/webp' });
  if (!ctx) return src;

  let w = Math.max(1, Math.round(nw * initialScale));
  let h = Math.max(1, Math.round(nh * initialScale));
  let best = src;

  // Сначала снижаем качество, потом (если всё ещё много) — сторону.
  for (let attempt = 0; attempt < 8; attempt++) {
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    for (let quality = 0.9; quality >= 0.45; quality -= 0.1) {
      let out: string;
      try {
        out = canvas.toDataURL(mime, quality);
      } catch {
        return best === src ? src : best;
      }
      if (dataUrlBytes(out) < dataUrlBytes(best)) best = out;
      if (dataUrlBytes(out) <= maxBytes) return out;
    }

    if (w <= 32 || h <= 32) break;
    w = Math.max(1, Math.round(w * 0.8));
    h = Math.max(1, Math.round(h * 0.8));
  }

  // Перекодирование не дало выигрыша — оставляем оригинал.
  return dataUrlBytes(best) < beforeBytes ? best : src;
}
