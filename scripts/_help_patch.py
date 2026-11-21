# -*- coding: utf-8 -*-
p = 'src/components/klaster/ContextMenu.tsx'
s = open(p, encoding='utf-8').read()

# 1) убрать Шаблоны
s = s.replace("import { uid } from '@/lib/klaster/id';\n", "")
s = s.replace("  const [templatesOpen, setTemplatesOpen] = useState(false);\n", "")

i = s.find("      { label: templatesOpen ? 'Шаблоны ▾' : 'Шаблоны ▸'")
j = s.find("  } else if (menu.kind === 'connection' && menu.connectionId) {")
assert i > 0 and j > i, 'templates block'
s = s[:i] + s[j:]

# 2) меню холста: ровно пять пунктов
old = """  } else if (menu.kind === 'canvas') {
    items.push(
      {
        label: 'Новый стикер',
        action: () => {
          const id = st.addCard('note', (menu.wx ?? 0) - 105, (menu.wy ?? 0) - 24);
          if (id) st.setEditing(id);
        },
      },
      {
        label: 'Вставить',
        action: () => st.pasteClipboard((menu.wx ?? 0), (menu.wy ?? 0)),
        hidden: !st.clipboard,
      },
      { label: 'Выделить всё', action: () => st.selectAll() },
      { label: 'По размеру листа', action: () => fitView(st.breadcrumb[st.breadcrumb.length - 1]) }
    );"""
new = """  } else if (menu.kind === 'canvas') {
    items.push(
      {
        label: 'Новый стикер',
        action: () => {
          const id = st.addCard('note', (menu.wx ?? 0) - 105, (menu.wy ?? 0) - 24);
          if (id) st.setEditing(id);
        },
      },
      { label: 'Выделить всё', action: () => st.selectAll() },
      {
        label: 'Центрировать экран',
        action: () => fitView(st.breadcrumb[st.breadcrumb.length - 1]),
      },
      { label: 'Экспорт', action: () => st.setExportOpen(true) },
      { label: 'Справка', action: () => st.setShortcutsOpen(true) },
    );"""
assert old in s, 'canvas items'
s = s.replace(old, new)
open(p, 'w', encoding='utf-8').write(s)

# ---- BottomBar: убрать ЦЕНТР. ----
p = 'src/components/klaster/BottomBar.tsx'
s = open(p, encoding='utf-8').read()
old = """            <span className="mr-[5px] inline-block w-[4px]" />
            <WordButton label="ЦЕНТР." ariaLabel="Лист по размеру окна" onClick={() => fitView(boardId)} />
"""
assert old in s, 'bar cent'
s = s.replace(old, "")
# fitView больше не нужен?
if 'fitView(' not in s:
    s = s.replace("import { fitView, zoomTo } from './Canvas';", "import { zoomTo } from './Canvas';")
open(p, 'w', encoding='utf-8').write(s)

# ---- Dialogs: новая справка, без крестика ----
p = 'src/components/klaster/Dialogs.tsx'
s = open(p, encoding='utf-8').read()

start = s.find('const SHORTCUTS: [string, string][] = [')
end = s.find('export function ShortcutsDialog() {')
assert start > 0 and end > start

new_content = '''const SHORTCUTS: [string, string][] = [
  ['ПАНОРАМА ЛИСТА', 'ПРОБЕЛ + ТЯНИ · СРЕДНЯЯ КНОПКА МЫШИ · ДВОЙНОЙ КЛИК ПО ХОЛСТУ С УДЕРЖАНИЕМ · НА СЕНСОРЕ — СВАЙП'],
  ['ПАНОРАМА С КЛАВИАТУРЫ', 'Ц (ВВЕРХ) · Ф (ВЛЕВО) · Ы (ВНИЗ) · В (ВПРАВО) — ЛАТИНСКИЕ W A S D. ВО ВРЕМЯ ТЯГИ КАРТОЧКИ ЭТИ ЖЕ КЛАВИШИ ДВИГАЮТ САМУ КАРТОЧКУ ВМЕСТЕ С ЭКРАНОМ'],
  ['МАСШТАБ', 'КОНТРОЛЬ + КОЛЕСО МЫШИ · КЛАВИШИ ПЛЮС И МИНУС · НА СЕНСОРЕ — ЩИПОК'],
  ['МАСШТАБ 100%', 'ЦИФРА НОЛЬ'],
  ['ВПИСАТЬ ОБЪЕКТЫ', 'ЦЕНТРИРОВАТЬ ЭКРАН В МЕНЮ ПРАВОЙ КНОПКИ ИЛИ КЛАВИША Ф (ЛАТИНСКАЯ F). ЛИСТ САМ СОБИРАЕТ ВСЕ ОБЪЕКТЫ И ВПИСЫВАЕТ ИХ ЦЕЛИКОМ В ОКНО — НИЧЕГО НЕ ОБРЕЗАЕТСЯ, ДАЖЕ САМЫЙ ДАЛЕКИЙ УГОЛ. ПОСЛЕ ЭТОГО МОЖНО ПОДРЕГУЛИРОВАТЬ МАСШТАБ ПЛЮСОМ И МИНУСОМ'],
  ['ВЕРНУТЬ / ПОВТОРИТЬ', 'КОНТРОЛЬ + Я / КОНТРОЛЬ + ШИФТ + Я — СЛОВА ВЕРНУТЬ И ПОВТОРИТЬ? В БАРЕ ДЕЛАЮТ ТО ЖЕ'],
  ['КОПИРОВАНИЕ', 'КОНТРОЛЬ + С (С) · КОНТРОЛЬ + Ч (ВЫРЕЗАТЬ) · КОНТРОЛЬ + М (ВСТАВИТЬ В ЦЕНТР ЭКРАНА)'],
  ['ДУБЛИКАТ', 'КОНТРОЛЬ + В (ЛАТИНСКАЯ D)'],
  ['ВЫДЕЛИТЬ ВСЁ', 'КОНТРОЛЬ + Ф (ЛАТИНСКАЯ A). ПУНКТ ВЫДЕЛИТЬ ВСЁ В МЕНЮ ПРАВОЙ КНОПКИ ДЕЛАЕТ ТО ЖЕ'],
  ['УДАЛЕНИЕ', 'ТОЛЬКО КЛАВИША ДЕЛИТ. БАКСПЕЙС НЕ УДАЛЯЕТ ОБЪЕКТЫ — ЭТО ЗАЩИТА ОТ СЛУЧАЙНОГО СТИРАНИЯ. СТРЕЛКИ СДВИГАЮТ ВЫДЕЛЕННОЕ, С ШИФТОМ — БЫСТРЕЕ'],
  ['КОЛОНКА', 'ПЕРЕТАЩИ ОДНУ КАРТОЧКУ НА ДРУГУЮ — ОБРАЗУЕТСЯ КОЛОНКА. ДОКЛАДЫВАЙ ВНУТРЬ ПРОСТЫМ ПЕРЕТАСКИВАНИЕМ, ПОРЯДОК МЕНЯЕТСЯ ТАЩЕНИЕМ. ПРАВАЯ КНОПКА ПО КОЛОНКЕ — РАЗГРУППИРОВАТЬ. ВЫТАЩИТЬ КАРТОЧКУ — ТАЩИ ИЗ КОЛОНКИ НА СВОБОДНОЕ МЕСТО'],
  ['СТРЕЛКИ', 'ТОЧКА СБОКУ КАРТОЧКИ: ПОТЯНИ К ДРУГОЙ КАРТОЧКЕ — ПОЯВИТСЯ СТРЕЛКА. ДВОЙНОЙ КЛИК ПО СТРЕЛКЕ — ПОДПИСЬ ЛИНИИ; ДВОЙНОЙ КЛИК ПО ПОДПИСИ — РЕДАКТИРОВАТЬ; ПРАВАЯ КНОПКА ПО СТРЕЛКЕ — ОСТРИЁ, ВЫПРЯМИТЬ, УДАЛИТЬ'],
  ['АДРЕС ЛИСТА', 'ТРОЕТОЧИЕ В БАРЕ: ПУТЬ ПО ВЛОЖЕННЫМ ЛИСТАМ. КЛИК ПО СТРАНИЦЕ АДРЕСА — ПЕРЕХОД К НЕЙ'],
  ['ВЫХОД ИЗ ПРИЛОЖЕНИЯ', 'АЛЬТЕРНАТИВНЫЙ + Ф4 ИЛИ НАДПИСЬ АЛЬТ+Ф4 В ПРАВОМ ВЕРХНЕМ УГЛУ'],
];

'''
s = s[:start] + new_content + s[end:]

old_body = '''      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>КАК?</DialogTitle>
          <DialogDescription>Справка: слова бара, горячие клавиши и приёмы.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[420px] overflow-y-auto pr-1">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-[var(--panel-border)] py-2 last:border-0">
              <span className="text-[13px]" style={{ color: 'var(--text-main)' }}>{v}</span>
              <span className="shrink-0 rounded border border-[var(--panel-border)] bg-[var(--chip-bg)] px-2 py-0.5 text-[12px] text-[var(--text-secondary)]">
                {k}
              </span>
            </div>
          ))}
          <div className="pb-1 pt-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-muted)]">Советы</div>
          {TIPS.map((t) => (
            <div key={t} className="py-1.5 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t}
            </div>
          ))}
        </div>
      </DialogContent>'''
new_body = '''      <DialogContent className="shortcuts-dialog max-w-[560px]" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>КАК?</DialogTitle>
          <DialogDescription>Управление и приёмы. Клавиши названы по-русски: КОНТРОЛЬ+Я — это привычное Ctrl+Z.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[440px] overflow-y-auto pr-1">
          {SHORTCUTS.map(([k, v]) => (
            <div key={k} className="border-b border-[var(--panel-border)] py-2.5 last:border-0">
              <div className="text-[12px] font-bold uppercase tracking-[0.08em]" style={{ color: 'var(--accent-strong)' }}>
                {k}
              </div>
              <div className="pt-1 text-[12.5px] leading-relaxed" style={{ color: 'var(--text-main)' }}>
                {v}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>'''
assert old_body in s, 'dialog body'
s = s.replace(old_body, new_body)

# убрать блок TIPS, если остался
import re
i = s.find('const TIPS: string[] = [')
if i > 0:
    j = s.find('];', i) + 2
    s = s[:i] + s[j:]

open(p, 'w', encoding='utf-8').write(s)
print('dialogs ok')
