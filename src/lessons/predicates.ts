import { STICKERS, type Vec3 } from '../cube/geometry';
import { isSolved, solvedState, type CubeState } from '../cube/state';

/**
 * Điều kiện kiểm tra cho bài học. Quy ước: mặt trắng ở dưới (D), mặt vàng ở trên (U).
 * Mỗi điều kiện so sánh màu sticker thực tế với màu của khối đã giải nên không phụ thuộc
 * cách trạng thái được tạo ra. Tất cả đều là hàm thuần.
 */

const SOLVED = solvedState();

const samePos = (a: Vec3, b: Vec3) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** Các cạnh lớp dưới (D) và lớp trên (U). */
const D_EDGES: readonly Vec3[] = [
  [1, -1, 0],
  [0, -1, 1],
  [-1, -1, 0],
  [0, -1, -1],
];
const U_EDGES: readonly Vec3[] = [
  [1, 1, 0],
  [0, 1, 1],
  [-1, 1, 0],
  [0, 1, -1],
];

/** Mọi sticker thỏa mãn `filter` đều phải khớp màu khối đã giải. */
function matchesSolved(state: CubeState, filter: (pos: Vec3, normal: Vec3) => boolean): boolean {
  return STICKERS.every((s, i) => !filter(s.pos, s.normal) || state.stickers[i] === SOLVED.stickers[i]);
}

/** Dấu cộng trắng: bốn cạnh lớp dưới đúng vị trí và đúng hướng. */
export function whiteCrossSolved(state: CubeState): boolean {
  return matchesSolved(state, (pos) => D_EDGES.some((e) => samePos(e, pos)));
}

/** Lớp đầu hoàn chỉnh: toàn bộ sticker lớp dưới đúng màu. */
export function firstLayerSolved(state: CubeState): boolean {
  return matchesSolved(state, (pos) => pos[1] === -1);
}

/** Hai lớp đầu hoàn chỉnh. */
export function secondLayerSolved(state: CubeState): boolean {
  return firstLayerSolved(state) && matchesSolved(state, (pos) => pos[1] === 0);
}

/** Dấu cộng vàng: bốn sticker vàng hướng lên trên ở các cạnh lớp trên. */
export function yellowCrossSolved(state: CubeState): boolean {
  return U_EDGES.every((pos) => {
    const idx = STICKERS.findIndex((s) => samePos(s.pos, pos) && s.normal[1] === 1);
    return state.stickers[idx] === 'Y';
  });
}

/** Mặt vàng hoàn chỉnh: toàn bộ sticker mặt trên đều vàng (OLL hoàn tất). */
export function yellowFaceSolved(state: CubeState): boolean {
  return STICKERS.every((s, i) => s.normal[1] !== 1 || state.stickers[i] === 'Y');
}

/** Lớp vàng đúng vị trí (PLL hoàn tất về vị trí, hướng đã đúng). */
export function lastLayerPositionedSolved(state: CubeState): boolean {
  return matchesSolved(state, (pos) => pos[1] === 1);
}

export function cubeSolved(state: CubeState): boolean {
  return isSolved(state);
}

export const PREDICATES = {
  whiteCross: whiteCrossSolved,
  firstLayer: firstLayerSolved,
  secondLayer: secondLayerSolved,
  yellowCross: yellowCrossSolved,
  yellowFace: yellowFaceSolved,
  lastLayerPositioned: lastLayerPositionedSolved,
  solved: cubeSolved,
} as const;

export type PredicateId = keyof typeof PREDICATES;
