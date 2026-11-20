import type { Board, Card, CardData, CardType } from './types';
import { cardDefaultSize } from './types';

function mk(
  id: string,
  type: CardType,
  x: number,
  y: number,
  data: CardData,
  sizeOverride?: { w?: number; h?: number }
): Card {
  const def = cardDefaultSize(type);
  return {
    id,
    type,
    x,
    y,
    w: sizeOverride?.w ?? def.w,
    h: sizeOverride?.h ?? def.h,
    data,
  };
}

export function createSeed(): { boards: Record<string, Board>; openBoardId: string | null } {
  const now = Date.now();

  const welcome: Board = {
    id: 'board-welcome',
    title: 'Демонстрация возможностей',
    cards: [
      mk('w-warning', 'note', -105, -75, {
        kind: 'note',
        text: 'Веб-версия — демонстрационная. Не храните здесь что-то важное: данные живут только в этом браузере.\n\nДля полноценного использования скачайте десктопную версию и носите с собой на флешке.',
        color: 'yellow',
      }),
    ],
    connections: [],
    createdAt: now,
    updatedAt: now,
  };

  return {
    boards: { [welcome.id]: welcome },
    openBoardId: welcome.id,
  };
}
