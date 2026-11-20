

'use client';

import { useAppStore } from '@/lib/klaster/store';
import {
  DRAW_SIZES,
  DRAW_STYLES,
  DRAW_COLORS,
  DRAW_STYLE_META,
} from '@/lib/klaster/types';
import type { DrawStyle } from '@/lib/klaster/types';
import { Hint } from './Hint';
import { StrokeShape } from '@/lib/klaster/stroke';

const SIZE_LABELS = ['Тонкий', 'Обычный', 'Толстый', 'Очень толстый'];

export function DrawPanel({ boardId }: { boardId: string }) {
  const drawMode = useAppStore((s) => s.drawMode);
  const tool = useAppStore((s) => s.drawTool);
  const selection = useAppStore((s) => s.selection);
  const board = useAppStore((s) => s.boards[boardId]);

  const strokeId =
    !drawMode && selection.length === 1
      ? (board?.cards.find((c) => c.id === selection[0] && c.type === 'draw')?.id ?? null)
      : null;
  const stroke =
    strokeId && board ? board.cards.find((c) => c.id === strokeId) : null;
  const strokeData = stroke && stroke.data.kind === 'draw' ? stroke.data : null;

  if (!drawMode && !strokeData) return null;

  const width = drawMode ? tool.width : strokeData!.width;
  const style = drawMode ? tool.style : strokeData!.style ?? 'pen';
  const color = drawMode ? tool.color : strokeData!.color ?? null;

  const apply = (patch: { width?: number; style?: DrawStyle; color?: string | null }) => {
    const st = useAppStore.getState();
    if (drawMode) {
      st.setDrawTool(patch);
    } else if (strokeId) {
      st.pushHistory();
      st.updateCardData(strokeId, {
        kind: 'draw',
        width: patch.width ?? width,
        style: patch.style ?? style,
        color: patch.color !== undefined ? patch.color : color,
        points: strokeData!.points,
        strokes: strokeData!.strokes?.map((stroke) => ({
          ...stroke,
          width: patch.width ?? stroke.width,
          style: patch.style ?? stroke.style,
          color: patch.color !== undefined ? patch.color : stroke.color,
        })),
      });
    }
  };

  return (
    <div className="draw-panel" onPointerDown={(e) => e.stopPropagation()}>
      <div className="draw-panel-row">
        {}
        <span className="draw-panel-label">Толщина</span>
        {DRAW_SIZES.map((s, i) => (
          <Hint key={s} label={SIZE_LABELS[i] ?? String(s)} side="bottom">
            <button
              aria-label={`Толщина ${SIZE_LABELS[i] ?? s}`}
              aria-pressed={width === s}
              className={'draw-size-btn' + (width === s ? ' is-active' : '')}
              onClick={() => {
                apply({ width: s });
              }}
            >
              <span className="draw-size-dot" style={{ width: 4 + i * 3.2, height: 4 + i * 3.2 }} />
            </button>
          </Hint>
        ))}

        <span className="draw-panel-sep" />

        {}
        {DRAW_STYLES.map((st) => (
          <Hint key={st} label={DRAW_STYLE_META[st].label} desc={DRAW_STYLE_META[st].desc} side="bottom">
            <button
              aria-label={DRAW_STYLE_META[st].label}
              aria-pressed={style === st}
              className={'draw-style-btn' + (style === st ? ' is-active' : '')}
              onClick={() => {
                apply({ style: st });
              }}
            >
              <svg width="26" height="12" viewBox="0 0 26 12">
                {strokeSample(st)}
              </svg>
            </button>
          </Hint>
        ))}

        <span className="draw-panel-sep" />

        {}
        {DRAW_COLORS.map((c) => (
          <Hint key={c.id} label={c.label} side="bottom">
            <button
              aria-label={c.label}
              aria-pressed={color === c.hex}
              className={'draw-color-btn' + (color === c.hex ? ' is-active' : '')}
              style={{ background: c.hex ?? 'var(--text-main)' }}
              onClick={() => {
                apply({ color: c.hex });
              }}
            />
          </Hint>
        ))}
      </div>
      <div className="draw-panel-row draw-panel-foot">
        {drawMode ? (
          <>
            <span className="draw-dot" />
            Черновик рисунка
            <div className="draw-panel-actions">
              <button
                className="draw-session-btn"
                onClick={() => useAppStore.getState().cancelDrawMode()}
              >
                Отмена
              </button>
              <button
                className="draw-session-btn is-save"
                onClick={() => useAppStore.getState().setDrawMode(false)}
              >
                Сохранить
              </button>
            </div>
          </>
        ) : (
          <>Изменение штриха</>
        )}
      </div>
    </div>
  );
}

function strokeSample(style: DrawStyle) {
  const points = [2, 10, 5, 2, 8, 10, 11, 2, 14, 10, 17, 2, 20, 10, 24, 2];
  const pressures = [0.25, 0.45, 0.8, 0.5, 0.95, 0.3, 0.75, 0.35];
  return (
    <StrokeShape
      points={points}
      width={style === 'marker' ? 4 : 3.5}
      style={style}
      color="currentColor"
      pressures={pressures}
    />
  );
}
