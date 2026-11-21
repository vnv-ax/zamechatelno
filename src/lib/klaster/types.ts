

export type CardType =
  | 'note'
  | 'text'
  | 'todo'
  | 'image'
  | 'link'
  | 'board'
  | 'column'
  | 'draw'
  | 'catalog'
  | 'subject'
  | 'organization'
  | 'object'
  | 'shape';

export type ShapeKind = 'circle' | 'square' | 'triangle' | 'star';

export type DrawStyle =
  | 'pen'
  | 'brush'
  | 'edge'
  | 'marker'
  // новые кисти (движок perfect-freehand, как в milanote)
  | 'ink'
  | 'pencil'
  | 'calligraphy'
  | 'neon'
  | 'crayon';

export interface DrawStroke {
  width: number;
  style?: DrawStyle;
  color?: string | null;
  points: number[];
  pressures?: number[];
  /** Запечённый рендер штриха (SVG-слои) — не пересчитывается при показе */
  baked?: string;
}

export type CatalogCategory = 'theme' | 'tool' | 'direction' | 'sphere';

export interface CatalogLink {
  id: string;
  url: string;
  title: string;
  /** Задача ссылки: зачем она, что с ней делать (показывается в каталоге, если заполнена) */
  task?: string;
}

export type NoteColor =
  | 'notebook'
  | 'peri'
  | 'magenta'
  | 'peach'
  | 'mocha'
  | 'classic-blue'
  | 'coral'
  | 'yellow'
  | 'gray'
  | 'greenery'
  | 'marsala';

export type CardStatus = 'urgent' | 'actual' | 'done';

export interface CardComment {
  id: string;
  text: string;
  ts: number;
}

export type CalendarRepeat =
  | { kind: 'once'; date: string }
  | { kind: 'everyMonthDay'; everyN: number; day: number }
  | { kind: 'nthWeekday'; nth: number; weekday: number }
  | { kind: 'after'; afterTaskId: string; delayMinutes: number };

export interface CalendarTask {
  id: string;
  text: string;
  createdAt: number;
  repeat: CalendarRepeat;
  /** даты (YYYY-MM-DD) выполнения повторяющейся задачи */
  doneDates: string[];
  /** отметка выполнения однократной задачи */
  done: boolean;
}

export interface TodoItem {
  id: string;
  text: string;
  done: boolean;
  /** срок пункта: YYYY-MM-DD (или ISO datetime) */
  due?: string;
  /** повтор пункта */
  repeat?: ItemRepeat;
  /** выполненные даты повторяющегося пункта (YYYY-MM-DD) */
  doneDates?: string[];
}

/** Все варианты повторов задач */
export type ItemRepeat =
  | { kind: 'none' }
  | { kind: 'daily'; everyN: number }
  | { kind: 'weekly'; everyNWeeks: number; weekday: number }
  | { kind: 'nthWeekday'; everyNMonths: number; nth: number; weekday: number }
  | { kind: 'monthlyDay'; everyNMonths: number; day: number }
  | { kind: 'yearly'; month: number; day: number }
  | { kind: 'after'; base: string; delayMinutes: number };

export type CardData =
  | { kind: 'note'; text: string; color: NoteColor }
  | { kind: 'text'; text: string }
  | { kind: 'todo'; title?: string; items: TodoItem[] }
  | { kind: 'image'; src: string; alt: string; srcOriginal?: string; filter?: ImageFilterId | null }
  | { kind: 'link'; url: string; title: string; description?: string }
  | { kind: 'board'; boardId: string }
  | { kind: 'column'; title: string; cardIds: string[] }
  | { kind: 'draw'; width: number; style?: DrawStyle; color?: string | null; points: number[]; strokes?: DrawStroke[] }
  | { kind: 'catalog'; category: CatalogCategory; title: string; links: CatalogLink[] }

  | { kind: 'subject'; name: string; role: string; contacts: string; about: string; photo?: string }

  | { kind: 'organization'; name: string; orgType: string; sphere: string; contacts: string; address: string }

  | { kind: 'object'; name: string; objType: string; status: string; about: string; photo?: string }
  | { kind: 'shape'; shape: ShapeKind; color: NoteColor };

export interface Card {
  id: string;
  type: CardType;
  x: number;
  y: number;
  w: number;
  h: number;
  data: CardData;

  icon?: string;

  locked?: boolean;

  /** Высота задана вручную растягиванием: для авто-высотных типов работает как минимум */
  hManual?: boolean;

  /** Отметка состояния: срочно / актуально / выполнено */
  status?: CardStatus | null;

  /** Комментарии к блоку (по умолчанию скрыты) */
  comments?: CardComment[];

  vote?: 'like' | 'dislike' | null;

  alarmAt?: string | null;

  color?: NoteColor | null;
  tags?: string[];
}

export type CardMetaPatch = Partial<Pick<Card, 'icon' | 'locked' | 'vote' | 'alarmAt' | 'color' | 'hManual' | 'status' | 'comments'>>;

export type ConnectionArrow = 'end' | 'start' | 'both' | 'none';

export interface Connection {
  id: string;
  from: string;
  to: string;
  arrow?: ConnectionArrow;
  /** Точка на кривой (мировые координаты): потянув за неё, стрелку можно изогнуть */
  controlPoint?: { x: number; y: number } | null;
  /** Подпись на линии */
  label?: string | null;
}

export interface TagSpec {
  label: string;
  color: NoteColor;
}

export interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

export interface Board {
  id: string;
  title: string;
  cards: Card[];
  connections: Connection[];
  createdAt: number;
  updatedAt: number;
}

export const NOTE_COLORS: Record<NoteColor, { bg: string; border: string; label: string }> = {
  notebook: { bg: '#D6BFA3', border: '#8F7358', label: 'Тетрадный' },
  peri: { bg: '#C3C5EC', border: '#6667AB', label: 'Вэри Пери' },
  magenta: { bg: '#EFAFC1', border: '#BB2649', label: 'Вива Маджента' },
  peach: { bg: '#FFDCC7', border: '#E8996B', label: 'Персиковый пух' },
  mocha: { bg: '#DCC7B8', border: '#A47864', label: 'Мокко Мусс' },
  'classic-blue': { bg: '#B3CBEA', border: '#0F4C81', label: 'Классический синий' },
  coral: { bg: '#FFB8AE', border: '#FF6F61', label: 'Живой коралл' },
  yellow: { bg: '#F9E880', border: '#D9BE1E', label: 'Иллюминейтинг' },
  gray: { bg: '#DDDFE0', border: '#939597', label: 'Ультимейт Грей' },
  greenery: { bg: '#BCD493', border: '#88B04B', label: 'Гринери' },
  marsala: { bg: '#D8ABA9', border: '#964F4C', label: 'Марсала' },
};

export const CARD_BG = '#FFFFFF';
export const CARD_BORDER = '#E3E4E0';
export const SELECTION_COLOR = '#4C84F7';
export const TEXT_MAIN = '#28313B';
export const TEXT_MUTED = '#8A9099';

export type ImageFilterId =
  | 'original'
  | 'halftone'
  | 'halftone-vintage'
  | 'dither-retro'
  | 'dither-natural';

export const AUTO_HEIGHT: CardType[] = ['note', 'text', 'todo', 'link', 'column', 'catalog', 'subject', 'organization', 'object'];

export function isAutoHeight(type: CardType): boolean {
  return AUTO_HEIGHT.includes(type);
}

export function cardDefaultSize(type: CardType): { w: number; h: number } {
  switch (type) {
    case 'note': return { w: 210, h: 150 };
    case 'text': return { w: 270, h: 120 };
    case 'todo': return { w: 250, h: 160 };
    case 'image': return { w: 300, h: 210 };
    case 'link': return { w: 260, h: 80 };
    case 'board': return { w: 230, h: 170 };
    case 'column': return { w: 240, h: 300 };
    case 'draw': return { w: 160, h: 120 };
    case 'catalog': return { w: 280, h: 260 };
    case 'subject': return { w: 210, h: 210 };
    case 'organization': return { w: 260, h: 220 };
    case 'object': return { w: 210, h: 210 };
    case 'shape': return { w: 150, h: 150 };
  }
}

export const ICON_TYPES: CardType[] = ['subject', 'organization', 'object', 'board'];

export function hasIconUI(type: CardType): boolean {
  return ICON_TYPES.includes(type);
}

export const ENTITY_TAG: Partial<Record<CardType, { label: string; dot: string }>> = {
  subject: { label: 'Субъект', dot: '#3aa981' },
  organization: { label: 'Организация', dot: '#7c6fd9' },
  object: { label: 'Объект', dot: '#e0a23f' },
};

export interface EntityFieldDef {
  key: string;
  label: string;
  placeholder: string;
  area?: boolean;
}

export const ENTITY_FIELDS: Partial<Record<CardType, EntityFieldDef[]>> = {
  subject: [
    { key: 'role', label: 'Роль / должность', placeholder: '' },
    { key: 'contacts', label: 'Контакты', placeholder: '' },
    { key: 'about', label: 'Краткое описание', placeholder: '', area: true },
  ],
  organization: [
    { key: 'orgType', label: 'Тип / форма', placeholder: '' },
    { key: 'sphere', label: 'Сфера деятельности', placeholder: '' },
    { key: 'contacts', label: 'Контакты', placeholder: '' },
    { key: 'address', label: 'Адрес', placeholder: '' },
  ],

  object: [
    { key: 'about', label: 'Комментарий', placeholder: '', area: true },
  ],
};

export function cardDisplayName(card: Card, boards?: Record<string, Board>): string {
  const d = card.data;
  switch (d.kind) {
    case 'subject': return d.name || 'Субъект';
    case 'organization': return d.name || 'Организация';
    case 'object': return d.name || 'Объект';
    case 'board': return (boards && boards[d.boardId]?.title) || 'Лист';
    case 'note':
    case 'text':
      return d.text.slice(0, 40) || (d.kind === 'note' ? 'Заметка' : 'Текст');
    case 'todo': return d.title || 'Список';
    case 'link': return d.title || d.url || 'Ссылка';
    case 'column': return d.title || 'Колонка';
    case 'catalog': return d.title || 'Каталог';
    case 'image': return d.alt || 'Изображение';
    case 'draw': return 'Штрих';
    case 'shape': return 'Фигура';
  }
}

export const DRAW_SIZES: number[] = [2, 4, 7, 12];
export const DRAW_WIDTH = 4;

export const DRAW_STYLES: DrawStyle[] = ['brush', 'calligraphy', 'edge'];

export const DRAW_STYLE_META: Record<DrawStyle, { label: string; desc: string }> = {
  pencil: { label: 'Карандаш', desc: 'тонкая светлая линия с зернистым следом' },
  ink: { label: 'Чернила', desc: 'уверенная ровная линия с переменной толщиной от скорости' },
  brush: { label: 'Кисть', desc: 'живой штрих: широкий, с напором и мягким началом' },
  calligraphy: { label: 'Перо', desc: 'каллиграфический штрих — острые концы, контрастная толщина' },
  marker: { label: 'Маркер', desc: 'широкий полупрозрачный след с ровными краями' },
  crayon: { label: 'Мел', desc: 'шершавая зернистая линия, как восковой мелок' },
  neon: { label: 'Неон', desc: 'светящаяся линия с мягким ореолом' },
  pen: { label: 'Графит (старый)', desc: 'старый штрих — двойной графитовый след' },
  edge: { label: 'Скошенное перо', desc: 'угловые широкие и тонкие участки — перо в 45°' },
};

export interface DrawColorSpec {
  id: string;
  hex: string | null;
  label: string;
}

export const DRAW_COLORS: DrawColorSpec[] = [
  { id: 'auto', hex: null, label: 'Авто — цвет темы' },
  { id: 'ink', hex: '#23282E', label: 'Чёрный' },
  { id: 'illuminating', hex: '#F5DF4D', label: 'Освещающий жёлтый · Pantone 2021' },
  { id: 'ultimate-gray', hex: '#939597', label: 'Абсолютный серый · Pantone 2021' },
  { id: 'very-peri', hex: '#6667AB', label: 'Пери · Pantone 2022' },
  { id: 'viva-magenta', hex: '#BB2649', label: 'Маджента · Pantone 2023' },
  { id: 'peach-fuzz', hex: '#FFBE98', label: 'Персик · Pantone 2024' },
  { id: 'mocha-mousse', hex: '#A47864', label: 'Мокко · Pantone 2025' },
];

export const CATALOG_CATEGORIES: Record<CatalogCategory, string> = {
  theme: 'Тема',
  tool: 'Инструмент',
  direction: 'Направление',
  sphere: 'Сфера',
};

export function formatAlarm(alarmAt: string): string {
  const d = new Date(alarmAt);
  if (isNaN(d.getTime())) return alarmAt;
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function isAlarmDue(alarmAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!alarmAt) return false;
  const t = new Date(alarmAt).getTime();
  return !isNaN(t) && now >= t;
}

export function nowToLocalInput(offsetMs = 0): string {
  const d = new Date(Date.now() + offsetMs);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const measuredSizes = new Map<string, { w: number; h: number }>();
