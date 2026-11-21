// Движок повторов задач. Поддерживает все варианты постановки повторных сроков.

import type { Board, Card, ItemRepeat, TodoItem } from './types';

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Следующая дата повтора строго после `after` (YYYY-MM-DD). Для after-повторов не используется. */
export function nextOccurrence(repeat: ItemRepeat, after: string): string | null {
  if (repeat.kind === 'none') return null;
  const d = new Date(after + 'T12:00:00');
  if (isNaN(d.getTime())) return after;
  const plus = (days: number) => {
    const x = new Date(d);
    x.setDate(x.getDate() + days);
    return dateKey(x);
  };
  if (repeat.kind === 'daily') return plus(repeat.everyN);

  if (repeat.kind === 'weekly') {
    let x = new Date(d);
    for (let i = 0; i < 400; i++) {
      x.setDate(x.getDate() + 1);
      const wd = (x.getDay() + 6) % 7;
      if (wd === repeat.weekday) {
        if (repeat.everyNWeeks <= 1) return dateKey(x);
        // выравнивание по кратности недель от базовой даты
        const diffDays = Math.round((x.getTime() - d.getTime()) / 86400000);
        if (diffDays % (7 * repeat.everyNWeeks) === 0) return dateKey(x);
      }
    }
    return plus(7 * repeat.everyNWeeks);
  }

  if (repeat.kind === 'monthlyDay') {
    let x = new Date(d);
    for (let i = 0; i < 400; i++) {
      x = new Date(x.getFullYear(), x.getMonth() + repeat.everyNMonths, Math.min(repeat.day, 1), 12);
      const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
      if (repeat.day <= dim) {
        x.setDate(repeat.day);
        if (dateKey(x) > after) return dateKey(x);
      }
    }
    return null;
  }

  if (repeat.kind === 'nthWeekday') {
    let x = new Date(d);
    for (let i = 0; i < 400; i++) {
      x = new Date(x.getFullYear(), x.getMonth() + repeat.everyNMonths, 1, 12);
      const dim = new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate();
      let count = 0;
      for (let day = 1; day <= dim; day++) {
        const wd = (new Date(x.getFullYear(), x.getMonth(), day).getDay() + 6) % 7;
        if (wd !== repeat.weekday) continue;
        count++;
        const isNth = repeat.nth >= 0 ? count === repeat.nth : day > dim - 7;
        if (!isNth) continue;
        const key = dateKey(new Date(x.getFullYear(), x.getMonth(), day));
        if (key > after) return key;
      }
    }
    return null;
  }

  if (repeat.kind === 'yearly') {
    let x = new Date(d);
    for (let i = 0; i < 400; i++) {
      x = new Date(x.getFullYear() + 1, repeat.month, repeat.day, 12);
      if (dateKey(x) > after) return dateKey(x);
    }
    return null;
  }

  return null;
}

/** Даты повтора, попадающие в заданный месяц (YYYY-MM). */
export function occurrencesInMonth(repeat: ItemRepeat, baseDue: string, year: number, month: number): string[] {
  if (repeat.kind === 'none') return baseDue ? [baseDue] : [];
  if (repeat.kind === 'yearly') {
    const key = `${year}-${String(repeat.month + 1).padStart(2, '0')}-${String(repeat.day).padStart(2, '0')}`;
    return key.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`) ? [key] : [];
  }
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const dim = new Date(year, month + 1, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= dim; day++) {
    const key = `${prefix}-${String(day).padStart(2, '0')}`;
    if (key <= baseDue) continue;
    const nx = nextOccurrence(repeat, dateKey(new Date(year, month, day - 1)));
    // эффективнее: прямой расчёт вхождения
    const dd = new Date(key + 'T12:00:00');
    if (repeat.kind === 'daily') {
      const diff = Math.round((dd.getTime() - new Date(baseDue + 'T12:00:00').getTime()) / 86400000);
      if (diff > 0 && diff % repeat.everyN === 0) out.push(key);
    } else if (repeat.kind === 'weekly') {
      const wd = (dd.getDay() + 6) % 7;
      if (wd === repeat.weekday) {
        const diff = Math.round((dd.getTime() - new Date(baseDue + 'T12:00:00').getTime()) / 86400000);
        if (diff > 0 && diff % (7 * repeat.everyNWeeks) === 0) out.push(key);
      }
    } else if (repeat.kind === 'monthlyDay') {
      if (dd.getDate() === repeat.day) {
        const monthsDiff = (year - new Date(baseDue + 'T12:00:00').getFullYear()) * 12 + (month - new Date(baseDue + 'T12:00:00').getMonth());
        if (monthsDiff > 0 && monthsDiff % repeat.everyNMonths === 0) out.push(key);
      }
    } else if (repeat.kind === 'nthWeekday') {
      const wd = (dd.getDay() + 6) % 7;
      if (wd !== repeat.weekday) continue;
      let count = 0;
      for (let day2 = 1; day2 <= dim; day2++) {
        const wd2 = (new Date(year, month, day2).getDay() + 6) % 7;
        if (wd2 === repeat.weekday) count++;
        if (day2 === day) {
          const isNth = repeat.nth >= 0 ? count === repeat.nth : day > dim - 7;
          if (!isNth) break;
          const base = new Date(baseDue + 'T12:00:00');
          const monthsDiff = (year - base.getFullYear()) * 12 + (month - base.getMonth());
          if (monthsDiff > 0 && monthsDiff % repeat.everyNMonths === 0) out.push(key);
          break;
        }
      }
    }
  }
  return out;
}

export function describeItemRepeat(r: ItemRepeat): string {
  const wd = ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'];
  const wdA = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];
  switch (r.kind) {
    case 'none': return '';
    case 'daily': return r.everyN === 1 ? 'каждый день' : `каждые ${r.everyN} дня`;
    case 'weekly': return r.everyNWeeks === 1 ? `каждую ${wdA[r.weekday]}` : `каждые ${r.everyNWeeks} недели по ${wdA[r.weekday]}`;
    case 'nthWeekday': {
      const nthName = r.nth === -1 ? 'последний' : `${r.nth}-й`;
      const every = r.everyNMonths === 1 ? 'месяца' : `${r.everyNMonths} мес`;
      return `каждый ${nthName} ${wd[r.weekday]} ${every}`;
    }
    case 'monthlyDay': return r.everyNMonths === 1 ? `каждого ${r.day}-го числа` : `каждые ${r.everyNMonths} мес ${r.day}-го числа`;
    case 'yearly': return `ежегодно ${r.day}.${r.month + 1}`;
    case 'after': return 'после выполнения другой задачи';
  }
}

/** Базовое время выполнения опорной задачи (для repeat.kind = 'after'). */
export function resolveAfterBase(
  base: string,
  boards: Record<string, Board>,
  now = Date.now()
): number | null {
  const parts = base.split(':');
  if (parts[0] === 'item' && parts.length >= 3) {
    const cardId = parts[1];
    const itemId = parts[2];
    for (const b of Object.values(boards)) {
      const card = b.cards.find((c) => c.id === cardId);
      if (!card || card.data.kind !== 'todo') continue;
      const item = card.data.items.find((it) => it.id === itemId);
      if (!item) continue;
      if (item.doneDates?.length) {
        const last = item.doneDates[item.doneDates.length - 1];
        return new Date(last + 'T12:00:00').getTime();
      }
      if (item.done) return now;
      return null;
    }
    return null;
  }
  if (parts[0] === 'alarm' && parts.length >= 2) {
    const cardId = parts[1];
    for (const b of Object.values(boards)) {
      const card = b.cards.find((c) => c.id === cardId);
      if (card?.alarmAt) return new Date(card.alarmAt).getTime();
    }
    return null;
  }
  return null;
}

export function isAfterActivated(baseDoneTs: number | null, delayMinutes: number, now = Date.now()): boolean {
  if (baseDoneTs === null) return false;
  return now >= baseDoneTs + delayMinutes * 60000;
}
