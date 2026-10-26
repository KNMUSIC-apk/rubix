import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PREDICATES, whiteCrossSolved, firstLayerSolved, yellowFaceSolved } from '../../src/lessons/predicates';
import { applyMoves, solvedState } from '../../src/cube/state';
import { createScramble, stateFromScramble } from '../../src/cube/scramble';
import { mustParse } from '../helpers';

describe('điều kiện bài học (mặt trắng ở dưới)', () => {
  it('khối đã giải thỏa mãn mọi điều kiện', () => {
    for (const fn of Object.values(PREDICATES)) assert.equal(fn(solvedState()), true);
  });

  it('quay mặt U không làm hỏng dấu cộng trắng và lớp đầu', () => {
    const s = applyMoves(solvedState(), mustParse('U'));
    assert.equal(whiteCrossSolved(s), true);
    assert.equal(firstLayerSolved(s), true);
    assert.equal(yellowFaceSolved(s), true);
  });

  it('một lượt R làm hỏng dấu cộng trắng', () => {
    const s = applyMoves(solvedState(), mustParse('R'));
    assert.equal(whiteCrossSolved(s), false);
  });

  it('xáo trộn ngẫu nhiên không thỏa mãn điều kiện giải xong', () => {
    assert.equal(PREDICATES.solved(stateFromScramble(createScramble(8, 25))), false);
  });
});
