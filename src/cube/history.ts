import { applyMove, solvedState, type CubeState } from './state';
import type { Move } from './moves';

interface UndoneStep {
  /** Trạng thái ngay sau khi chuyển động này được thực hiện. */
  readonly state: CubeState;
  readonly move: Move;
}

/**
 * Lịch sử thao tác dạng dữ liệu thuần (immutable). Undo/Redo không cần giải lại từ đầu.
 */
export interface CubeHistory {
  readonly present: CubeState;
  /** Các trạng thái trước đó, phần tử cuối là trạng thái ngay trước `present`. */
  readonly past: readonly CubeState[];
  /** Các bước đã Undo, phần tử đầu là bước sẽ được Redo tiếp theo. */
  readonly future: readonly UndoneStep[];
  /** Nhật ký chuyển động đang có hiệu lực (khớp với past). */
  readonly moves: readonly Move[];
  /** Số lượt quay đã thực hiện trong phiên (tăng khi push, không giảm khi Undo). */
  readonly turnCount: number;
}

export function createHistory(initial: CubeState = solvedState()): CubeHistory {
  return { present: initial, past: [], future: [], moves: [], turnCount: 0 };
}

export function pushMove(h: CubeHistory, move: Move): CubeHistory {
  return {
    present: applyMove(h.present, move),
    past: [...h.past, h.present],
    future: [],
    moves: [...h.moves, move],
    turnCount: h.turnCount + 1,
  };
}

export function canUndo(h: CubeHistory): boolean {
  return h.moves.length > 0;
}

export function canRedo(h: CubeHistory): boolean {
  return h.future.length > 0;
}

export function undo(h: CubeHistory): CubeHistory {
  if (!canUndo(h)) return h;
  const lastMove = h.moves[h.moves.length - 1];
  return {
    present: h.past[h.past.length - 1],
    past: h.past.slice(0, -1),
    future: [{ state: h.present, move: lastMove }, ...h.future],
    moves: h.moves.slice(0, -1),
    turnCount: h.turnCount,
  };
}

export function redo(h: CubeHistory): CubeHistory {
  if (!canRedo(h)) return h;
  const [next, ...rest] = h.future;
  return {
    present: next.state,
    past: [...h.past, h.present],
    future: rest,
    moves: [...h.moves, next.move],
    turnCount: h.turnCount,
  };
}
