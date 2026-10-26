import { rotateCW, stickerIndex, STICKERS, type Vec3 } from './geometry';

/**
 * Ký hiệu chuyển động.
 * - U D L R F B: quay một lớp ngoài.
 * - u d l r f b: quay hai lớp (lớp ngoài + lớp giữa cạnh đó), còn gọi là wide move.
 * - M E S: lát cắt giữa; M theo chiều L, E theo chiều D, S theo chiều F.
 * - x y z: quay toàn khối theo chiều R, U, F.
 */
export type MoveFace =
  | 'U' | 'D' | 'L' | 'R' | 'F' | 'B'
  | 'u' | 'd' | 'l' | 'r' | 'f' | 'b'
  | 'M' | 'E' | 'S'
  | 'x' | 'y' | 'z';

/** amount: 1 = thuận chiều kim đồng hồ (ký hiệu thường), 2 = 180°, 3 = ngược chiều (dấu nháy). */
export type MoveAmount = 1 | 2 | 3;

export interface Move {
  readonly face: MoveFace;
  readonly amount: MoveAmount;
}

interface LayerDef {
  /** Trục quay; chiều quay là CW khi nhìn từ đầu trục. */
  readonly axis: Vec3;
  /** Các giá trị của p·axis được chọn làm lớp quay. */
  readonly depths: readonly number[];
}

export const LAYER_DEFS: Readonly<Record<MoveFace, LayerDef>> = {
  U: { axis: [0, 1, 0], depths: [1] },
  D: { axis: [0, -1, 0], depths: [1] },
  R: { axis: [1, 0, 0], depths: [1] },
  L: { axis: [-1, 0, 0], depths: [1] },
  F: { axis: [0, 0, 1], depths: [1] },
  B: { axis: [0, 0, -1], depths: [1] },
  u: { axis: [0, 1, 0], depths: [0, 1] },
  d: { axis: [0, -1, 0], depths: [0, 1] },
  r: { axis: [1, 0, 0], depths: [0, 1] },
  l: { axis: [-1, 0, 0], depths: [0, 1] },
  f: { axis: [0, 0, 1], depths: [0, 1] },
  b: { axis: [0, 0, -1], depths: [0, 1] },
  M: { axis: [-1, 0, 0], depths: [0] },
  E: { axis: [0, -1, 0], depths: [0] },
  S: { axis: [0, 0, 1], depths: [0] },
  x: { axis: [1, 0, 0], depths: [-1, 0, 1] },
  y: { axis: [0, 1, 0], depths: [-1, 0, 1] },
  z: { axis: [0, 0, 1], depths: [-1, 0, 1] },
};

export const ALL_MOVE_FACES = Object.keys(LAYER_DEFS) as MoveFace[];

/** Chuỗi ký hiệu của một chuyển động, ví dụ R, R', R2. */
export function moveToString(move: Move): string {
  return move.amount === 1 ? move.face : move.amount === 2 ? `${move.face}2` : `${move.face}'`;
}

export function invertMove(move: Move): Move {
  return { face: move.face, amount: (4 - move.amount) as MoveAmount };
}

const permutationCache = new Map<string, readonly number[]>();

/**
 * Hoán vị một lượt quay CW (amount = 1). perm[i] = j nghĩa là sticker tại chỉ số i
 * sau khi quay sẽ nằm ở chỉ số j.
 */
function buildSingleTurnPermutation(face: MoveFace): readonly number[] {
  const def = LAYER_DEFS[face];
  const perm: number[] = new Array(STICKERS.length);
  STICKERS.forEach((sticker, i) => {
    const along = sticker.pos[0] * def.axis[0] + sticker.pos[1] * def.axis[1] + sticker.pos[2] * def.axis[2];
    if (!def.depths.includes(along)) {
      perm[i] = i;
      return;
    }
    const newPos = rotateCW(sticker.pos, def.axis);
    const newNormal = rotateCW(sticker.normal, def.axis);
    const j = stickerIndex(newPos, newNormal);
    if (j < 0) {
      throw new Error(`Internal error: rotated sticker not found for face ${face} at index ${i}`);
    }
    perm[i] = j;
  });
  return perm;
}

/** Hoán vị đầy đủ cho một chuyển động (đã tính theo amount), có cache. */
export function movePermutation(move: Move): readonly number[] {
  const key = `${move.face}${move.amount}`;
  const cached = permutationCache.get(key);
  if (cached) return cached;

  const single = buildSingleTurnPermutation(move.face);
  let total: number[] = STICKERS.map((_, i) => i);
  for (let t = 0; t < move.amount; t++) {
    total = total.map((idx) => single[idx]);
  }
  permutationCache.set(key, total);
  return total;
}
