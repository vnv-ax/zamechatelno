// Фильтры изображений на настоящих шейдерах paper.design
// (@paper-design/shaders, Apache-2.0 — github.com/paper-design/shaders).
// Пресеты «Дефолт»/«Винтаж» и «Ретро»/«Натурал» — официальные варианты
// со страниц https://shaders.paper.design/halftone-cmyk и /image-dithering.

import {
  ShaderMount,
  halftoneCmykFragmentShader,
  imageDitheringFragmentShader,
  defaultObjectSizing,
  ShaderFitOptions,
  getShaderColorFromString,
  getShaderNoiseTexture,
  HalftoneCmykTypes,
  DitheringTypes,
} from '@paper-design/shaders';
import type { ImageFilterId } from './types';

export const IMAGE_FILTERS: { id: ImageFilterId; label: string }[] = [
  { id: 'original', label: 'Оригинал' },
  { id: 'halftone', label: 'Дефолт' },
  { id: 'halftone-vintage', label: 'Винтаж' },
  { id: 'dither-retro', label: 'Ретро' },
  { id: 'dither-natural', label: 'Натурал' },
];

const MAX_SIDE = 1024;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Не удалось прочитать изображение'));
    img.src = src;
  });
}

function fitSize(w: number, h: number, maxSide = MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * scale)), h: Math.max(1, Math.round(h * scale)) };
}

/** Рендерит шейдер в один кадр и снимает PNG */
function renderOneShot(
  fragmentShader: string,
  uniforms: Record<string, unknown>,
  width: number,
  height: number
): Promise<string> {
  return new Promise((resolve, reject) => {
    const holder = document.createElement('div');
    holder.style.cssText = `position:fixed;left:-99999px;top:0;width:${width}px;height:${height}px;overflow:hidden;`;
    document.body.appendChild(holder);
    let mount: ShaderMount | null = null;
    try {
      mount = new ShaderMount(
        holder,
        fragmentShader,
        uniforms as never,
        { preserveDrawingBuffer: true },
        0, // speed = 0 — статичный кадр
        0, // frame = 0 — детерминированный результат
        1  // pixel ratio = 1: канвас ровно размером картинки
      );
    } catch (e) {
      holder.remove();
      reject(e);
      return;
    }
    // два кадра: resize-observer и первый рендер
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        try {
          const url = mount!.canvasElement.toDataURL('image/png');
          mount!.dispose();
          holder.remove();
          resolve(url);
        } catch (e) {
          mount!.dispose();
          holder.remove();
          reject(e);
        }
      })
    );
  });
}

const sizingUniforms = (w: number, h: number) => {
  const s = defaultObjectSizing;
  return {
    u_fit: ShaderFitOptions[s.fit],
    u_scale: s.scale,
    u_rotation: s.rotation,
    u_originX: s.originX,
    u_originY: s.originY,
    u_offsetX: s.offsetX,
    u_offsetY: s.offsetY,
    u_worldWidth: s.worldWidth,
    u_worldHeight: s.worldHeight,
    u_resolution: [w, h],
  };
};

// Официальные пресеты halftone-cmyk (Default и Vintage)
const halftoneUniforms = (img: HTMLImageElement, noise: HTMLImageElement, variant: 'default' | 'vintage') => {
  const c = getShaderColorFromString;
  const common = {
    u_image: img,
    u_imageAspectRatio: img.naturalWidth / img.naturalHeight,
    u_noiseTexture: noise,
    ...sizingUniforms(img.naturalWidth, img.naturalHeight),
  };
  if (variant === 'vintage') {
    return {
      ...common,
      u_colorBack: c('#fffaf0'),
      u_colorC: c('#59afc5'),
      u_colorM: c('#d8697c'),
      u_colorY: c('#fad85c'),
      u_colorK: c('#2d2824'),
      u_size: 0.2,
      u_contrast: 1.25,
      u_softness: 0.4,
      u_grainSize: 0.5,
      u_grainMixer: 0.15,
      u_grainOverlay: 0.1,
      u_gridNoise: 0.45,
      u_floodC: 0.15,
      u_floodM: 0,
      u_floodY: 0,
      u_floodK: 0,
      u_gainC: 0.3,
      u_gainM: 0,
      u_gainY: 0.2,
      u_gainK: 0,
      u_type: HalftoneCmykTypes.sharp,
    };
  }
  return {
    ...common,
    u_colorBack: c('#fbfaf5'),
    u_colorC: c('#00b4ff'),
    u_colorM: c('#fc519f'),
    u_colorY: c('#ffd800'),
    u_colorK: c('#231f20'),
    u_size: 0.2,
    u_contrast: 1,
    u_softness: 1,
    u_grainSize: 0.5,
    u_grainMixer: 0,
    u_grainOverlay: 0,
    u_gridNoise: 0.2,
    u_floodC: 0.15,
    u_floodM: 0,
    u_floodY: 0,
    u_floodK: 0,
    u_gainC: 0.3,
    u_gainM: 0,
    u_gainY: 0.2,
    u_gainK: 0,
    u_type: HalftoneCmykTypes.ink,
  };
};

// Официальные пресеты image-dithering (Retro и Natural)
const ditheringUniforms = (img: HTMLImageElement, variant: 'retro' | 'natural') => {
  const c = getShaderColorFromString;
  const base = {
    u_image: img,
    u_imageAspectRatio: img.naturalWidth / img.naturalHeight,
    ...sizingUniforms(img.naturalWidth, img.naturalHeight),
  };
  if (variant === 'retro') {
    return {
      ...base,
      u_colorFront: c('#eeeeee'),
      u_colorBack: c('#5452ff'),
      u_colorHighlight: c('#eeeeee'),
      u_type: DitheringTypes['2x2'],
      u_pxSize: 3,
      u_colorSteps: 1,
      u_originalColors: true,
      u_inverted: false,
    };
  }
  return {
    ...base,
    u_colorFront: c('#ffffff'),
    u_colorBack: c('#000000'),
    u_colorHighlight: c('#ffffff'),
    u_type: DitheringTypes['8x8'],
    u_pxSize: 2,
    u_colorSteps: 5,
    u_originalColors: true,
    u_inverted: false,
  };
};

let noiseTexturePromise: Promise<HTMLImageElement> | null = null;
async function getNoiseTexture(): Promise<HTMLImageElement> {
  noiseTexturePromise ??= loadImage(getShaderNoiseTexture()!.src);
  return noiseTexturePromise;
}

export async function applyImageFilter(src: string, id: ImageFilterId): Promise<string> {
  if (id === 'original') return src;
  const img = await loadImage(src);
  const { w, h } = fitSize(img.naturalWidth, img.naturalHeight);

  // Canvas рендерится в размере изображения: масштабируем сам элемент,
  // передавая исходное соотношение сторон.
  let out: string;
  if (id === 'halftone' || id === 'halftone-vintage') {
    out = await renderOneShot(
      halftoneCmykFragmentShader,
      halftoneUniforms(img, await getNoiseTexture(), id === 'halftone' ? 'default' : 'vintage'),
      w,
      h
    );
  } else if (id === 'dither-retro' || id === 'dither-natural') {
    out = await renderOneShot(
      imageDitheringFragmentShader,
      ditheringUniforms(img, id === 'dither-retro' ? 'retro' : 'natural'),
      w,
      h
    );
  } else {
    out = src;
  }
  return out;
}
