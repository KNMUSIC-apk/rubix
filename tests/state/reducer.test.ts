import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { reduceHistory } from '../../src/state/historyReducer';
import { createHistory } from '../../src/cube/history';
import { applyMoves, isSolved, sameState, solvedState } from '../../src/cube/state';
import { createScramble, stateFromScramble } from '../../src/cube/scramble';
import { mustParse } from '../helpers';

describe('bộ giảm trạng thái lịch sử', () => {
  it('commit đẩy nước đi vào lịch sử và tăng số lượt', () => {
    const [move] = mustParse('R');
    const h = reduceHistory(createHistory(), { type: 'commit', move, rebase: false });
    assert.equal(h.turnCount, 1);
    assert.equal(h.moves.length, 1);
    assert.equal(isSolved(h.present), false);
  });

  it('undo và redo đi đúng qua lại trạng thái', () => {
    const [move] = mustParse("F'");
    let h = reduceHistory(createHistory(), { type: 'commit', move, rebase: false });
    const after = h.present;
    h = reduceHistory(h, { type: 'undo' });
    assert.ok(isSolved(h.present));
    h = reduceHistory(h, { type: 'redo' });
    assert.ok(sameState(h.present, after));
  });

  it('scramble (rebase) đặt điểm gốc mới nên Undo không quay về khối đã giải', () => {
    const s = createScramble(2026, 12);
    let h = createHistory();
    s.moves.forEach((move, i) => {
      h = reduceHistory(h, { type: 'commit', move, rebase: i === s.moves.length - 1 });
    });
    assert.ok(sameState(h.present, stateFromScramble(s)));
    assert.equal(h.past.length, 0);
    assert.equal(h.moves.length, 0);
    assert.equal(h.turnCount, 0);
  });

  it('chuỗi commit rồi undo toàn bộ trả về khối đã giải', () => {
    const moves = mustParse("R U R' U' F2 D L");
    let h = createHistory(solvedState());
    for (const move of moves) h = reduceHistory(h, { type: 'commit', move, rebase: false });
    for (let i = 0; i < moves.length; i++) h = reduceHistory(h, { type: 'undo' });
    assert.ok(isSolved(h.present));
    assert.ok(sameState(h.present, applyMoves(solvedState(), [])));
  });
});
