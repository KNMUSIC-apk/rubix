import {
  CORNER_POSITIONS,
  EDGE_POSITIONS,
  cornerNormals,
  edgeNormals,
  type Color,
  type Vec3,
} from './geometry';
import { colorAt, solvedState, type CubeState } from './state';

/** Biểu diễn cấp cubie: hoán vị và hướng của 8 góc và 12 cạnh. */
export interface CubieRepresentation {
  /** cp[i] = chỉ số góc gốc đang nằm tại vị trí i. */
  readonly cp: readonly number[];
  /** co[i] ∈ {0,1,2}: hướng của góc tại vị trí i. */
  readonly co: readonly number[];
  /** ep[i] = chỉ số cạnh gốc đang nằm tại vị trí i. */
  readonly ep: readonly number[];
  /** eo[i] ∈ {0,1}: hướng của cạnh tại vị trí i. */
  readonly eo: readonly number[];
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly cubie?: CubieRepresentation;
}

const WHITE_OR_YELLOW: ReadonlySet<Color> = new Set<Color>(['W', 'Y']);

function keyOf(colors: readonly Color[]): string {
  return [...colors].sort().join('');
}

/** Map từ bộ màu (không phân biệt thứ tự) của mỗi góc gốc sang chỉ số góc gốc. */
const SOLVED = solvedState();
const CORNER_HOME: ReadonlyMap<string, number> = new Map(
  CORNER_POSITIONS.map((pos, h) => {
    const colors = cornerNormals(pos).map((n) => colorAt(SOLVED, pos, n));
    return [keyOf(colors), h] as const;
  }),
);
const EDGE_HOME: ReadonlyMap<string, number> = new Map(
  EDGE_POSITIONS.map((pos, h) => {
    const colors = edgeNormals(pos).map((n) => colorAt(SOLVED, pos, n));
    return [keyOf(colors), h] as const;
  }),
);

/**
 * Màu "tốt" của mỗi cạnh gốc: W/Y với cạnh lớp U/D, G/B với cạnh lớp giữa.
 * Dùng để xác định hướng cạnh theo quy ước thông dụng.
 */
function edgeReferenceNormal(pos: Vec3): Vec3 {
  return pos[1] !== 0 ? [0, pos[1], 0] : [0, 0, pos[2]];
}
const EDGE_GOOD_COLOR: readonly Color[] = EDGE_POSITIONS.map((pos) =>
  colorAt(SOLVED, pos, edgeReferenceNormal(pos)),
);

function permutationParity(perm: readonly number[]): number {
  const seen = new Array<boolean>(perm.length).fill(false);
  let cycles = 0;
  for (let i = 0; i < perm.length; i++) {
    if (seen[i]) continue;
    cycles++;
    let j = i;
    while (!seen[j]) {
      seen[j] = true;
      j = perm[j];
    }
  }
  return (perm.length - cycles) % 2;
}

/**
 * Giải mã trạng thái thành biểu diễn cấp cubie và liệt kê mọi lỗi tìm được.
 * Không ném lỗi với trạng thái sai: luôn trả về kết quả có `valid` và danh sách lỗi.
 */
export function analyzeState(state: CubeState): ValidationResult {
  const errors: string[] = [];

  const counts = new Map<Color, number>();
  for (const c of state.stickers) counts.set(c, (counts.get(c) ?? 0) + 1);
  for (const [color, n] of counts) {
    if (n !== 9) errors.push(`Màu ${color} xuất hiện ${n} lần, phải đúng 9 lần`);
  }
  if (state.stickers.length !== 54) errors.push('Trạng thái phải có đúng 54 sticker');
  if (errors.length > 0) return { valid: false, errors };

  const cp: number[] = [];
  const co: number[] = [];
  const seenCorners = new Set<number>();
  CORNER_POSITIONS.forEach((pos, i) => {
    const normals = cornerNormals(pos);
    const colors = normals.map((n) => colorAt(state, pos, n));
    const h = CORNER_HOME.get(keyOf(colors));
    if (h === undefined) {
      errors.push(`Góc tại vị trí ${i + 1} có tổ hợp màu không tồn tại`);
      cp.push(-1);
      co.push(0);
      return;
    }
    if (seenCorners.has(h)) errors.push(`Góc ${h + 1} xuất hiện hai lần`);
    seenCorners.add(h);
    cp.push(h);

    const [cx, cy, cz] = colors;
    if (WHITE_OR_YELLOW.has(cy)) {
      co.push(0);
    } else {
      const sign = pos[0] * pos[1] * pos[2] > 0 ? 1 : 2;
      if (WHITE_OR_YELLOW.has(cx)) co.push(sign);
      else if (WHITE_OR_YELLOW.has(cz)) co.push(sign === 1 ? 2 : 1);
      else {
        errors.push(`Góc tại vị trí ${i + 1} không có màu trắng hoặc vàng`);
        co.push(0);
      }
    }
  });

  const ep: number[] = [];
  const eo: number[] = [];
  const seenEdges = new Set<number>();
  EDGE_POSITIONS.forEach((pos, i) => {
    const normals = edgeNormals(pos);
    const colors = normals.map((n) => colorAt(state, pos, n));
    const h = EDGE_HOME.get(keyOf(colors));
    if (h === undefined) {
      errors.push(`Cạnh tại vị trí ${i + 1} có tổ hợp màu không tồn tại`);
      ep.push(-1);
      eo.push(0);
      return;
    }
    if (seenEdges.has(h)) errors.push(`Cạnh ${h + 1} xuất hiện hai lần`);
    seenEdges.add(h);
    ep.push(h);

    const refColor = colorAt(state, pos, edgeReferenceNormal(pos));
    eo.push(refColor === EDGE_GOOD_COLOR[h] ? 0 : 1);
  });

  if (errors.length > 0) return { valid: false, errors };

  const cornerTwist = co.reduce((a, b) => a + b, 0);
  if (cornerTwist % 3 !== 0) errors.push('Tổng hướng các góc không chia hết cho 3 (một góc bị xoay sai)');

  const edgeFlip = eo.reduce((a, b) => a + b, 0);
  if (edgeFlip % 2 !== 0) errors.push('Số cạnh bị lật không chẵn (một cạnh bị lật sai)');

  if (permutationParity(cp) !== permutationParity(ep)) {
    errors.push('Tính chẵn lẻ của hoán vị góc và cạnh không khớp (có hai mảnh bị đổi chỗ sai)');
  }

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, errors, cubie: { cp, co, ep, eo } };
}

export function isValidCube(state: CubeState): boolean {
  return analyzeState(state).valid;
}
