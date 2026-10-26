/**
 * Đồng hồ và thống kê thi đấu. Logic thuần, không phụ thuộc DOM để dễ kiểm thử.
 */

export type Penalty = 'none' | 'plus2' | 'dnf';

export interface Solve {
  readonly id: string;
  /** Thời gian thô (ms) đo bằng đồng hồ đơn điệu, luôn không âm. */
  readonly rawMs: number;
  readonly penalty: Penalty;
  readonly scramble: string;
  /** Thời điểm lưu (epoch ms) để hiển thị và biểu đồ theo ngày. */
  readonly savedAt: number;
}

export const INSPECTION_LIMIT_MS = 15_000;
export const INSPECTION_GRACE_MS = 17_000;

/** Thời gian hiệu lực của một lượt sau khi tính phạt. null nghĩa là DNF. */
export function effectiveMs(solve: Pick<Solve, 'rawMs' | 'penalty'>): number | null {
  if (solve.penalty === 'dnf') return null;
  if (solve.penalty === 'plus2') return solve.rawMs + 2000;
  return solve.rawMs;
}

/**
 * Quy tắc inspection: quá 15 giây cộng 2 giây, quá 17 giây là DNF.
 * Chỉ áp dụng khi người dùng bật chế độ inspection.
 */
export function penaltyFromInspection(inspectionMs: number): Penalty {
  if (inspectionMs > INSPECTION_GRACE_MS) return 'dnf';
  if (inspectionMs > INSPECTION_LIMIT_MS) return 'plus2';
  return 'none';
}

/** Đồng hồ đơn điệu: không bị ảnh hưởng bởi đồng hồ hệ thống hay tab nền. */
export interface Stopwatch {
  start(): void;
  /** Dừng và trả về thời gian đã trôi (ms), không bao giờ âm. */
  stop(): number;
  isRunning(): boolean;
  elapsed(): number;
}

export function createStopwatch(now: () => number = () => performance.now()): Stopwatch {
  let startedAt: number | null = null;
  let frozen = 0;
  const elapsedNow = (): number => {
    if (startedAt === null) return frozen;
    return Math.max(0, now() - startedAt);
  };
  return {
    start() {
      if (startedAt !== null) return;
      startedAt = now();
    },
    stop() {
      if (startedAt !== null) {
        frozen = Math.max(0, now() - startedAt);
        startedAt = null;
      }
      return frozen;
    },
    isRunning() {
      return startedAt !== null;
    },
    elapsed() {
      return elapsedNow();
    },
  };
}

/** Định dạng thời gian kiểu WCA: 12.34, 1:02.50, DNF. */
export function formatMs(ms: number | null): string {
  if (ms === null) return 'DNF';
  const totalCs = Math.floor(ms / 10);
  const cs = totalCs % 100;
  const totalSec = Math.floor(totalCs / 100);
  const sec = totalSec % 60;
  const min = Math.floor(totalSec / 60);
  const csStr = String(cs).padStart(2, '0');
  if (min > 0) return `${min}:${String(sec).padStart(2, '0')}.${csStr}`;
  return `${sec}.${csStr}`;
}

/**
 * Trung bình trong N lượt gần nhất (Ao5, Ao12...). Theo WCA: bỏ lượt tốt nhất và tệ nhất,
 * tính trung bình các lượt còn lại. Nếu DNF nằm trong các lượt được giữ lại thì kết quả là DNF.
 * Trả về `undefined` khi chưa đủ số lượt.
 */
export function averageOf(solves: readonly Solve[], n: number): number | null | undefined {
  if (solves.length < n) return undefined;
  const window = solves.slice(-n).map((s) => effectiveMs(s) ?? Number.POSITIVE_INFINITY);
  const sorted = window.slice().sort((a, b) => a - b);
  const trimmed = sorted.slice(1, n - 1);
  if (trimmed.some((t) => !Number.isFinite(t))) return null;
  return trimmed.reduce((a, b) => a + b, 0) / trimmed.length;
}

/** Thời gian tốt nhất (PB) trong danh sách, bỏ qua DNF. */
export function personalBest(solves: readonly Solve[]): number | undefined {
  let best: number | undefined;
  for (const s of solves) {
    const t = effectiveMs(s);
    if (t === null) continue;
    if (best === undefined || t < best) best = t;
  }
  return best;
}

/** Trung bình toàn bộ các lượt hợp lệ (không tính DNF). */
export function meanOfValid(solves: readonly Solve[]): number | undefined {
  const valid = solves.map(effectiveMs).filter((t): t is number => t !== null);
  if (valid.length === 0) return undefined;
  return valid.reduce((a, b) => a + b, 0) / valid.length;
}
