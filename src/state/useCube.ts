import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { CubeViewer, WebGLUnavailableError, type RenderQuality } from '../three/CubeViewer';
import { canRedo, canUndo, createHistory, type CubeHistory } from '../cube/history';
import { applyMove, solvedState, type CubeState } from '../cube/state';
import { invertMove, type Move } from '../cube/moves';
import { reduceHistory, type HistoryAction } from './historyReducer';

/**
 * Bộ điều phối duy nhất cho khối Rubik trên giao diện.
 *
 * - Trạng thái logic (CubeHistory) chỉ thay đổi SAU KHI animation tương ứng kết thúc.
 * - Mọi thao tác (quay, undo, redo, scramble) đi qua một hàng đợi tuần tự, nên không chồng lấn.
 * - Reset tăng "thế hệ": kết quả của animation đang chạy bị bỏ, tránh ghi đè trạng thái mới.
 */

type Job =
  | { readonly kind: 'move'; readonly move: Move; readonly rebase: boolean }
  | { readonly kind: 'undo' }
  | { readonly kind: 'redo' };

export interface CubeController {
  readonly history: CubeHistory;
  readonly busy: boolean;
  readonly error: 'webgl' | 'contextLost' | null;
  readonly enqueueMoves: (moves: readonly Move[]) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly reset: () => void;
  readonly scramble: (moves: readonly Move[]) => void;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export interface CubeControllerOptions {
  readonly quality: RenderQuality;
  readonly quarterTurnMs: number;
  readonly reducedMotion: boolean;
  readonly onTurnCommitted?: (move: Move) => void;
}

export function useCubeController(
  containerRef: RefObject<HTMLDivElement>,
  options: CubeControllerOptions,
): CubeController {
  const [history, setHistory] = useState<CubeHistory>(() => createHistory());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<CubeController['error']>(null);

  const historyRef = useRef<CubeHistory>(history);
  const viewerRef = useRef<CubeViewer | null>(null);
  const queueRef = useRef<Job[]>([]);
  const runningRef = useRef(false);
  const generationRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const commitHistory = useCallback((next: CubeHistory) => {
    historyRef.current = next;
    setHistory(next);
  }, []);

  const pump = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    try {
      while (queueRef.current.length > 0) {
        const viewer = viewerRef.current;
        const job = queueRef.current.shift();
        if (!job) break;
        if (!viewer) continue;
        const gen = generationRef.current;
        const h = historyRef.current;

        let move: Move | null = null;
        let expected: CubeState | null = null;
        let action: HistoryAction | null = null;

        if (job.kind === 'move') {
          move = job.move;
          expected = applyMove(h.present, job.move);
          action = { type: 'commit', move: job.move, rebase: job.rebase };
        } else if (job.kind === 'undo') {
          if (canUndo(h)) {
            move = invertMove(h.moves[h.moves.length - 1]);
            expected = h.past[h.past.length - 1];
            action = { type: 'undo' };
          }
        } else if (canRedo(h)) {
          move = h.future[0].move;
          expected = h.future[0].state;
          action = { type: 'redo' };
        }

        if (!move || !expected || !action) continue;

        try {
          await viewer.animateMove(move);
        } catch {
          // Viewer bị hủy giữa chừng: dừng toàn bộ hàng đợi.
          queueRef.current = [];
          break;
        }
        if (gen !== generationRef.current) continue;

        viewer.syncFromState(expected);
        commitHistory(reduceHistory(historyRef.current, action));
        if (action.type === 'commit') optionsRef.current.onTurnCommitted?.(action.move);
      }
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  }, [commitHistory]);

  // Khởi tạo và hủy viewer; tạo lại khi chất lượng đồ họa thay đổi.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let viewer: CubeViewer;
    try {
      viewer = new CubeViewer(container, {
        quality: options.quality,
        quarterTurnMs: options.reducedMotion ? 0 : options.quarterTurnMs,
      });
    } catch (err) {
      if (!(err instanceof WebGLUnavailableError)) throw err;
      setError('webgl');
      return;
    }
    viewer.setOnContextLost(() => setError('contextLost'));
    viewer.syncFromState(historyRef.current.present);
    viewerRef.current = viewer;
    setError(null);
    return () => {
      generationRef.current += 1;
      queueRef.current = [];
      viewer.dispose();
      if (viewerRef.current === viewer) viewerRef.current = null;
    };
    // Chỉ tạo lại viewer khi chất lượng đổi; tốc độ được cập nhật riêng bên dưới.
  }, [options.quality]);

  useEffect(() => {
    viewerRef.current?.setQuarterTurnMs(options.reducedMotion ? 0 : options.quarterTurnMs);
  }, [options.quarterTurnMs, options.reducedMotion]);

  const enqueueMoves = useCallback(
    (moves: readonly Move[]) => {
      for (const move of moves) queueRef.current.push({ kind: 'move', move, rebase: false });
      void pump();
    },
    [pump],
  );

  const undo = useCallback(() => {
    queueRef.current.push({ kind: 'undo' });
    void pump();
  }, [pump]);

  const redo = useCallback(() => {
    queueRef.current.push({ kind: 'redo' });
    void pump();
  }, [pump]);

  const reset = useCallback(() => {
    generationRef.current += 1;
    queueRef.current = [];
    viewerRef.current?.cancelAnimation();
    const fresh = createHistory(solvedState());
    viewerRef.current?.syncFromState(fresh.present);
    commitHistory(fresh);
  }, [commitHistory]);

  const scramble = useCallback(
    (moves: readonly Move[]) => {
      reset();
      moves.forEach((move, i) => {
        queueRef.current.push({ kind: 'move', move, rebase: i === moves.length - 1 });
      });
      void pump();
    },
    [pump, reset],
  );

  return {
    history,
    busy,
    error,
    enqueueMoves,
    undo,
    redo,
    reset,
    scramble,
    canUndo: canUndo(history),
    canRedo: canRedo(history),
  };
}
