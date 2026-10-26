import { describe, it } from 'node:test';
import { mustParse } from '../helpers';
import assert from 'node:assert/strict';
import { ALL_MOVE_FACES, invertMove, type Move } from '../../src/cube/moves';
import { applyMove, applyMoves, isSolved, sameState, solvedState, type CubeState } from '../../src/cube/state';
import { analyzeState, isValidCube } from '../../src/cube/validate';
import { createScramble, stateFromScramble } from '../../src/cube/scramble';
import { parseAlgorithm, invertAlgorithm, simplifyAlgorithm, formatAlgorithm } from '../../src/cube/notation';
import { STICKERS, stickerIndex, type Color } from '../../src/cube/geometry';

const m = (face: Move['face'], amount: Move['amount'] = 1): Move => ({ face, amount });

function run(text: string, from: CubeState = solvedState()): CubeState {
  const parsed = parseAlgorithm(text);
  assert.equal(parsed.ok, true, `parse failed for: ${text}`);
  if (!parsed.ok) throw new Error('unreachable');
  return applyMoves(from, parsed.moves);
}

describe('hình học và trạng thái đã giải', () => {
  it('có đúng 54 sticker và trạng thái đã giải hợp lệ', () => {
    assert.equal(STICKERS.length, 54);
    assert.equal(isSolved(solvedState()), true);
    assert.equal(isValidCube(solvedState()), true);
  });

  it('mỗi mặt có đúng 9 sticker cùng màu tâm khi đã giải', () => {
    const counts = new Map<Color, number>();
    for (const c of solvedState().stickers) counts.set(c, (counts.get(c) ?? 0) + 1);
    for (const n of counts.values()) assert.equal(n, 9);
    assert.equal(counts.size, 6);
  });
});

describe('phép quay cơ bản', () => {
  it('R R\' trả về trạng thái ban đầu', () => {
    assert.ok(sameState(run("R R'"), solvedState()));
  });

  it('R2 R2 trả về trạng thái ban đầu', () => {
    assert.ok(sameState(run('R2 R2'), solvedState()));
  });

  it('mọi mặt quay 4 lần đều trở về trạng thái ban đầu', () => {
    for (const face of ALL_MOVE_FACES) {
      let s = solvedState();
      for (let i = 0; i < 4; i++) s = applyMove(s, m(face, 1));
      assert.ok(sameState(s, solvedState()), `face ${face}^4 failed`);
    }
  });

  it('mọi ký hiệu nhân với nghịch đảo của nó đều về trạng thái ban đầu', () => {
    const scrambled = stateFromScramble(createScramble(12345, 30));
    for (const face of ALL_MOVE_FACES) {
      for (const amount of [1, 2, 3] as const) {
        const move = m(face, amount);
        const back = applyMove(applyMove(scrambled, move), invertMove(move));
        assert.ok(sameState(back, scrambled), `inverse failed for ${face}${amount}`);
      }
    }
  });

  it('công thức Sexy (R U R\' U\') có cấp 6', () => {
    let s = solvedState();
    for (let i = 0; i < 6; i++) s = run("R U R' U'", s);
    assert.ok(sameState(s, solvedState()));
  });

  it('công thức Sexy lặp 3 lần không về trạng thái ban đầu (bằng cấp 6 nhưng không phải 3)', () => {
    let s = solvedState();
    for (let i = 0; i < 3; i++) s = run("R U R' U'", s);
    assert.equal(isSolved(s), false);
  });
});

describe('ký hiệu lát cắt và quay toàn khối', () => {
  const equivalences: ReadonlyArray<readonly [string, string, string]> = [
    ['x', "R M' L'", 'x = R M\' L\''],
    ['y', "U E' D'", 'y = U E\' D\''],
    ['z', "F S B'", 'z = F S B\''],
    ['u', "U E'", 'u = U E\''],
    ['d', 'D E', 'd = D E'],
    ['r', "R M'", 'r = R M\''],
    ['l', 'L M', 'l = L M'],
    ['f', 'F S', 'f = F S'],
    ['b', "B S'", 'b = B S\''],
  ];
  for (const [name, expansion, label] of equivalences) {
    it(`${label}`, () => {
      const scrambled = stateFromScramble(createScramble(777, 25));
      const direct = run(name, scrambled);
      const expanded = run(expansion, scrambled);
      assert.ok(sameState(direct, expanded), `${name} != ${expansion}`);
    });
  }
});

describe('kiểm tra tính hợp lệ của trạng thái', () => {
  for (let seed = 1; seed <= 25; seed++) {
    it(`xáo trộn ngẫu nhiên #${seed} luôn hợp lệ`, () => {
      const s = stateFromScramble(createScramble(seed, 40));
      const result = analyzeState(s);
      assert.equal(result.valid, true, result.errors.join('; '));
    });
  }

  it('lật một cạnh (đổi hai sticker của cạnh UR) bị phát hiện', () => {
    const s = solvedState();
    const a = stickerIndex([1, 1, 0], [0, 1, 0]);
    const b = stickerIndex([1, 1, 0], [1, 0, 0]);
    const stickers = s.stickers.slice();
    [stickers[a], stickers[b]] = [stickers[b], stickers[a]];
    assert.equal(isValidCube({ stickers }), false);
  });

  it('hoán đổi hai cạnh (chỉ đổi màu) bị phát hiện do tính chẵn lẻ', () => {
    const s = solvedState();
    const ur = [stickerIndex([1, 1, 0], [0, 1, 0]), stickerIndex([1, 1, 0], [1, 0, 0])];
    const uf = [stickerIndex([0, 1, 1], [0, 1, 0]), stickerIndex([0, 1, 1], [0, 0, 1])];
    const stickers = s.stickers.slice();
    for (let i = 0; i < 2; i++) [stickers[ur[i]], stickers[uf[i]]] = [stickers[uf[i]], stickers[ur[i]]];
    assert.equal(isValidCube({ stickers }), false);
  });

  it('một sticker bị đổi màu làm sai số lượng màu', () => {
    const s = solvedState();
    const stickers = s.stickers.slice();
    stickers[0] = 'Y';
    const result = analyzeState({ stickers });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((e) => e.includes('phải đúng 9 lần')));
  });
});

describe('ký hiệu và công thức', () => {
  it('phân tích công thức hợp lệ', () => {
    const r = parseAlgorithm("R U R' U' R2 x M E' S2 r u");
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.moves.length, 11);
  });

  it('báo lỗi ký hiệu không hợp lệ kèm vị trí', () => {
    const r = parseAlgorithm("R U Q' F");
    assert.equal(r.ok, false);
    if (!r.ok) {
      assert.equal(r.error.token, "Q'");
      assert.equal(r.error.index, 4);
    }
  });

  it('chấp nhận dấu nháy Unicode và R2\'', () => {
    const r = parseAlgorithm('R’ U2\' F');
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.moves[0].amount, 3);
      assert.equal(r.moves[1].amount, 2);
    }
  });

  it('đảo công thức cho kết quả đúng', () => {
    const alg = parseAlgorithm("R U2 F' D");
    assert.equal(alg.ok, true);
    if (!alg.ok) return;
    const inv = invertAlgorithm(alg.moves);
    const scrambled = stateFromScramble(createScramble(99, 15));
    const back = applyMoves(applyMoves(scrambled, alg.moves), inv);
    assert.ok(sameState(back, scrambled));
  });

  it('rút gọn ký hiệu cùng mặt liền kề', () => {
    assert.equal(formatAlgorithm(simplifyAlgorithm(mustParse('R R'))), 'R2');
    assert.equal(formatAlgorithm(simplifyAlgorithm(mustParse("R R'"))), '');
    assert.equal(formatAlgorithm(simplifyAlgorithm(mustParse("R U U' R"))), 'R2');
  });

  it('rút gọn không làm đổi trạng thái', () => {
    const raw = mustParse("R R U U' F F F B B2 R'");
    const simplified = simplifyAlgorithm(raw);
    const scrambled = stateFromScramble(createScramble(4242, 20));
    assert.ok(sameState(applyMoves(scrambled, raw), applyMoves(scrambled, simplified)));
  });
});

describe('xáo trộn', () => {
  it('cùng seed luôn tạo cùng chuỗi', () => {
    assert.equal(createScramble(31337).text, createScramble(31337).text);
  });

  it('không có hai ký hiệu cùng mặt liền kề', () => {
    const s = createScramble(2024, 60);
    for (let i = 1; i < s.moves.length; i++) {
      assert.notEqual(s.moves[i].face, s.moves[i - 1].face);
    }
  });

  it('giải ngược scramble trả về khối đã giải', () => {
    const s = createScramble(55, 25);
    const scrambled = stateFromScramble(s);
    const solved = applyMoves(scrambled, invertAlgorithm(s.moves));
    assert.ok(sameState(solved, solvedState()));
  });
});
