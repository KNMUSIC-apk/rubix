import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FORMULAS, orderOnSolved, parseFormula, reverseFormula } from '../../src/algorithms/library';
import { applyMoves, sameState, solvedState } from '../../src/cube/state';
import { STICKERS } from '../../src/cube/geometry';
import { parseAlgorithm } from '../../src/cube/notation';

describe('thư viện công thức', () => {
  it('mọi công thức đều phân tích được', () => {
    for (const f of FORMULAS) {
      const r = parseAlgorithm(f.notation);
      assert.equal(r.ok, true, `formula ${f.id} failed to parse`);
    }
  });

  it('id không trùng nhau', () => {
    const ids = FORMULAS.map((f) => f.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('Sexy move có cấp 6 trên khối đã giải', () => {
    assert.equal(orderOnSolved(parseFormula(FORMULAS.find((f) => f.id === 'sexy')!)), 6);
  });

  it('Sledgehammer có cấp 6 trên khối đã giải', () => {
    assert.equal(orderOnSolved(parseFormula(FORMULAS.find((f) => f.id === 'sledgehammer')!)), 6);
  });

  it('Anti-Sune là nghịch đảo đúng của Sune', () => {
    const sune = FORMULAS.find((f) => f.id === 'sune')!;
    const anti = FORMULAS.find((f) => f.id === 'antisune')!;
    const scrambled = applyMoves(solvedState(), parseFormula(sune));
    const back = applyMoves(scrambled, parseFormula(anti));
    assert.ok(sameState(back, solvedState()));
  });

  it('reverseFormula trả về công thức nghịch đảo hợp lệ', () => {
    const sune = FORMULAS.find((f) => f.id === 'sune')!;
    const revParsed = parseAlgorithm(reverseFormula(sune));
    assert.equal(revParsed.ok, true);
    if (!revParsed.ok) return;
    const back = applyMoves(applyMoves(solvedState(), parseFormula(sune)), revParsed.moves);
    assert.ok(sameState(back, solvedState()));
  });

  it('T-perm là hoán vị lớp trên: giữ nguyên hai lớp dưới và có cấp 2', () => {
    const tp = FORMULAS.find((f) => f.id === 't-perm')!;
    const moves = parseFormula(tp);
    const after = applyMoves(solvedState(), moves);
    assert.equal(sameState(after, solvedState()), false, 'T-perm must change the cube');
    for (let i = 0; i < STICKERS.length; i++) {
      if (STICKERS[i].pos[1] !== 1) {
        assert.equal(after.stickers[i], solvedState().stickers[i], `lower layer sticker ${i} changed`);
      }
    }
    assert.equal(orderOnSolved(moves), 2);
  });
});
