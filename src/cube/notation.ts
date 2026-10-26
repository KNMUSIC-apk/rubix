import { ALL_MOVE_FACES, invertMove, moveToString, type Move, type MoveAmount, type MoveFace } from './moves';

export interface ParseError {
  readonly token: string;
  readonly index: number;
  readonly message: string;
}

export type ParseResult =
  | { readonly ok: true; readonly moves: readonly Move[] }
  | { readonly ok: false; readonly error: ParseError };

const FACE_SET: ReadonlySet<string> = new Set(ALL_MOVE_FACES);

/**
 * Phân tích một token như R, R', R2, R2', R'2 ... Các dấu nháy có thể là ' hoặc ’.
 * Trả về null nếu token không hợp lệ.
 */
export function parseToken(token: string): Move | null {
  const normalized = token.replace(/’|`/g, "'");
  const face = normalized.charAt(0);
  if (!FACE_SET.has(face)) return null;
  const suffix = normalized.slice(1);
  let amount: MoveAmount;
  switch (suffix) {
    case '':
      amount = 1;
      break;
    case "'":
      amount = 3;
      break;
    case '2':
    case "2'":
    case "'2":
      amount = 2;
      break;
    default:
      return null;
  }
  return { face: face as MoveFace, amount };
}

/**
 * Phân tích chuỗi công thức. Các token phân tách bởi khoảng trắng.
 * Chấp nhận dấu ngoặc đơn bao quanh token như (R U R' U'), nhưng không hỗ trợ nhóm phức tạp.
 */
export function parseAlgorithm(text: string): ParseResult {
  const moves: Move[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[0];
    const token = raw.replace(/^\(+|\)+$/g, '');
    if (token === '') continue;
    const move = parseToken(token);
    if (!move) {
      return {
        ok: false,
        error: {
          token: raw,
          index: match.index,
          message: `Ký hiệu không hợp lệ: "${raw}"`,
        },
      };
    }
    moves.push(move);
  }
  return { ok: true, moves };
}

export function formatAlgorithm(moves: readonly Move[]): string {
  return moves.map(moveToString).join(' ');
}

/** Đảo ngược công thức: đảo thứ tự và đảo từng phép quay. */
export function invertAlgorithm(moves: readonly Move[]): Move[] {
  return moves.slice().reverse().map(invertMove);
}

/**
 * Rút gọn các ký hiệu liền kề cùng mặt (ví dụ R R → R2, R R' → bỏ, R R R R → bỏ).
 * Các phép quay cùng lớp giao hoán với nhau nên việc gộp là tương đương về mặt trạng thái.
 * Không gộp qua các ký hiệu khác mặt để tránh sai do không giao hoán.
 */
export function simplifyAlgorithm(moves: readonly Move[]): Move[] {
  const out: Move[] = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last.face === m.face) {
      const sum = (last.amount + m.amount) % 4;
      out.pop();
      if (sum !== 0) out.push({ face: m.face, amount: sum as MoveAmount });
    } else {
      out.push(m);
    }
  }
  return out;
}
