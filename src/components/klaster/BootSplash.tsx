'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/klaster/store';

/**
 * Единый чёрный слой от запуска до готовности:
 * непрерывный скрамбл-текст (фазы: загрузка → пароль → догрузка),
 * внизу — линия пароля мигающим курсором. Ни плашек, ни пузырей.
 * Анимация — transform/текст на композиторе, не мешает загрузке.
 */

const GLYPHS = '§#@%&*+=<>/\\|~^01ОБЩЕСТВЕННОЕ';
// первые шесть — всегда в этом порядке, дальше пул идёт случайно
const OPENING: string[] = [
  'ЗАМЕЧАТЕЛЬНО.',
  'ЗАГРУЖАЕМ СЛОИ.',
  'СТАВИМ ЭФФЕКТЫ.',
  'РАСКЛАДЫВАЕМ ЛИСТЫ.',
  'НАСТРАИВАЕМ ЧЕРНИЛА.',
  'ПРОЯВЛЯЕМ БЛОКИ.',
];
const POOL: string[] = [
  'СОРТИРУЕМ МЫСЛИ.',
  'ПРОВЕРЯЕМ КЛЕТЧАТКУ.',
  'ЗАТОЧКАЕМ КАРАНДАШИ.',
  'СЧИТАЕМ ГОРОШИНКИ.',
  'ПРЯЧЕМ СЕКРЕТЫ.',
  'СМАЗЫВАЕМ ПРУЖИНЫ.',
  'КАЛИБРУЕМ МАСШТАБ.',
  'ВКЛЮЧАЕМ СВЕЧЕНИЕ.',
  'СКЛЕИВАЕМ КАРТОЧКИ.',
  'ПОДБИРАЕМ ТЕНИ.',
  'ВЫРАВНИВАЕМ ПОЛЯ.',
  'ДОСТАЁМ БУМАГУ ИЗ-ПОД КОНСОЛИ.',
  'ПЕРЕСЧИТЫВАЕМ КОЛЕЧКИ ПОСЛЕ ТОЛКИНА.',
  'ПРОТИРАЕМ МОНИТОР.',
  'РАЗМОРАЖИВАЕМ ПЕЛЬМЕНИ.',
  'ПРОВЕРЯЕМ РЕАКЦИЮ В ТЕТРИСЕ.',
  'СИНХРОНИЗИРУЕМ ЧАСЫ С КРЕМЛЁМ.',
  'ВЫРАВНИВАЕМ ТЕНИ ПЛАТОНА.',
  'КРЕМИРУЕМ КОТА ШРЁДИНГЕРА.',
  'ПРОБУЕМ ВСПОМНИТЬ ПАРОЛЬ.',
  'НАСТРАИВАЕМ НАСТРОЙКИ.',
  'ЗАПУСКАЕМ ГЕНЕРАТОР ПУСТОТЫ.',
  'СТЕЛИМ ДОРОГУ.',
  'ПОЛИРУЕМ НОС БУРАТИНО.',
  'ВСПОМИНАЕМ ДЕНЬ НЕДЕЛИ.',
  'ПРИКРУЧИВАЕМ ПЛАНЕТУ К ОСИ.',
  'ОТКЛЮЧАЕМ АНТИВИРУС.',
  'ИЗМЕРЯЕМ УРОВЕНЬ КРИНЖА.',
  'ЗАЛИВАЕМ ЗА ШИВОРОТ.',
  'ПРОВЕРЯЕМ СТАТУС.',
  'ОБНОВЛЯЕМ ЛИЦЕНЗИЮ.',
  'ЗАГРУЖАЕМ АТМОСФЕРУ.',
  'ВЫЧИСЛЯЕМ ВАЙБ.',
  'ВКЛЮЧАЕМ МОЗГ.',
  'РАЗГЛАЖИВАЕМ ГОЛСТУКИ.',
  'СТАВИМ ЗАПЛАТКУ.',
  'ОПРЕДЕЛЯЕМ ЦВЕТ ПЛАТЬЯ.',
  'ЗАМЕРЯЕМ РАДИАЦИЮ.',
  'ДЕЛАЕМ ЗАРЯДКУ.',
  'ТЕСТИРУЕМ ЭФФЕКТ ДОМИНО.',
  'ПЕРЕЧИТЫВАЕМ ГЕГЕЛЯ.',
  'ЗАПИСЫВАЕМ ПАРОЛЬ.',
  'ПЕРЕСЧИТЫВАЕМ ОВЕЦ.',
  'СМАЗЫВАЕМ ДВЕРЬ.',
  'ОБНОВЛЯЕМ ВИНДУ.',
  'РАССЧИТЫВАЕМ ДОЗУ КОФЕИНА.',
  'ОТМЕРЯЕМ СЕМЬ РАЗ.',
  'УСКОРЯЕМСЯ ВПЕРЁД.',
  'ПРОВЕРЯЕМ ОБОРУДОВАНИЕ.',
  'ДОПИСЫВАЕМ КОД.',
  'ОСМЫСЛИВАЕМ ГРАВИТАЦИЮ.',
  'ПЕРЕЧИТЫВАЕМ ДЕКАРТА.',
  'РАЗДУМЫВАЕМ НАД ПРОЕКТОМ.',
  'СЧИТАЕМ ДО ТЫСЯЧИ.',
  'ЗАКЛЕИВАЕМ МЫШКУ.',
  'ОБНОВЛЯЕМ ПРОШИВКУ.',
  'РИСУЕМ ЧЁРНЫЙ КВАДРАТ.',
  'ПЕРЕСМАТРИВАЕМ ТЕРМИНАТОРА.',
  'ЗАПУСКАЕМ СИСТЕМУ.',
  'СКАНИРУЕМ ДИСК ЦЭ.',
  'ИЩЕМ ВТОРУЮ ЧАСТЬ.',
  'ЗАСТАВЛЯЕМ НАС УВАЖАТЬ.',
  'ВЫДАЁМ БАЗУ.',
  'ЗАПРАВЛЯЕМ РУБАШКУ.',
  'ОХЛАЖДАЕМ ПРОЦЕССОР.',
  'СТАВИМ НА ПАУЗУ.',
  'ДЕЛИМ НА НОЛЬ.',
  'ПРОВЕРЯЕМ НА ВШИВОСТЬ.',
  'СЧИТАЕМ ЗВЁЗДЫ.',
  'РАСПАКОВЫВАЕМ ЧЕМОДАНЫ.',
  'ОБУЧАЕМ МЕДВЕДЯ.',
  'СТАВИМ НА ВИД.',
  'ПЕРЕКРАШИВАЕМ ЗАБОР.',
  'НАЛАЖИВАЕМ ТЕЛЕПАТИЮ.',
  'РАЗГАДЫВАЕМ КРОССВОРД.',
  'ДОБАВЛЯЕМ ЛОЖКУ ДЁГТЯ В МЁД.',
  'ПРОБУЕМ ПУЭР.',
  'УСТАНАВЛИВАЕМ КРЕДИТ ДОВЕРИЯ.',
  'ЗАПУСКАЕМ САЛЮТ.',
  'ПРОВЕРЯЕМ КОДЫ.',
  'ИЗМЕРЯЕМ ГЛУБИНУ.',
  'ПОДКЛЮЧАЕМ МОНИТОР.',
  'ВЫРАВНИВАЕМ СТРОЙ.',
  'ПЕРЕСЧИТЫВАЕМ ПО ГОЛОВАМ.',
  'НАСТРАИВАЕМ СВЕТ.',
  'ОБНОВЛЯЕМ ДРАЙВЕРЫ.',
  'РАСКЛАДЫВАЕМ КОСЫНКУ.',
  'ПЕРЕВОДИМ С АНГЛИЙСКОГО.',
  'ЗАГРУЖАЕМ РЕЦЕПТ.',
  'ЗАКРЫВАЕМ ЯЩИК ПАНДОРЫ.',
  'ОТКРЫВАЕМ ПОРТАЛ.',
  'СТАВИМ ТИТРЫ.',
  'ОБНОВЛЯЕМ КАЛЕНДАРЬ.',
  'ИЩЕМ ВЫХОД.',
  'ЗАПУСКАЕМ СЕРДЦЕ.',
  'ПРОВЕРЯЕМ МАТРИЦЫ.',
  'ОТКРЫВАЕМ БУТЫЛКУ.',
  'ЗАКРАШИВАЕМ БЕЛЫЕ ПЯТНА.',
  'ЗАПУСКАЕМ ГОЛУБЯ.',
  'ВЫРАВНИВАЕМ БАЛАНСЫ.',
  'ЗАГРУЖАЕМ СМЫСЛЫ.',
  'ПОДКЛЮЧАЕМ КЛАВИАТУРУ.',
  'СОХРАНЯЕМ ПРИРОДУ.',
];
const TAIL: string[] = ['ЗАГРУЗКА ПРОДОЛЖАЕТСЯ.', 'ЖДИТЕ.'];

const FRAME_MS = 45;
const REVEAL_EVERY = 2; // кадров на символ
const HOLD_MS = 620;

// последовательность запуска: открытие фиксировано, пул тасуется
function buildSequence(): string[] {
  const pool = [...POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return [...OPENING, ...pool];
}

export function BootSplash() {
  const lockGate = useAppStore((s) => s.lockGate);
  const loaded = useAppStore((s) => s.loaded);
  const unlockVault = useAppStore((s) => s.unlockVault);
  const setLockGate = useAppStore((s) => s.setLockGate);

  const passwordMode = lockGate !== 'off' && lockGate !== 'unlocking';
  const done = loaded && (lockGate === 'unlocking' || lockGate === 'off');

  // ---- скрамбл-текст: перебор глифов → проявление слева направо ----
  const [text, setText] = useState('');
  const [shown, setShown] = useState(0);
  const idx = useRef(0);
  const startedAt = useRef(Date.now());
  const shownRef = useRef(0);
  const sequence = useMemo(buildSequence, []);

  useEffect(() => {
    let frame = 0;
    let holdUntil = 0;
    let target = sequence[idx.current];
    setText(target);
    shownRef.current = 0;
    setShown(0);
    const id = setInterval(() => {
      frame++;
      const now = Date.now();
      if (shownRef.current < target.length) {
        if (frame % REVEAL_EVERY === 0) {
          shownRef.current += 1;
          setShown(shownRef.current);
        }
        const chars = target.split('').map((c, i) => {
          if (i < shownRef.current || c === ' ') return c;
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        });
        setText(chars.join(''));
      } else if (holdUntil === 0) {
        setText(target);
        holdUntil = now + HOLD_MS;
      } else if (now >= holdUntil) {
        idx.current += 1;
        target = idx.current < sequence.length
          ? sequence[idx.current]
          : TAIL[(idx.current - sequence.length) % TAIL.length];
        shownRef.current = 0;
        setShown(0);
        holdUntil = 0;
        setText(target);
      }
    }, FRAME_MS);
    return () => clearInterval(id);
  }, []);

  // ---- таяние слоя, когда всё готово ----
  const [fading, setFading] = useState(false);
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (!done) return;
    const elapsed = Date.now() - startedAt.current;
    const wait = Math.max(0, 1200 - elapsed);
    const t1 = setTimeout(() => setFading(true), wait);
    const t2 = setTimeout(() => setHidden(true), wait + 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [done]);

  useEffect(() => {
    if (hidden && lockGate !== 'off') setLockGate('off');
  }, [hidden, lockGate, setLockGate]);

  // ---- пароль ----
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [bad, setBad] = useState<'none' | 'pass' | 'repeat'>('none');
  const [busy, setBusy] = useState(false);
  const isNew = lockGate === 'new';

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    const ok = await unlockVault(pass);
    setBusy(false);
    if (!ok) {
      if (isNew && pass.length < 4) setBad('pass');
      else if (isNew && pass2 !== pass) setBad('repeat');
      else setBad('pass');
    }
  };

  const line = (
    value: string,
    setValue: (v: string) => void,
    error: boolean,
    autofocus: boolean,
  ) => (
    <div className="boot-line-wrap">
      <input
        type="password"
        value={value}
        autoFocus={autofocus}
        onChange={(e) => {
          setValue(e.target.value);
          if (error) setBad('none');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void submit();
          e.stopPropagation();
        }}
        className="boot-pass-line"
        style={{
          borderBottomColor: error ? '#c0392b' : value ? '#8d8d84' : '#3d3d38',
          color: error ? '#d97b6f' : '#d9d9d1',
        }}
      />
      <span className="boot-caret" />
    </div>
  );

  if (hidden) return null;

  return (
    <div
      className="boot-stage fixed inset-0 z-[2147483647] flex flex-col items-center"
      style={{
        backgroundColor: '#050506',
        opacity: fading ? 0 : 1,
        transition: 'opacity 800ms ease',
        pointerEvents: fading ? 'none' : 'auto',
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* скрамбл-фраза */}
      <div
        className="select-none text-center"
        style={{
          marginTop: '38vh',
          fontFamily: 'var(--font-jbmono), ui-monospace, monospace',
          fontSize: 'clamp(18px, 3.4vw, 34px)',
          fontWeight: 700,
          letterSpacing: '0.08em',
          color: shown >= text.length ? '#c9c4b8' : '#8f8b80',
        }}
      >
        {text}
      </div>

      {/* пароль — только когда хранилище запрошено */}
      {passwordMode ? (
        <div
          className="flex flex-col items-center"
          style={{
            marginTop: '10vh',
            fontFamily: 'var(--font-jbmono), ui-monospace, monospace',
            width: 320,
          }}
        >
          {isNew ? (
            <div
              className="select-none text-center text-[10px] font-bold tracking-[0.14em]"
              style={{ color: '#77705f', marginBottom: 18 }}
            >
              ПАРОЛЬ ВОССТАНОВИТЬ НЕВОЗМОЖНО
            </div>
          ) : null}
          {line(pass, setPass, bad === 'pass', true)}
          {isNew ? line(pass2, setPass2, bad === 'repeat', false) : null}
        </div>
      ) : null}
    </div>
  );
}
