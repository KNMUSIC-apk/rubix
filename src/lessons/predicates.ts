import { STICKERS, type Vec3 } from '../cube/geometry';
import { colorAt, isSolved, solvedState, type CubeState } from '../cube/state';

/**
 * Các điều kiện kiểm tra cho bài học. Quy ước: mặt trắng ở trên (U), mặt vàng ở dưới (D).
 * Mỗi điều kiện so sánh màu sticker thực tế với màu của khối đã giải, nên không phụ thuộc
 * vào cách trạng thái được tạo ra. Tất cả đều là hàm thuần.
 */

const SOLVED = solvedState();

function stickersMatchSolved(state: CubeState, filter: (pos: Vec3, normal: Vec3) => boolean): boolean {
  return STICKERS.every((s, i) => !filter(s.pos, s.normal) || state.stickers[i] === SOLVED.stickers[i]);
}

const U_EDGE_POSITIONS: readonly Vec3[] = [
  [1, 1, 0],
  [0, 1, 1],
  [-1, 1, 0],
  [0, 1, -1],
];
const D_EDGE_POSITIONS: readonly Vec3[] = [
  [1, -1, 0],
  [0, -1, 1],
  [-1, -1, 0],
  [0, -1, -1],
];

const samePos = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Dấu cộng trắng: bốn cạnh lớp trên có mặt trắng hướng lên và màu cạnh đúng với tâm. */
export function crossSolved(state: CubeState): boolean {
  return stickersMatchSolved(state, (pos) => U_EDGE_POSITIONS.some((e) => samePos(e, pos)));
}

/** Lớp đầu hoàn chỉnh: toàn bộ sticker của lớp trên đúng màu (dấu cộng và bốn góc trắng). */
export function firstLayerSolved(state: CubeState): boolean {
  return stickersMatchSolved(state, (pos) => pos[1] === 1);
}

/** Hai lớp đầu hoàn chỉnh (lớp trên và lớp giữa). */
export function secondLayerSolved(state: CubeState): boolean {
  return firstLayerSolved(state) && stickersMatchSolved(state, (pos) => pos[1] === 0);
}

/** Dấu cộng vàng ở mặt dưới: bốn cạnh có mặt vàng hướng xuống. */
export function yellowCrossSolved(state: CubeState): boolean {
  return D_EDGE_POSITIONS.every((pos) => {
    const idx = STICKERS.findIndex((s) => samePos(s.pos, pos) && s.normal[1] === -1);
    return state.stickers[idx] === 'Y';
  });
}

/** Mặt vàng hoàn chỉnh: toàn bộ sticker mặt dưới đều vàng (OLL hoàn tất). */
export function yellowFaceSolved(state: CubeState): boolean {
  return STICKERS.every((s, i) => s.normal[1] !== -1 || state.stickers[i] === 'Y');
}

/** Các góc và cạnh của lớp dưới đúng vị trí (PLL góc và cạnh đã xong, chưa cần đúng hướng lớp trên). */
export function lastLayerPositionedSolved(state: CubeState): boolean {
  return stickersMatchSolved(state, (pos) => pos[1] === -1);
}

/** Khối đã giải hoàn toàn. */
export function cubeSolved(state: CubeState): boolean {
  return isSolved(state);
}

/** Dùng để kiểm tra một cubie cụ thể đúng vị trí và hướng. */
export function stickerAt(state: CubeState, pos: Vec3, normal: Vec3): string {
  return colorAt(state, pos, normal);
}

export const PREDICATES = {
  cross: crossSolved,
  firstLayer: firstLayerSolved,
  secondLayer: secondLayerSolved,
  yellowCross: yellowCrossSolved,
  yellowFace: yellowFaceSolved,
  lastLayerPositioned: lastLayerPositionedSolved,
  solved: cubeSolved,
} as const;

export type PredicateId = keyof typeof PREDICATES;
