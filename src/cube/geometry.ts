/**
 * Hình học của khối Rubik 3×3.
 *
 * Mỗi cubie nằm tại một tọa độ nguyên trong {-1, 0, 1}³ (tâm khối là (0,0,0)).
 * Mỗi sticker được xác định bởi (vị trí cubie, vector pháp tuyến hướng ra ngoài).
 * Chỉ có 54 sticker lộ ra ngoài (9 cho mỗi mặt), đó là trạng thái mà ta mô hình hóa.
 */

export type Vec3 = readonly [number, number, number];

export type FaceName = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

/** Màu sticker. Quy ước học tập: D trắng (lớp đầu ở dưới), U vàng, F xanh lá, R đỏ, L cam, B xanh dương. */
export type Color = 'W' | 'Y' | 'G' | 'B' | 'R' | 'O';

export interface Sticker {
  readonly pos: Vec3;
  readonly normal: Vec3;
}

export const FACE_ORDER: readonly FaceName[] = ['U', 'R', 'F', 'D', 'L', 'B'];

export const FACE_NORMAL: Readonly<Record<FaceName, Vec3>> = {
  U: [0, 1, 0],
  R: [1, 0, 0],
  F: [0, 0, 1],
  D: [0, -1, 0],
  L: [-1, 0, 0],
  B: [0, 0, -1],
};

/** Màu của tâm mỗi mặt khi khối đã giải. */
export const SOLVED_FACE_COLOR: Readonly<Record<FaceName, Color>> = {
  U: 'Y',
  R: 'R',
  F: 'G',
  D: 'W',
  L: 'O',
  B: 'B',
};

export const COLORS: readonly Color[] = ['W', 'Y', 'G', 'B', 'R', 'O'];

export function vec(x: number, y: number, z: number): Vec3 {
  return [x, y, z];
}

export function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

export function vecEquals(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

/**
 * Xoay một vector 90° theo chiều kim đồng hồ khi nhìn từ đầu mũi tên của `axis`
 * (tức là chiều quay của mặt có pháp tuyến `axis`, ví dụ R khi axis = (1,0,0)).
 * Công thức: v' = v × n + (v·n) n. Thành phần song song với trục giữ nguyên.
 */
export function rotateCW(v: Vec3, axis: Vec3): Vec3 {
  const c = cross(v, axis);
  const d = dot(v, axis);
  return [c[0] + d * axis[0], c[1] + d * axis[1], c[2] + d * axis[2]];
}

export function stickerKey(pos: Vec3, normal: Vec3): string {
  return `${pos[0]},${pos[1]},${pos[2]}|${normal[0]},${normal[1]},${normal[2]}`;
}

/** Danh sách 54 sticker theo thứ tự cố định: U, R, F, D, L, B; mỗi mặt quét từ -1 đến 1. */
function buildStickers(): readonly Sticker[] {
  const result: Sticker[] = [];
  for (const face of FACE_ORDER) {
    const n = FACE_NORMAL[face];
    const axes = [0, 1, 2].filter((i) => n[i] === 0);
    const depthAxis = n.findIndex((c) => c !== 0);
    for (const a of [-1, 0, 1]) {
      for (const b of [-1, 0, 1]) {
        const p: [number, number, number] = [0, 0, 0];
        p[depthAxis] = n[depthAxis];
        p[axes[0]] = a;
        p[axes[1]] = b;
        result.push({ pos: [p[0], p[1], p[2]], normal: n });
      }
    }
  }
  return result;
}

export const STICKERS: readonly Sticker[] = buildStickers();

const STICKER_INDEX: ReadonlyMap<string, number> = new Map(
  STICKERS.map((s, i) => [stickerKey(s.pos, s.normal), i] as const),
);

/** Chỉ số (0..53) của sticker tại (pos, normal), hoặc -1 nếu không tồn tại. */
export function stickerIndex(pos: Vec3, normal: Vec3): number {
  return STICKER_INDEX.get(stickerKey(pos, normal)) ?? -1;
}

/** Các cubie 8 góc theo thứ tự chuẩn URF, UFL, ULB, UBR, DFR, DLF, DBL, DRB. */
export const CORNER_POSITIONS: readonly Vec3[] = [
  [1, 1, 1],
  [-1, 1, 1],
  [-1, 1, -1],
  [1, 1, -1],
  [1, -1, 1],
  [-1, -1, 1],
  [-1, -1, -1],
  [1, -1, -1],
];

/** Các cubie 12 cạnh theo thứ tự chuẩn UR, UF, UL, UB, DR, DF, DL, DB, FR, FL, BL, BR. */
export const EDGE_POSITIONS: readonly Vec3[] = [
  [1, 1, 0],
  [0, 1, 1],
  [-1, 1, 0],
  [0, 1, -1],
  [1, -1, 0],
  [0, -1, 1],
  [-1, -1, 0],
  [0, -1, -1],
  [1, 0, 1],
  [-1, 0, 1],
  [-1, 0, -1],
  [1, 0, -1],
];

/** Các pháp tuyến lộ ra của một cubie góc. */
export function cornerNormals(pos: Vec3): readonly [Vec3, Vec3, Vec3] {
  return [
    [pos[0], 0, 0],
    [0, pos[1], 0],
    [0, 0, pos[2]],
  ];
}

/** Hai pháp tuyến lộ ra của một cubie cạnh. */
export function edgeNormals(pos: Vec3): readonly [Vec3, Vec3] {
  const exposed: Vec3[] = [];
  if (pos[0] !== 0) exposed.push([pos[0], 0, 0]);
  if (pos[1] !== 0) exposed.push([0, pos[1], 0]);
  if (pos[2] !== 0) exposed.push([0, 0, pos[2]]);
  return [exposed[0], exposed[1]];
}
