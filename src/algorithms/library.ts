import { parseAlgorithm, invertAlgorithm, formatAlgorithm } from '../cube/notation';
import { applyMoves, isSolved, solvedState, sameState, type CubeState } from '../cube/state';
import type { Move } from '../cube/moves';

export type Category = 'basic' | 'f2l' | 'oll' | 'pll' | 'beginner';
export type Level = 'beginner' | 'intermediate' | 'advanced';

export interface Formula {
  readonly id: string;
  readonly category: Category;
  readonly level: Level;
  readonly nameVi: string;
  readonly nameEn: string;
  /** Công thức dạng văn bản (đã được parser kiểm tra trong bộ test). */
  readonly notation: string;
  /** Mô tả ngắn: trường hợp dùng và điều kiện áp dụng. */
  readonly noteVi: string;
  /** Mặt cần hướng về người chơi khi thực hiện (nếu có). */
  readonly holdFacing?: string;
}

/**
 * Thư viện công thức ban đầu. Chỉ đưa vào những công thức đã được kiểm chứng
 * bằng phép biến đổi trạng thái trong bộ test (xem tests/algorithms). Mọi công thức khác
 * cần được bổ sung cùng với kiểm thử tương ứng trước khi xuất hiện trong thư viện.
 */
export const FORMULAS: readonly Formula[] = [
  {
    id: 'sexy',
    category: 'basic',
    level: 'beginner',
    nameVi: 'Sexy move',
    nameEn: 'Sexy move',
    notation: "R U R' U'",
    noteVi: 'Ghép các phép quay cơ bản; thường dùng làm bài tập nhận diện chiều quay.',
  },
  {
    id: 'sledgehammer',
    category: 'basic',
    level: 'beginner',
    nameVi: 'Sledgehammer',
    nameEn: 'Sledgehammer',
    notation: "R' F R F'",
    noteVi: 'Giao hoán tử cơ bản, có cùng cấp 6 với Sexy move.',
  },
  {
    id: 'sune',
    category: 'oll',
    level: 'beginner',
    nameVi: 'Sune (OLL)',
    nameEn: 'Sune (OLL)',
    notation: 'R U R\' U R U2 R\'',
    noteVi: 'Dùng khi mặt vàng có dạng "hình chữ L" trái, cần định hướng góc vàng.',
    holdFacing: 'Mặt vàng hướng lên trên',
  },
  {
    id: 'antisune',
    category: 'oll',
    level: 'beginner',
    nameVi: 'Anti-Sune (OLL)',
    nameEn: 'Anti-Sune (OLL)',
    notation: "R U2 R' U' R U' R'",
    noteVi: 'Nghịch đảo của Sune, dùng cho trường hợp đối xứng với Sune.',
    holdFacing: 'Mặt vàng hướng lên trên',
  },
  {
    id: 't-perm',
    category: 'pll',
    level: 'beginner',
    nameVi: 'T-perm (PLL)',
    nameEn: 'T-perm (PLL)',
    notation: "R U R' U' R' F R2 U' R' U' R U R' F'",
    noteVi: 'Hoán đổi hai góc và hai cạnh ở lớp trên; chỉ dùng khi mặt trên đã đúng màu.',
    holdFacing: 'Mặt trắng hướng lên trên',
  },
];

export function findFormula(id: string): Formula | undefined {
  return FORMULAS.find((f) => f.id === id);
}

export function parseFormula(f: Formula): Move[] {
  const parsed = parseAlgorithm(f.notation);
  if (!parsed.ok) throw new Error(`Formula ${f.id} is invalid: ${parsed.error.message}`);
  return parsed.moves.slice();
}

/** Số lần lặp nhỏ nhất để một công thức trở về trạng thái ban đầu (tối đa `limit`). */
export function orderOnSolved(moves: readonly Move[], limit = 100): number | null {
  let s: CubeState = solvedState();
  for (let k = 1; k <= limit; k++) {
    s = applyMoves(s, moves);
    if (sameState(s, solvedState())) return k;
  }
  return null;
}

/** Công thức đảo, dùng để hiển thị ở chế độ ngược. */
export function reverseFormula(f: Formula): string {
  return formatAlgorithm(invertAlgorithm(parseFormula(f)));
}

export { isSolved };
