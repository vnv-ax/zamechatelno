'use client';

import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '@/lib/klaster/store';
import { focusCard } from './Canvas';
import {
  dateKey,
  describeItemRepeat,
  isAfterActivated,
  nextOccurrence,
  resolveAfterBase,
} from '@/lib/klaster/repeat';
import type { Card, TodoItem } from '@/lib/klaster/types';

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
const MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

export type CalendarEvent = {
  key: string;
  date: string;
  label: string;
  cardId: string;
  boardId: string;
  kind: 'alarm' | 'todo' | 'after' | 'overdue' | 'done';
  done: boolean;
  repeatText: string;
};

function cardLabel(card: Card): string {
  if (card.data.kind === 'todo') {
    const pending = card.data.items.find((it) => !it.done);
    return card.data.title || pending?.text || card.data.items[0]?.text || 'Задачи';
  }
  const t = card.data.kind === 'note' || card.data.kind === 'text' ? card.data.text : '';
  return t.split('\n')[0].slice(0, 40) || 'Блок';
}

function itemActiveDue(item: TodoItem): string | null {
  const r = item.repeat;
  if (!r || r.kind === 'none') return item.due ?? null;
  const lastDone = item.doneDates?.length ? item.doneDates[item.doneDates.length - 1] : null;
  if (!lastDone) return item.due ?? null;
  return nextOccurrence(r, lastDone) ?? item.due ?? null;
}

function itemDone(item: TodoItem, due: string | null): boolean {
  if (item.repeat && item.repeat.kind !== 'none') return due ? (item.doneDates ?? []).includes(due) : false;
  return item.done;
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(d);
}

/** occurrences в месяце для повторов (без after) */
function occurrencesInMonthOf(r: NonNullable<TodoItem['repeat']>, baseDue: string, year: number, month: number): string[] {
  if (!baseDue) return [];
  const dim = new Date(year, month + 1, 0).getDate();
  const base = new Date(baseDue + 'T12:00:00');
  if (isNaN(base.getTime())) return [];
  const out: string[] = [];
  for (let day = 1; day <= dim; day++) {
    const dd = new Date(year, month, day, 12);
    const key = dateKey(dd);
    if (key < baseDue) continue;
    if (r.kind === 'daily') {
      const diff = Math.round((dd.getTime() - base.getTime()) / 86400000);
      if (diff >= 0 && diff % r.everyN === 0) out.push(key);
    } else if (r.kind === 'weekly') {
      const wd = (dd.getDay() + 6) % 7;
      const diff = Math.round((dd.getTime() - base.getTime()) / 86400000);
      if (wd === r.weekday && diff >= 0 && diff % (7 * r.everyNWeeks) === 0) out.push(key);
    } else if (r.kind === 'monthlyDay') {
      if (dd.getDate() === r.day) {
        const monthsDiff = (year - base.getFullYear()) * 12 + (month - base.getMonth());
        if (monthsDiff >= 0 && monthsDiff % r.everyNMonths === 0) out.push(key);
      }
    } else if (r.kind === 'nthWeekday') {
      const wd = (dd.getDay() + 6) % 7;
      if (wd !== r.weekday) continue;
      let count = 0;
      let isNth = false;
      for (let d2 = 1; d2 <= dim; d2++) {
        const wd2 = (new Date(year, month, d2).getDay() + 6) % 7;
        if (wd2 === r.weekday) count++;
        if (d2 === day) {
          isNth = r.nth >= 0 ? count === r.nth : day > dim - 7;
          break;
        }
      }
      if (!isNth) continue;
      const monthsDiff = (year - base.getFullYear()) * 12 + (month - base.getMonth());
      if (monthsDiff >= 0 && monthsDiff % r.everyNMonths === 0) out.push(key);
    } else if (r.kind === 'yearly') {
      if (month === r.month && day === r.day) out.push(key);
    }
  }
  return out;
}

function collectEvents(year: number, month: number): CalendarEvent[] {
  const st = useAppStore.getState();
  const out: CalendarEvent[] = [];
  for (const [boardId, board] of Object.entries(st.boards)) {
    for (const card of board.cards) {
      if (card.alarmAt) {
        const d = new Date(card.alarmAt);
        if (!isNaN(d.getTime())) {
          const key = dateKey(d);
          if (key.startsWith(year + '-' + String(month + 1).padStart(2, '0'))) {
            out.push({
              key: 'alarm' + card.id + key,
              date: key,
              label: (cardLabel(card) || 'Блок') + ' — срок',
              cardId: card.id,
              boardId,
              kind: d.getTime() < Date.now() ? 'overdue' : 'alarm',
              done: false,
              repeatText: formatTime(d),
            });
          }
        }
      }
      if (card.data.kind !== 'todo') continue;
      card.data.items.forEach((item: TodoItem) => {
        const r = item.repeat;
        const baseDue = item.due ?? null;
        const active = itemActiveDue(item);
        if (r && r.kind !== 'none') {
          if (r.kind === 'after') {
            const baseTs = resolveAfterBase(r.base, st.boards);
            if (isAfterActivated(baseTs, r.delayMinutes)) {
              out.push({
                key: 'after' + card.id + item.id,
                date: dateKey(new Date()),
                label: item.text || 'Активированная задача',
                cardId: card.id,
                boardId,
                kind: 'after',
                done: (item.doneDates?.length ?? 0) > 0,
                repeatText: 'активировалась после другой задачи',
              });
            }
            return;
          }
          const occ = occurrencesInMonthOf(r, baseDue ?? active ?? '', year, month);
          for (const date of occ) {
            out.push({
              key: 'todo' + card.id + item.id + date,
              date,
              label: item.text || cardLabel(card),
              cardId: card.id,
              boardId,
              kind: itemDone(item, date) ? 'done' : date < dateKey(new Date()) ? 'overdue' : 'todo',
              done: itemDone(item, date),
              repeatText: describeItemRepeat(r),
            });
          }
          if (active && !occ.includes(active)) {
            out.push({
              key: 'todo-active' + card.id + item.id,
              date: active,
              label: item.text || cardLabel(card),
              cardId: card.id,
              boardId,
              kind: itemDone(item, active) ? 'done' : 'todo',
              done: itemDone(item, active),
              repeatText: describeItemRepeat(r),
            });
          }
        } else if (baseDue && baseDue.startsWith(year + '-' + String(month + 1).padStart(2, '0'))) {
          out.push({
            key: 'todo' + card.id + item.id,
            date: baseDue,
            label: item.text,
            cardId: card.id,
            boardId,
            kind: itemDone(item, baseDue) ? 'done' : baseDue < dateKey(new Date()) ? 'overdue' : 'todo',
            done: itemDone(item, baseDue),
            repeatText: '',
          });
        }
      });
    }
  }
  return out;
}

export function HomeCalendar() {
  const boards = useAppStore((s) => s.boards);
  const today = new Date();
  const [cursor, setCursor] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState<string | null>(dateKey(today));
  void boards;

  const events = useMemo(() => collectEvents(cursor.y, cursor.m), [boards, cursor]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      if (!map.has(ev.date)) map.set(ev.date, []);
      map.get(ev.date)!.push(ev);
    }
    return map;
  }, [events]);

  const grid = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1);
    const startPad = (first.getDay() + 6) % 7;
    const dim = new Date(cursor.y, cursor.m + 1, 0).getDate();
    const cells: (Date | null)[] = Array(startPad).fill(null);
    for (let d = 1; d <= dim; d++) cells.push(new Date(cursor.y, cursor.m, d));
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [cursor]);

  const dayEvents = selected ? (byDay.get(selected) ?? []).sort((a, b) => a.label.localeCompare(b.label)) : [];

  const goToCard = (ev: CalendarEvent) => {
    const st = useAppStore.getState();
    st.openBoardRoot(ev.boardId);
    setTimeout(() => focusCard(ev.boardId, ev.cardId), 120);
  };

  return (
    <div className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel-bg)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CalendarDays size={16} className="text-[var(--accent)]" />
          <span className="text-[14px] font-semibold text-[var(--text-main)]">
            {MONTHS[cursor.m]} {cursor.y}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))}
            aria-label="Предыдущий месяц"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            onClick={() => setCursor({ y: today.getFullYear(), m: today.getMonth() })}
            aria-label="Текущий месяц"
          >
            <CalendarDays size={14} />
          </button>
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]"
            onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))}
            aria-label="Следующий месяц"
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
            {w}
          </div>
        ))}
        {grid.map((d, i) => {
          if (!d) return <div key={'e' + i} />;
          const key = dateKey(d);
          const evs = byDay.get(key) ?? [];
          const isToday = key === dateKey(today);
          const isSel = key === selected;
          return (
            <button
              key={key}
              className={
                'relative flex h-9 flex-col items-center justify-center rounded-md text-[12.5px] transition-colors ' +
                (isSel
                  ? 'bg-[var(--accent-soft)] font-semibold text-[var(--text-main)] ring-1 ring-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--hover-bg)]') +
                (isToday && !isSel ? ' ring-1 ring-[var(--accent)]' : '')
              }
              onClick={() => setSelected(key)}
            >
              {d.getDate()}
              {evs.length > 0 ? (
                <span className="absolute bottom-1 flex gap-0.5">
                  {evs.slice(0, 3).map((e) => (
                    <span
                      key={e.key}
                      className="h-1 w-1 rounded-full"
                      style={{
                        background: e.done
                          ? 'var(--text-faint)'
                          : e.kind === 'overdue' || e.kind === 'alarm'
                            ? '#c92a2a'
                            : 'var(--accent)',
                      }}
                    />
                  ))}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {selected ? (
        <div className="mt-3 border-t border-[var(--panel-border)] pt-3">
          <div className="text-[12.5px] font-medium text-[var(--text-main)]">
            {(() => {
              const [y, m, d] = selected.split('-').map(Number);
              return new Date(y, m - 1, d).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
                weekday: 'long',
              });
            })()}
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {dayEvents.length === 0 ? (
              <span className="text-[12px] text-[var(--text-muted)]">Задач и сроков нет.</span>
            ) : null}
            {dayEvents.map((ev) => (
              <button
                key={ev.key}
                className="group flex items-start gap-2 rounded-md px-1.5 py-1 text-left hover:bg-[var(--hover-bg)]"
                onClick={() => goToCard(ev)}
              >
                <span
                  className="mt-[5px] h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background:
                      ev.kind === 'overdue' || ev.kind === 'alarm'
                        ? '#c92a2a'
                        : ev.kind === 'after'
                          ? '#e8a33d'
                          : ev.done
                            ? 'var(--text-faint)'
                            : '#37b24d',
                    boxShadow: ev.kind === 'todo' && !ev.done ? '0 0 5px 1px rgba(55,178,77,.7)' : 'none',
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={
                      'block truncate text-[12.5px] ' +
                      (ev.done ? 'text-[var(--text-muted)] line-through' : 'text-[var(--text-main)]')
                    }
                  >
                    {ev.label}
                  </span>
                  {ev.repeatText ? (
                    <span className="block text-[10.5px] text-[var(--text-muted)]">{ev.repeatText}</span>
                  ) : null}
                </span>
              </button>
            ))}
            <div className="mt-1 text-[10.5px] leading-tight text-[var(--text-muted)]">
              Клик по задаче открывает её блок на листе.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
