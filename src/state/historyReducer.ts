import { createHistory, pushMove, redo as redoHistory, undo as undoHistory, type CubeHistory } from '../cube/history';
import type { Move } from '../cube/moves';

/** Hành động làm thay đổi lịch sử sau khi animation tương ứng đã hoàn tất. */
export type HistoryAction =
  | { readonly type: 'commit'; readonly move: Move; readonly rebase: boolean }
  | { readonly type: 'undo' }
  | { readonly type: 'redo' };

/**
 * Hàm thuần: áp dụng một hành động lên lịch sử.
 * `rebase` dùng cho scramble: đặt điểm gốc mới để Undo không đưa khối về trạng thái đã giải.
 */
export function reduceHistory(h: CubeHistory, action: HistoryAction): CubeHistory {
  switch (action.type) {
    case 'commit': {
      const next = pushMove(h, action.move);
      if (!action.rebase) return next;
      return { ...createHistory(next.present), turnCount: 0 };
    }
    case 'undo':
      return undoHistory(h);
    case 'redo':
      return redoHistory(h);
  }
}
