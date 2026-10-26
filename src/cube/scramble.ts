import { formatAlgorithm } from './notation';
import { applyMoves, solvedState, type CubeState } from './state';
import type { Move, MoveAmount, MoveFace } from './moves';

/** Bộ sinh số giả ngẫu nhiên có hạt giống (mulberry32), để scramble có thể tái tạo. */
export function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SCRAMBLE_FACES: readonly MoveFace[] = ['U', 'D', 'L', 'R', 'F', 'B'];

/** Mỗi mặt hoặc trục đối diện: dùng để tránh các chuỗi thừa như R L R. */
const AXIS_OF: Readonly<Record<MoveFace, string>> = {
  U: 'y', D: 'y', L: 'x', R: 'x', F: 'z', B: 'z',
  u: 'y', d: 'y', l: 'x', r: 'x', f: 'z', b: 'z',
  M: 'x', E: 'y', S: 'z', x: 'x', y: 'y', z: 'z',
};

export interface Scramble {
  readonly moves: readonly Move[];
  readonly text: string;
  readonly seed: number;
  readonly length: number;
}

/**
 * Tạo chuỗi xáo trộn hợp lệ theo chuẩn WCA: chỉ dùng U D L R F B, không quay cùng mặt liên tiếp,
 * không quay ba lớp cùng trục liên tiếp. Vì các chuyển động đều là phép biến đổi của khối đã giải,
 * trạng thái thu được luôn giải được.
 */
export function createScramble(seed: number, length = 20): Scramble {
  const rand = createSeededRandom(seed);
  const moves: Move[] = [];
  while (moves.length < length) {
    const face = SCRAMBLE_FACES[Math.floor(rand() * SCRAMBLE_FACES.length)];
    const last = moves[moves.length - 1];
    const prev = moves[moves.length - 2];
    if (last && last.face === face) continue;
    if (last && prev && AXIS_OF[last.face] === AXIS_OF[face] && AXIS_OF[prev.face] === AXIS_OF[face] && last.face !== prev.face) {
      continue;
    }
    const amount = (1 + Math.floor(rand() * 3)) as MoveAmount;
    moves.push({ face, amount });
  }
  return { moves, text: formatAlgorithm(moves), seed, length };
}

/** Trạng thái sau khi áp dụng scramble lên khối đã giải. */
export function stateFromScramble(scramble: Scramble): CubeState {
  return applyMoves(solvedState(), scramble.moves);
}

/** Tạo seed ngẫu nhiên an toàn cho mỗi lượt chơi. */
export function randomSeed(): number {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
