import type { NoteColor } from './types';

export type ThemeId =
  | 'vanilla'
  | 'vanilla-dark'
  | 'vanilla-black'
  | 'academic'
  | 'academic-dark'
  | 'kinopio'
  | 'stylish'
  | 'stylish-dark'
  | 'simple'
  | 'simple-dark'
  | 'ordinary'
  | 'ordinary-dark';

export const THEME_IDS: ThemeId[] = [
  'vanilla',
  'vanilla-dark',
  'vanilla-black',
  'academic',
  'academic-dark',
  'kinopio',
  'stylish',
  'stylish-dark',
  'simple',
  'simple-dark',
  'ordinary',
  'ordinary-dark',
];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEME_IDS.includes(v as ThemeId);
}

export interface ThemeMeta {
  name: string;
  hint: string;
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  vanilla: { name: 'Ванильная', hint: 'Светлый лист в жёлтую клетку и мягкие тени. Рабочий день без драмы.' },
  'vanilla-dark': { name: 'Ванильная тёмная', hint: 'Графитовая клетка, синий акцент и ночной режим без шифра.' },
  'vanilla-black': { name: 'Абсолютно чёрная', hint: 'Чёрный холст с бирюзовыми волнами. Пиксели отдыхают.' },
  academic: { name: 'Академическая', hint: 'Мятный фон в синюю пиксельную сетку: мысли сами выстраиваются.' },
  'academic-dark': { name: 'Академическая тёмная', hint: 'Тёмно-зелёный стол в белую пиксельную сетку. Линейка прилагается мысленно.' },
  kinopio: { name: 'Тёплая', hint: 'Кремовый холст с тёплыми штампами. Порядок — по настроению.' },

  stylish: { name: 'Стильная', hint: 'Лавандовый холст с алыми крестиками и выразительным акцентом.' },
  'stylish-dark': { name: 'Стильная тёмная', hint: 'Полночная синева, алые крестики и слоистые тени.' },
  simple: { name: 'Простенькая', hint: 'Светлый холст в тонкую полоску и парящие карточки. Ничего лишнего.' },
  'simple-dark': { name: 'Простенькая тёмная', hint: 'Тёмный холст в тонкую полоску и спокойные карточки. Процессор выдыхает.' },
  ordinary: { name: 'Обычная', hint: 'Бумажный тон и коричневые треугольники. Ничего не отвлекает.' },
  'ordinary-dark': { name: 'Обычная тёмная', hint: 'Бордо и розовые треугольники. Спокойно, но не скучно.' },
};

export const THEME_BOOT_MS = 900;

export interface NoteColorSpec {
  bg: string;
  border: string;
  /** цвет текста для этого цвета блока (если не задан — берётся тема) */
  fg?: string;
}

export type NotePalette = Record<NoteColor, NoteColorSpec>;

export const NOTE_PALETTES: Record<ThemeId, NotePalette> = {
  vanilla: {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#C3C5EC', border: '#6667AB' },
    magenta: { bg: '#EFAFC1', border: '#BB2649' },
    peach: { bg: '#FFDCC7', border: '#E8996B' },
    mocha: { bg: '#DCC7B8', border: '#A47864' },
    'classic-blue': { bg: '#B3CBEA', border: '#0F4C81' },
    coral: { bg: '#FFB8AE', border: '#FF6F61' },
    yellow: { bg: '#F9E880', border: '#D9BE1E' },
    gray: { bg: '#DDDFE0', border: '#939597' },
    greenery: { bg: '#BCD493', border: '#88B04B' },
    marsala: { bg: '#D8ABA9', border: '#964F4C' },
  },
  'vanilla-dark': {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#3E4272', border: '#8284C0' },
    magenta: { bg: '#6B2B40', border: '#C4607F' },
    peach: { bg: '#6B4329', border: '#D08B57' },
    mocha: { bg: '#543A2B', border: '#A47864' },
    'classic-blue': { bg: '#1F3A5C', border: '#5B8BC4' },
    coral: { bg: '#6B3630', border: '#F08A7F' },
    yellow: { bg: '#5C5118', border: '#D3BC45' },
    gray: { bg: '#3A4046', border: '#7C848C' },
    greenery: { bg: '#3C5222', border: '#88B04B' },
    marsala: { bg: '#542F2D', border: '#B57773' },
  },
  'vanilla-black': {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#10101F', border: '#5A5C96' },
    magenta: { bg: '#1C0A10', border: '#8F3A56' },
    peach: { bg: '#1C110A', border: '#8F5533' },
    mocha: { bg: '#160E08', border: '#7C5643' },
    'classic-blue': { bg: '#0A1520', border: '#426E9E' },
    coral: { bg: '#1C0D0B', border: '#A65B50' },
    yellow: { bg: '#161205', border: '#8F7E2E' },
    gray: { bg: '#141618', border: '#4E565E' },
    greenery: { bg: '#0E1508', border: '#5A7631' },
    marsala: { bg: '#180B0A', border: '#7E4A47' },
  },
  academic: {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#E1E1F5', border: '#6667AB' },
    magenta: { bg: '#F7D5DE', border: '#BB2649' },
    peach: { bg: '#FFE8D9', border: '#E8996B' },
    mocha: { bg: '#EDDFD5', border: '#A47864' },
    'classic-blue': { bg: '#D5E2F2', border: '#0F4C81' },
    coral: { bg: '#FFD9D3', border: '#FF6F61' },
    yellow: { bg: '#FAF3CF', border: '#D6B656' },
    gray: { bg: '#F0F1F1', border: '#939597' },
    greenery: { bg: '#DFEBCB', border: '#88B04B' },
    marsala: { bg: '#EDD5D4', border: '#964F4C' },
  },
  'academic-dark': {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#34375C', border: '#8284C0' },
    magenta: { bg: '#55222F', border: '#C4607F' },
    peach: { bg: '#523018', border: '#D08B57' },
    mocha: { bg: '#3F2C20', border: '#A47864' },
    'classic-blue': { bg: '#1A3050', border: '#5B8BC4' },
    coral: { bg: '#52241E', border: '#F08A7F' },
    yellow: { bg: '#4A3F1E', border: '#B39B4A' },
    gray: { bg: '#333537', border: '#7C848C' },
    greenery: { bg: '#2C3E18', border: '#88B04B' },
    marsala: { bg: '#432422', border: '#B57773' },
  },
  kinopio: {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#D6D8F5', border: 'rgba(0,0,0,0.30)' },
    magenta: { bg: '#FAD0DD', border: 'rgba(0,0,0,0.30)' },
    peach: { bg: '#FFE3D0', border: 'rgba(0,0,0,0.30)' },
    mocha: { bg: '#E8D8CB', border: 'rgba(0,0,0,0.30)' },
    'classic-blue': { bg: '#C7DCF5', border: 'rgba(0,0,0,0.30)' },
    coral: { bg: '#FFC9C1', border: 'rgba(0,0,0,0.30)' },
    yellow: { bg: '#FDDD88', border: 'rgba(0,0,0,0.30)' },
    gray: { bg: '#E3E3E3', border: 'rgba(0,0,0,0.30)' },
    greenery: { bg: '#D8EF7C', border: 'rgba(0,0,0,0.30)' },
    marsala: { bg: '#E9C2C0', border: 'rgba(0,0,0,0.30)' },
  },
  stylish: {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#C3C5EC', border: 'transparent' },
    magenta: { bg: '#EFAFC1', border: 'transparent' },
    peach: { bg: '#FFDCC7', border: 'transparent' },
    mocha: { bg: '#DCC7B8', border: 'transparent' },
    'classic-blue': { bg: '#B3CBEA', border: 'transparent' },
    coral: { bg: '#FFB8AE', border: 'transparent' },
    yellow: { bg: '#F9E880', border: 'transparent' },
    gray: { bg: '#DDDFE0', border: 'transparent' },
    greenery: { bg: '#BCD493', border: 'transparent' },
    marsala: { bg: '#D8ABA9', border: 'transparent' },
  },
  'stylish-dark': {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#8B8DC4', border: 'transparent' },
    magenta: { bg: '#C9738B', border: 'transparent' },
    peach: { bg: '#D08A5C', border: 'transparent' },
    mocha: { bg: '#A47864', border: 'transparent' },
    'classic-blue': { bg: '#5F88B8', border: 'transparent' },
    coral: { bg: '#D96F60', border: 'transparent' },
    yellow: { bg: '#E9BC3F', border: 'transparent' },
    gray: { bg: '#5F6672', border: 'transparent' },
    greenery: { bg: '#6CC245', border: 'transparent' },
    marsala: { bg: '#B06B67', border: 'transparent' },
  },
  simple: {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#C3C5EC', border: '#6667AB' },
    magenta: { bg: '#EFAFC1', border: '#BB2649' },
    peach: { bg: '#FFDCC7', border: '#E8996B' },
    mocha: { bg: '#DCC7B8', border: '#A47864' },
    'classic-blue': { bg: '#B3CBEA', border: '#0F4C81' },
    coral: { bg: '#FFB8AE', border: '#FF6F61' },
    yellow: { bg: '#F9E880', border: '#D9BE1E' },
    gray: { bg: '#DDDFE0', border: '#939597' },
    greenery: { bg: '#BCD493', border: '#88B04B' },
    marsala: { bg: '#D8ABA9', border: '#964F4C' },
  },
  'simple-dark': {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#3E4272', border: '#8284C0' },
    magenta: { bg: '#6B2B40', border: '#C4607F' },
    peach: { bg: '#6B4329', border: '#D08B57' },
    mocha: { bg: '#543A2B', border: '#A47864' },
    'classic-blue': { bg: '#1F3A5C', border: '#5B8BC4' },
    coral: { bg: '#6B3630', border: '#F08A7F' },
    yellow: { bg: '#5C5118', border: '#D3BC45' },
    gray: { bg: '#3A4046', border: '#7C848C' },
    greenery: { bg: '#3C5222', border: '#88B04B' },
    marsala: { bg: '#542F2D', border: '#B57773' },
  },
  ordinary: {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#C3C5EC', border: '#6667AB' },
    magenta: { bg: '#EFAFC1', border: '#BB2649' },
    peach: { bg: '#FFDCC7', border: '#E8996B' },
    mocha: { bg: '#DCC7B8', border: '#A47864' },
    'classic-blue': { bg: '#B3CBEA', border: '#0F4C81' },
    coral: { bg: '#FFB8AE', border: '#FF6F61' },
    yellow: { bg: '#F9E880', border: '#D9BE1E' },
    gray: { bg: '#DDDFE0', border: '#939597' },
    greenery: { bg: '#BCD493', border: '#88B04B' },
    marsala: { bg: '#D8ABA9', border: '#964F4C' },
  },
  'ordinary-dark': {
    notebook: { bg: '#D6BFA3', border: '#8F7358' },
    peri: { bg: '#3E4272', border: '#8284C0' },
    magenta: { bg: '#6B2B40', border: '#C4607F' },
    peach: { bg: '#6B4329', border: '#D08B57' },
    mocha: { bg: '#543A2B', border: '#A47864' },
    'classic-blue': { bg: '#1F3A5C', border: '#5B8BC4' },
    coral: { bg: '#6B3630', border: '#F08A7F' },
    yellow: { bg: '#5C5118', border: '#D3BC45' },
    gray: { bg: '#3A4046', border: '#7C848C' },
    greenery: { bg: '#3C5222', border: '#88B04B' },
    marsala: { bg: '#542F2D', border: '#B57773' },
  },
};

export function notePalette(theme: ThemeId): NotePalette {
  const palette = NOTE_PALETTES[theme] ?? NOTE_PALETTES.vanilla;
  // «Тетрадный» цвет светлый во всех темах, поэтому текст на нём всегда тёмный.
  return { ...palette, notebook: { ...palette.notebook, fg: '#2b1f14' } };
}

export const NOTE_LABELS: Record<NoteColor, string> = {
  notebook: 'Тетрадный',
  peri: 'Пери',
  magenta: 'Маджента',
  peach: 'Персик',
  mocha: 'Мокко',
  'classic-blue': 'Синий',
  coral: 'Коралл',
  yellow: 'Жёлтый',
  gray: 'Серый',
  greenery: 'Зелень',
  marsala: 'Марсала',
};

export function isDrawioTheme(theme: ThemeId): boolean {
  return theme === 'academic' || theme === 'academic-dark';
}
