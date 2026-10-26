import { parseAlgorithm } from '../src/cube/notation';
import type { Move } from '../src/cube/moves';

/** Phân tích công thức cho test; ném lỗi nếu công thức không hợp lệ. */
export function mustParse(text: string): Move[] {
  const r = parseAlgorithm(text);
  if (!r.ok) throw new Error(`Invalid test algorithm "${text}": ${r.error.message}`);
  return r.moves.slice();
}
