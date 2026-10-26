import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { AlertTriangle, CheckCircle2, Redo2, RotateCcw, Shuffle, Undo2 } from 'lucide-react';
import { useCubeController } from '../state/useCube';
import { createScramble, randomSeed } from '../cube/scramble';
import { parseAlgorithm } from '../cube/notation';
import { analyzeState } from '../cube/validate';
import { isSolved } from '../cube/state';
import { playTurnClick } from '../audio/sound';
import type { Messages } from '../i18n/messages';
import type { Settings } from '../settings/settings';
import type { MoveAmount, MoveFace } from '../cube/moves';

interface Props {
  readonly t: Messages;
  readonly settings: Settings;
}

const FACES: readonly MoveFace[] = ['U', 'D', 'L', 'R', 'F', 'B'];
/** Thứ tự hàng: quay thuận, ngược, 180°. */
const AMOUNT_ROWS: readonly MoveAmount[] = [1, 3, 2];

function suffixOf(amount: MoveAmount): string {
  return amount === 1 ? '' : amount === 3 ? "'" : '2';
}

export function FreePlayPage({ t, settings }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrambleText, setScrambleText] = useState('');
  const [formula, setFormula] = useState('');
  const [formulaError, setFormulaError] = useState<string | null>(null);

  const cube = useCubeController(containerRef, {
    quality: settings.quality,
    quarterTurnMs: settings.quarterTurnMs,
    reducedMotion: settings.reducedMotion,
    onTurnCommitted: () => playTurnClick(settings.soundOn),
  });

  const { enqueueMoves, undo, redo } = cube;

  const present = cube.history.present;
  const solved = useMemo(() => isSolved(present), [present]);
  const valid = useMemo(() => analyzeState(present).valid, [present]);

  const turn = useCallback((face: MoveFace, amount: MoveAmount) => enqueueMoves([{ face, amount }]), [enqueueMoves]);

  const doScramble = useCallback(() => {
    const s = createScramble(randomSeed());
    setScrambleText(s.text);
    cube.scramble(s.moves);
  }, [cube]);

  const doReset = useCallback(() => {
    setScrambleText('');
    cube.reset();
  }, [cube]);

  // Phím tắt: U D L R F B (Shift = ngược chiều, Alt = 180°), Ctrl/Cmd+Z và Ctrl/Cmd+Y để Undo/Redo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      if (mod) {
        if (k === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        }
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const upper = e.key.toUpperCase();
      if (upper.length === 1 && FACES.includes(upper as MoveFace)) {
        e.preventDefault();
        const amount: MoveAmount = e.altKey ? 2 : e.shiftKey ? 3 : 1;
        enqueueMoves([{ face: upper as MoveFace, amount }]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enqueueMoves, undo, redo]);

  const onApplyFormula = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseAlgorithm(formula);
    if (!parsed.ok) {
      setFormulaError(`${t.freePlay.invalidNotation}: "${parsed.error.token}"`);
      return;
    }
    setFormulaError(null);
    enqueueMoves(parsed.moves);
  };

  return (
    <section aria-labelledby="freeplay-title">
      <header style={{ marginBottom: 16 }}>
        <h1 id="freeplay-title">{t.freePlay.title}</h1>
        <p className="muted">{t.freePlay.subtitle}</p>
      </header>

      {cube.error && (
        <div className="notice error" role="alert" style={{ marginBottom: 16 }}>
          {cube.error === 'webgl' ? t.errors.webgl : t.errors.contextLost}
        </div>
      )}

      <div className="free-play">
        <div className="card">
          <div className="stage">
            <div className="stage-inner" ref={containerRef} />
          </div>

          <p className="muted" style={{ marginTop: 10, fontSize: '0.9rem' }}>
            {t.freePlay.keyboardHint}
          </p>
          {cube.busy && (
            <p className="muted" role="status" aria-live="polite">
              {t.freePlay.busy}
            </p>
          )}

          <div className="move-grid" role="group" aria-label={t.freePlay.title} style={{ marginTop: 12 }}>
            {AMOUNT_ROWS.flatMap((amount) =>
              FACES.map((face) => (
                <button
                  key={`${face}${amount}`}
                  type="button"
                  className="btn"
                  onClick={() => turn(face, amount)}
                  aria-label={`${face}${suffixOf(amount)}`}
                >
                  {face}
                  {suffixOf(amount)}
                </button>
              )),
            )}
          </div>

          <div className="controls-row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={undo} disabled={!cube.canUndo && !cube.busy}>
              <Undo2 size={18} aria-hidden="true" /> {t.freePlay.undo}
            </button>
            <button type="button" className="btn" onClick={redo} disabled={!cube.canRedo && !cube.busy}>
              <Redo2 size={18} aria-hidden="true" /> {t.freePlay.redo}
            </button>
            <button type="button" className="btn" onClick={doReset}>
              <RotateCcw size={18} aria-hidden="true" /> {t.freePlay.reset}
            </button>
            <button type="button" className="btn btn-primary" onClick={doScramble}>
              <Shuffle size={18} aria-hidden="true" /> {t.freePlay.scramble}
            </button>
          </div>
        </div>

        <aside className="card" aria-label={t.freePlay.status}>
          <h2 style={{ fontSize: '1.05rem' }}>{t.freePlay.status}</h2>
          <div className="stat-grid" style={{ marginTop: 10 }}>
            <div className="stat">
              <div className="muted">{t.freePlay.turns}</div>
              <div className="stat-value">{cube.history.turnCount}</div>
            </div>
            <div className="stat">
              <div className="muted">{t.freePlay.status}</div>
              <div className={`stat-value ${solved ? 'status-ok' : ''}`}>
                {solved ? (
                  <>
                    <CheckCircle2 size={18} aria-hidden="true" /> {t.freePlay.solved}
                  </>
                ) : (
                  t.freePlay.notSolved
                )}
              </div>
            </div>
            <div className="stat" style={{ gridColumn: '1 / -1' }}>
              <div className="muted">{t.freePlay.validation}</div>
              <div className={`stat-value ${valid ? 'status-ok' : 'status-bad'}`}>
                {valid ? (
                  t.freePlay.valid
                ) : (
                  <>
                    <AlertTriangle size={18} aria-hidden="true" /> {t.freePlay.invalid}
                  </>
                )}
              </div>
            </div>
          </div>

          {scrambleText && (
            <div style={{ marginTop: 16 }}>
              <div className="muted">{t.freePlay.scrambleLabel}</div>
              <p className="scramble-text">{scrambleText}</p>
            </div>
          )}

          <form onSubmit={onApplyFormula} style={{ marginTop: 18 }}>
            <label htmlFor="formula-input" className="muted" style={{ display: 'block', marginBottom: 6 }}>
              {t.freePlay.applyFormula}
            </label>
            <div className="field">
              <input
                id="formula-input"
                type="text"
                value={formula}
                placeholder={t.freePlay.applyPlaceholder}
                onChange={(e) => setFormula(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-invalid={formulaError ? true : undefined}
                aria-describedby={formulaError ? 'formula-error' : undefined}
              />
              <button type="submit" className="btn btn-primary" disabled={formula.trim() === ''}>
                {t.freePlay.apply}
              </button>
            </div>
            {formulaError && (
              <p id="formula-error" className="status-bad" role="alert" style={{ marginTop: 8 }}>
                {formulaError}
              </p>
            )}
          </form>
        </aside>
      </div>
    </section>
  );
}
