import { FACE_NORMAL, FACE_ORDER, SOLVED_FACE_COLOR, STICKERS, stickerIndex, type Color } from './geometry';
import { movePermutation, type Move } from './moves';

/**
 * Trạng thái khối: màu của 54 sticker theo thứ tự STICKERS.
 * Đây là nguồn dữ liệu duy nhất (single source of truth) cho cả 3D, bảng công thức và kiểm tra.
 * Đối tượng được coi là bất biến: mọi thao tác trả về một mảng mới.
 */
export interface CubeState {
  readonly stickers: readonly Color[];
}

export function solvedState(): CubeState {
  return {
    stickers: STICKERS.map((s) => {
      const face = FACE_ORDER.find((f) => {
        const n = FACE_NORMAL[f];
        return n[0] === s.normal[0] && n[1] === s.normal[1] && n[2] === s.normal[2];
      });
      if (!face) throw new Error('Internal error: sticker normal does not match a face');
      return SOLVED_FACE_COLOR[face];
    }),
  };
}

export function applyMove(state: CubeState, move: Move): CubeState {
  const perm = movePermutation(move);
  const next: Color[] = new Array(state.stickers.length);
  for (let i = 0; i < perm.length; i++) {
    next[perm[i]] = state.stickers[i];
  }
  return { stickers: next };
}

export function applyMoves(state: CubeState, moves: readonly Move[]): CubeState {
  return moves.reduce((s, m) => applyMove(s, m), state);
}

export function isSolved(state: CubeState): boolean {
  const solved = solvedState();
  return state.stickers.every((c, i) => c === solved.stickers[i]);
}

/** Màu tại một sticker cụ thể (pos, normal). Ném lỗi nếu sticker không tồn tại. */
export function colorAt(state: CubeState, pos: readonly [number, number, number], normal: readonly [number, number, number]): Color {
  const idx = stickerIndex(pos, normal);
  if (idx < 0) throw new Error('Sticker does not exist on the outside of the cube');
  return state.stickers[idx];
}

export function sameState(a: CubeState, b: CubeState): boolean {
  return a.stickers.length === b.stickers.length && a.stickers.every((c, i) => c === b.stickers[i]);
}
