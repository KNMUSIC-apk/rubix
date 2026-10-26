import { describe, it } from 'node:test';
import { mustParse } from '../helpers';
import assert from 'node:assert/strict';
import { createHistory, pushMove, undo, redo, canUndo, canRedo } from '../../src/cube/history';
import { isSolved, solvedState, sameState } from '../../src/cube/state';
import { createScramble, stateFromScramble } from '../../src/cube/scramble';
import { applyMoves } from '../../src/cube/state';
import { PREDICATES, crossSolved, firstLayerSolved, yellowFaceSolved } from '../../src/lessons/predicates';
import { averageOf, createStopwatch, effectiveMs, formatMs, penaltyFromInspection, personalBest, type Solve } from '../../src/timer/stats';
import { createMemoryAdapter, createTypedStore } from '../../src/storage/store';
import { parseAlgorithm } from '../../src/cube/notation';

const solveOf = (rawMs: number, penalty: Solve['penalty'] = 'none', i = 0): Solve => ({
  id: `s${i}`,
  rawMs,
  penalty,
  scramble: '',
  savedAt: i,
});

describe('lịch sử Undo/Redo', () => {
  it('undo rồi redo trả về đúng trạng thái và nhật ký', () => {
    const r = parseAlgorithm("R U F'");
    assert.equal(r.ok, true);
    if (!r.ok) return;
    let h = createHistory();
    for (const m of r.moves) h = pushMove(h, m);
    const afterAll = h.present;
    h = undo(h);
    h = undo(h);
    h = undo(h);
    assert.ok(isSolved(h.present));
    assert.equal(canUndo(h), false);
    assert.equal(canRedo(h), true);
    for (let i = 0; i < 3; i++) h = redo(h);
    assert.ok(sameState(h.present, afterAll));
    assert.equal(h.moves.length, 3);
    assert.equal(h.turnCount, 3);
  });

  it('thao tác mới sau Undo xóa vùng Redo', () => {
    let h = createHistory();
    const moves = mustParse('R U');
    h = pushMove(h, moves[0]);
    h = pushMove(h, moves[1]);
    h = undo(h);
    h = pushMove(h, moves[0]);
    assert.equal(canRedo(h), false);
  });
});

describe('đồng hồ và thống kê', () => {
  it('đồng hồ không trả về thời gian âm khi đồng hồ lùi', () => {
    let t = 1000;
    const sw = createStopwatch(() => t);
    sw.start();
    t = 900;
    assert.equal(sw.elapsed(), 0);
    assert.equal(sw.stop(), 0);
  });

  it('start hai lần không tạo phiên chồng chéo', () => {
    let t = 0;
    const sw = createStopwatch(() => t);
    sw.start();
    t = 500;
    sw.start();
    t = 800;
    assert.equal(sw.stop(), 800);
  });

  it('định dạng thời gian kiểu WCA', () => {
    assert.equal(formatMs(12340), '12.34');
    assert.equal(formatMs(62500), '1:02.50');
    assert.equal(formatMs(null), 'DNF');
  });

  it('inspection: đến 15 giây không phạt, 15–17 giây +2, trên 17 giây DNF', () => {
    assert.equal(penaltyFromInspection(15000), 'none');
    assert.equal(penaltyFromInspection(15001), 'plus2');
    assert.equal(penaltyFromInspection(17000), 'plus2');
    assert.equal(penaltyFromInspection(17001), 'dnf');
  });

  it('Ao5 bỏ tốt nhất và tệ nhất', () => {
    const solves = [solveOf(10000, 'none', 1), solveOf(20000, 'none', 2), solveOf(30000, 'none', 3), solveOf(40000, 'none', 4), solveOf(50000, 'none', 5)];
    assert.equal(averageOf(solves, 5), 30000);
  });

  it('Ao5 có một DNF bị loại vì là lượt tệ nhất, nhưng hai DNF thì kết quả là DNF', () => {
    const one = [solveOf(10000, 'none', 1), solveOf(20000, 'none', 2), solveOf(30000, 'none', 3), solveOf(40000, 'none', 4), solveOf(50000, 'dnf', 5)];
    assert.equal(averageOf(one, 5), 30000);
    const two = [solveOf(10000, 'none', 1), solveOf(20000, 'dnf', 2), solveOf(30000, 'none', 3), solveOf(40000, 'dnf', 4), solveOf(50000, 'none', 5)];
    assert.equal(averageOf(two, 5), null);
  });

  it('+2 được cộng vào thời gian hiệu lực', () => {
    assert.equal(effectiveMs(solveOf(10000, 'plus2')), 12000);
  });

  it('PB bỏ qua DNF và chưa đủ lượt thì Ao5 là undefined', () => {
    const solves = [solveOf(9000, 'dnf', 1), solveOf(12000, 'none', 2)];
    assert.equal(personalBest(solves), 12000);
    assert.equal(averageOf(solves, 5), undefined);
  });
});

describe('lưu trữ cục bộ', () => {
  const validate = (d: unknown): d is { n: number } => typeof d === 'object' && d !== null && typeof (d as { n?: unknown }).n === 'number';

  it('lưu và đọc lại đúng dữ liệu', () => {
    const adapter = createMemoryAdapter();
    const store = createTypedStore({ adapter, key: 'k', version: 1, fallback: { n: 0 }, validate });
    assert.equal(store.save({ n: 7 }).ok, true);
    const r = store.load();
    assert.equal(r.status, 'ok');
    assert.equal(r.value.n, 7);
  });

  it('dữ liệu JSON hỏng trả về mặc định và trạng thái corrupt', () => {
    const adapter = createMemoryAdapter();
    adapter.setItem('k', '{not json');
    const store = createTypedStore({ adapter, key: 'k', version: 1, fallback: { n: 0 }, validate });
    const r = store.load();
    assert.equal(r.status, 'corrupt');
    assert.equal(r.value.n, 0);
  });

  it('sai phiên bản hoặc sai cấu trúc bị coi là corrupt', () => {
    const adapter = createMemoryAdapter();
    adapter.setItem('k', JSON.stringify({ v: 2, data: { n: 3 } }));
    const store = createTypedStore({ adapter, key: 'k', version: 1, fallback: { n: 0 }, validate });
    assert.equal(store.load().status, 'corrupt');
    adapter.setItem('k', JSON.stringify({ v: 1, data: { n: 'x' } }));
    assert.equal(store.load().status, 'corrupt');
  });

  it('localStorage ném lỗi không làm sập ứng dụng', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        const e = new Error('quota');
        e.name = 'QuotaExceededError';
        throw e;
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    const store = createTypedStore({ adapter: broken, key: 'k', version: 1, fallback: { n: 0 }, validate });
    assert.equal(store.load().status, 'corrupt');
    const saved = store.save({ n: 1 });
    assert.equal(saved.ok, false);
    store.clear();
  });
});

describe('điều kiện bài học', () => {
  it('khối đã giải thỏa mãn mọi điều kiện', () => {
    const s = solvedState();
    for (const [, fn] of Object.entries(PREDICATES)) assert.equal(fn(s), true);
  });

  it('một lượt R làm hỏng dấu cộng trắng', () => {
    const s = applyMoves(solvedState(), mustParse('R'));
    assert.equal(crossSolved(s), false);
    assert.equal(firstLayerSolved(s), false);
  });

  it('chỉ quay mặt D không làm hỏng dấu cộng trắng nhưng làm hỏng mặt vàng', () => {
    const s = applyMoves(solvedState(), mustParse("D"));
    assert.equal(crossSolved(s), true);
    assert.equal(yellowFaceSolved(s), true);
  });

  it('xáo trộn ngẫu nhiên hầu như không bao giờ thỏa mãn điều kiện giải xong', () => {
    const s = stateFromScramble(createScramble(8, 25));
    assert.equal(PREDICATES.solved(s), false);
  });
});
