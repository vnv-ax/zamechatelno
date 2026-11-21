import type { NoteColor } from './types';

export type ThemeId =
  | 'tetrad'
  | 'tetrad-dark'
  | 'academic'
  | 'academic-light'
  | 'kinopio'
  | 'kinopio-dark'
  | 'apple'
  | 'apple-night'
  | 'lin'
  | 'lin-dark'
  | 'simple'
  | 'simple-dark'
  | 'shaomi'
  | 'shaomi-dark'
  | 'miuay'
  | 'miuay-dark';

export const THEME_IDS: ThemeId[] = [
  'tetrad',
  'tetrad-dark',
  'academic',
  'academic-light',
  'kinopio',
  'kinopio-dark',
  'apple',
  'apple-night',
  'lin',
  'lin-dark',
  'simple',
  'simple-dark',
  'shaomi',
  'shaomi-dark',
  'miuay',
  'miuay-dark',
];

export function isThemeId(v: unknown): v is ThemeId {
  return typeof v === 'string' && THEME_IDS.includes(v as ThemeId);
}

export interface ThemeMeta {
  name: string;
  hint: string;
}

export const THEME_META: Record<ThemeId, ThemeMeta> = {
  tetrad: { name: 'Тетрадная', hint: 'Тёплая бумага в клеточку, как страница тетради по математике. Акцент — красная линия полей!' },
  'tetrad-dark': { name: 'Тетрадная ночью', hint: 'Чёрная обложка общей тетради с тиснением — глубокая, тёплая, надёжная. Красная линия светится!' },
  'academic-light': { name: 'Академическая днём', hint: 'Дневной свет и стальной порядок: серый холст, белоснежные карточки. Идеально для ясной головы!' },
  academic: { name: 'Академическая ночью', hint: 'Глубокий уголь — карточки парят, как звёзды над бездной. Строго, величественно, как старая библиотека!' },
  lin: { name: 'Линь днём', hint: 'Плоско, остро, минималистично — скорость и порядок во всём. Ноль лишнего, максимум мыслей!' },
  'lin-dark': { name: 'Линь ночью', hint: 'Терминал на полночь: чёрный фон, синий акцент, магия командной строки. Для настоящих ниндзя клавиатуры!' },
  shaomi: { name: 'Шаоми днём', hint: 'Белый пластик и фирменный оранжевый: чистые линии, крупные скругления, живой и дружелюбный интерфейс!' },
  'shaomi-dark': { name: 'Шаоми ночью', hint: 'Тёплый графит с оранжевым огоньком: ночной режим, в котором хочется копать настройки до утра!' },
  apple: { name: 'Яблоневая днём', hint: 'Стекло на рассвете: матовые карточки, пастельные обои и свежий синий акцент. Лёгкость, как первый глоток утра!' },
  'apple-night': { name: 'Яблоневая ночью', hint: 'Чёрное стекло: тёмные матовые карточки и мягкое свечение обоев. Ночная витрина, от которой не оторваться!' },
  miuay: { name: 'Миюай днём', hint: 'Пастельные градиенты и сочный синий акцент: воздушные карточки и анимации, как у свежего смартфона!' },
  'miuay-dark': { name: 'Миюай ночью', hint: 'Глубокий ионный синий: светящиеся акценты, плавные градиенты и карточки, летящие в темноте!' },
  simple: { name: 'Персональная днём', hint: 'Горошинки на свету — база, которую ты пересобираешь под себя в «Сборке».' },
  'simple-dark': { name: 'Персональная ночью', hint: 'Горошинки в темноте — база, которую ты пересобираешь под себя в «Сборке».' },
  kinopio: { name: 'Кинопио', hint: 'Радужные липучки и резиновые карточки на белом в листиках. Потяни карточку — она пружинисто потянется!' },
  'kinopio-dark': { name: 'Кинопио ночь', hint: 'Вечерний лес: тёмно-коричневый холст, тёплые карточки и светлячок-фонарик в листве. Магия сумерек!' },
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
  // «канцелярская» палитра: реальные тона бумаги и стикеров,
  // рамка — тот же пигмент, но темнее (обводка ручкой)
  tetrad: {
    notebook: { bg: '#e8ddc8', border: '#a89272', fg: '#3a2e1e' },
    peri: { bg: '#d3cbdd', border: '#7a6f96', fg: '#322c42' },
    magenta: { bg: '#ecc6cf', border: '#a15a6e', fg: '#482730' },
    peach: { bg: '#f3d4b2', border: '#b3763f', fg: '#4a2e12' },
    mocha: { bg: '#d3b48c', border: '#86643d', fg: '#382a17' },
    'classic-blue': { bg: '#c6d7e8', border: '#55799c', fg: '#1f3247' },
    coral: { bg: '#eeb294', border: '#b06040', fg: '#462415' },
    yellow: { bg: '#f2e27c', border: '#b3a03a', fg: '#423a0c' },
    gray: { bg: '#dcdcd6', border: '#8c8c84', fg: '#333330' },
    greenery: { bg: '#cfd9b4', border: '#77893f', fg: '#2c3312' },
    marsala: { bg: '#d9b0a8', border: '#96544a', fg: '#421f1b' },
  },
  'tetrad-dark': {
    notebook: { bg: '#3d3626', border: '#b3975e', fg: '#efe6d2' },
    peri: { bg: '#3a3147', border: '#9c8cc4', fg: '#e2dcf0' },
    magenta: { bg: '#452832', border: '#cc7790', fg: '#f3d7df' },
    peach: { bg: '#443018', border: '#cf9156', fg: '#f6e0c6' },
    mocha: { bg: '#3b2f21', border: '#b08a5e', fg: '#ecdcc4' },
    'classic-blue': { bg: '#2a3546', border: '#7d9ec6', fg: '#dbe6f0' },
    coral: { bg: '#452920', border: '#d97760', fg: '#f8d5cb' },
    yellow: { bg: '#403816', border: '#d0bb5e', fg: '#f4e7bd' },
    gray: { bg: '#30312f', border: '#8f8f86', fg: '#e5e5df' },
    greenery: { bg: '#2d3a20', border: '#8ba658', fg: '#e0ecc9' },
    marsala: { bg: '#412b25', border: '#c98773', fg: '#f2d8ce' },
  },
  academic: {
    notebook: { bg: '#D6BFA3', border: '#8F7358', fg: '#2B2A26' },
    peri: { bg: '#E1E1F5', border: '#6667AB', fg: '#2E2E45' },
    magenta: { bg: '#F7D5DE', border: '#BB2649', fg: '#4A1F2A' },
    peach: { bg: '#FFE8D9', border: '#E8996B', fg: '#4A2C1B' },
    mocha: { bg: '#EDDFD5', border: '#A47864', fg: '#3E2E24' },
    'classic-blue': { bg: '#D5E2F2', border: '#0F4C81', fg: '#1B2E45' },
    coral: { bg: '#FFD9D3', border: '#FF6F61', fg: '#4A2520' },
    yellow: { bg: '#FAF3CF', border: '#D6B656', fg: '#3B3620' },
    gray: { bg: '#F0F1F1', border: '#939597', fg: '#33373B' },
    greenery: { bg: '#DFEBCB', border: '#88B04B', fg: '#2C3A1C' },
    marsala: { bg: '#EDD5D4', border: '#964F4C', fg: '#422624' },
  },
  'academic-light': {
    notebook: { bg: '#D6BFA3', border: '#8F7358', fg: '#2B2A26' },
    peri: { bg: '#E1E1F5', border: '#6667AB', fg: '#2E2E45' },
    magenta: { bg: '#F7D5DE', border: '#BB2649', fg: '#4A1F2A' },
    peach: { bg: '#FFE8D9', border: '#E8996B', fg: '#4A2C1B' },
    mocha: { bg: '#EDDFD5', border: '#A47864', fg: '#3E2E24' },
    'classic-blue': { bg: '#D5E2F2', border: '#0F4C81', fg: '#1B2E45' },
    coral: { bg: '#FFD9D3', border: '#FF6F61', fg: '#4A2520' },
    yellow: { bg: '#FAF3CF', border: '#D6B656', fg: '#3B3620' },
    gray: { bg: '#F0F1F1', border: '#939597', fg: '#33373B' },
    greenery: { bg: '#DFEBCB', border: '#88B04B', fg: '#2C3A1C' },
    marsala: { bg: '#EDD5D4', border: '#964F4C', fg: '#422624' },
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
  'kinopio-dark': {
    notebook: { bg: '#3d3220', border: '#8a744c', fg: '#e8dcc0' },
    peri: { bg: '#2c2c4a', border: '#8284c0', fg: '#d5d5f0' },
    magenta: { bg: '#4a2430', border: '#c4607f', fg: '#f0cdd8' },
    peach: { bg: '#3d2817', border: '#d08b57', fg: '#f0d9c4' },
    mocha: { bg: '#2f241a', border: '#a47864', fg: '#e0d4c8' },
    'classic-blue': { bg: '#1a2a3d', border: '#5b8bc4', fg: '#cfe0f0' },
    coral: { bg: '#3d1f1c', border: '#f08a7f', fg: '#f0cfc9' },
    yellow: { bg: '#3d3317', border: '#b39b4a', fg: '#f0e6b8' },
    gray: { bg: '#2e2e2e', border: '#7c848c', fg: '#dcdcdc' },
    greenery: { bg: '#223018', border: '#88b04b', fg: '#cfe6c0' },
    marsala: { bg: '#3a2020', border: '#b57773', fg: '#e8cbc8' },
  },
  apple: {
    notebook: { bg: '#e3d9c8', border: '#a9967b', fg: '#3a3228' },
    peri: { bg: '#dceafc', border: '#0a84ff', fg: '#1d3a5c' },
    magenta: { bg: '#fcdfec', border: '#ff2d55', fg: '#4a1f30' },
    peach: { bg: '#ffe4d1', border: '#ff9500', fg: '#4a2c12' },
    mocha: { bg: '#e8e0d5', border: '#a2845e', fg: '#3a3228' },
    'classic-blue': { bg: '#dceafc', border: '#0a84ff', fg: '#1d3a5c' },
    coral: { bg: '#fdd8d3', border: '#ff3b30', fg: '#4a1d19' },
    yellow: { bg: '#fdf2c5', border: '#ccbe00', fg: '#4a431a' },
    gray: { bg: '#e9e9eb', border: '#8e8e93', fg: '#2c2c2e' },
    greenery: { bg: '#d9f2e3', border: '#34c759', fg: '#1d3d26' },
    marsala: { bg: '#ecd5da', border: '#af52de', fg: '#3f2447' },
  },
  'apple-night': {
    notebook: { bg: '#3d372b', border: '#a9967b', fg: '#ece4d3' },
    peri: { bg: '#274257', border: '#64a8ff', fg: '#d6eafc' },
    magenta: { bg: '#4a2737', border: '#ff6489', fg: '#fcd5e4' },
    peach: { bg: '#4a2d1c', border: '#ffab4a', fg: '#ffe6cd' },
    mocha: { bg: '#3d3428', border: '#a2845e', fg: '#e3dbc9' },
    'classic-blue': { bg: '#274257', border: '#64a8ff', fg: '#d6eafc' },
    coral: { bg: '#4a2724', border: '#ff6961', fg: '#fcd6d3' },
    yellow: { bg: '#4a401f', border: '#d9c94a', fg: '#f5eeb8' },
    gray: { bg: '#2c2c2e', border: '#98989d', fg: '#e9e9eb' },
    greenery: { bg: '#274234', border: '#5ad38a', fg: '#d6f2e1' },
    marsala: { bg: '#372c52', border: '#bf85ff', fg: '#e6d9ff' },
  },
  lin: {
    notebook: { bg: '#d9d3c7', border: '#8a8375', fg: '#2a2a2a' },
    peri: { bg: '#d3dbe2', border: '#5b7d9a', fg: '#242c34' },
    magenta: { bg: '#e0d0da', border: '#9a5b7d', fg: '#33222b' },
    peach: { bg: '#e6d6c8', border: '#a0714a', fg: '#33261a' },
    mocha: { bg: '#ddd3c8', border: '#8a6d52', fg: '#2e261d' },
    'classic-blue': { bg: '#d2dfe9', border: '#3a6ea5', fg: '#1e2e3d' },
    coral: { bg: '#e2cfc9', border: '#a5503f', fg: '#331f1c' },
    yellow: { bg: '#e6dfc0', border: '#8a7d3a', fg: '#2e2a18' },
    gray: { bg: '#dcdedf', border: '#6a6d70', fg: '#222528' },
    greenery: { bg: '#cfdbbf', border: '#5a7a3a', fg: '#1f2c16' },
    marsala: { bg: '#d9c6c4', border: '#8a5550', fg: '#2f2020' },
  },
  'lin-dark': {
    notebook: { bg: '#332f28', border: '#8a8375', fg: '#d8d2c5' },
    peri: { bg: '#26303a', border: '#5b7d9a', fg: '#c5d5e2' },
    magenta: { bg: '#3a2830', border: '#9a5b7d', fg: '#e0c5d5' },
    peach: { bg: '#33281c', border: '#a0714a', fg: '#e6d2b8' },
    mocha: { bg: '#2e2820', border: '#8a6d52', fg: '#d8cfc2' },
    'classic-blue': { bg: '#1f2e3d', border: '#3a6ea5', fg: '#c5d8e8' },
    coral: { bg: '#33211e', border: '#a5503f', fg: '#e2c4bd' },
    yellow: { bg: '#33301c', border: '#8a7d3a', fg: '#e3dcc0' },
    gray: { bg: '#26282a', border: '#6a6d70', fg: '#d2d4d6' },
    greenery: { bg: '#232c1c', border: '#5a7a3a', fg: '#cfdbc0' },
    marsala: { bg: '#2e2222', border: '#8a5550', fg: '#dfc0bd' },
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
  shaomi: {
    notebook: { bg: '#f2e8d5', border: '#c9b382', fg: '#4a3a1e' },
    peri: { bg: '#e8f1fd', border: '#3b82c4', fg: '#1e3a52' },
    magenta: { bg: '#fde3ec', border: '#d9436f', fg: '#5a1f30' },
    peach: { bg: '#ffe9d9', border: '#ff9424', fg: '#5a3210' },
    mocha: { bg: '#efe4d8', border: '#b98a5e', fg: '#402c1c' },
    'classic-blue': { bg: '#e3edfb', border: '#2f6fb8', fg: '#1c3552' },
    coral: { bg: '#ffe1da', border: '#ff6900', fg: '#5a2508' },
    yellow: { bg: '#fff4cf', border: '#e2b60a', fg: '#4a3c08' },
    gray: { bg: '#f0f1f2', border: '#9aa0a6', fg: '#333639' },
    greenery: { bg: '#e3f2d9', border: '#5ab840', fg: '#1f3d14' },
    marsala: { bg: '#f5e2ee', border: '#b850a0', fg: '#4a1e42' },
  },
  'shaomi-dark': {
    notebook: { bg: '#3d3524', border: '#c9a95e', fg: '#f2e8d0' },
    peri: { bg: '#26303d', border: '#5a9ad0', fg: '#d5e6f5' },
    magenta: { bg: '#3d2230', border: '#e05a85', fg: '#f5cede' },
    peach: { bg: '#3d2a18', border: '#ff9424', fg: '#f5ddc2' },
    mocha: { bg: '#33281e', border: '#b98a5e', fg: '#e8dccd' },
    'classic-blue': { bg: '#1e2c3d', border: '#4a8ad0', fg: '#cde0f5' },
    coral: { bg: '#3d2517', border: '#ff6900', fg: '#f5d5bc' },
    yellow: { bg: '#3d3315', border: '#e2b60a', fg: '#f5eab8' },
    gray: { bg: '#2a2c2e', border: '#7a8085', fg: '#d5d8da' },
    greenery: { bg: '#22331a', border: '#5ab840', fg: '#cde8bb' },
    marsala: { bg: '#362033', border: '#c470b0', fg: '#f0d2ea' },
  },
  miuay: {
    notebook: { bg: '#fdf3e0', border: '#d8b878', fg: '#4a3818' },
    peri: { bg: '#eef2ff', border: '#4c84ff', fg: '#1f2e5c' },
    magenta: { bg: '#ffe4f0', border: '#ff4d94', fg: '#5c1e35' },
    peach: { bg: '#ffeadb', border: '#ff8f4d', fg: '#5c3010' },
    mocha: { bg: '#f3e9df', border: '#c09068', fg: '#42301e' },
    'classic-blue': { bg: '#e5eeff', border: '#4c84ff', fg: '#1f2e5c' },
    coral: { bg: '#ffe3e0', border: '#ff5f55', fg: '#5c1e1a' },
    yellow: { bg: '#fff6cf', border: '#f0c020', fg: '#4a3e08' },
    gray: { bg: '#f2f3f5', border: '#9ba0a8', fg: '#33363b' },
    greenery: { bg: '#e6f5df', border: '#43c94d', fg: '#1e4218' },
    marsala: { bg: '#f2e5ff', border: '#9c6bff', fg: '#3a2360' },
  },
  'miuay-dark': {
    notebook: { bg: '#3a3020', border: '#d0b070', fg: '#f5ecd5' },
    peri: { bg: '#232c45', border: '#6a94ff', fg: '#d8e2ff' },
    magenta: { bg: '#3d2030', border: '#ff6da8', fg: '#fbd3e4' },
    peach: { bg: '#3d2617', border: '#ff9455', fg: '#fde0c5' },
    mocha: { bg: '#302620', border: '#c09068', fg: '#ecdcca' },
    'classic-blue': { bg: '#1d2840', border: '#6a94ff', fg: '#d5e2ff' },
    coral: { bg: '#3d1f1e', border: '#ff6a60', fg: '#fbd4d0' },
    yellow: { bg: '#3a3115', border: '#f0c020', fg: '#f8eec0' },
    gray: { bg: '#27292d', border: '#808690', fg: '#dadde2' },
    greenery: { bg: '#1d3220', border: '#43c94d', fg: '#cceccf' },
    marsala: { bg: '#2c2038', border: '#a87aff', fg: '#e6d9ff' },
  },
};

export const NOTE_ORDER: NoteColor[] = [
  'yellow',        // жёлтый стикер
  'notebook',      // кремовая бумага (жёлтая семья)
  'peach',         // персик (жёлто-оранжевый)
  'mocha',         // крафт (тёплый коричневый)
  'gray',          // серый
  'coral',         // красно-коралловый
  'marsala',       // терракота/красное
  'magenta',       // розово-малиновое
  'greenery',      // зелень
  'peri',          // лаванда (сине-фиолетовый)
  'classic-blue',  // синий
];

export function notePalette(theme: ThemeId, cardsTheme?: ThemeId | null): NotePalette {
  // fg каждой палитры уже согласован с её фоном — ничего не перекрываем
  return NOTE_PALETTES[cardsTheme ?? theme] ?? NOTE_PALETTES.tetrad;
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
  return theme === 'academic' || theme === 'academic-light';
}
