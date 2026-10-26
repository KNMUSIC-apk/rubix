/**
 * Âm thanh tạo bằng Web Audio API, không cần file âm thanh ngoài.
 * Mặc định tắt. AudioContext chỉ được tạo sau thao tác của người dùng để tránh phát âm thanh bất ngờ.
 */

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const Ctor = globalThis.AudioContext ?? (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

/** Tiếng "tách" ngắn khi quay một lớp. Nhỏ và ngắn để không gây khó chịu. */
export function playTurnClick(enabled: boolean, volume = 0.05): void {
  if (!enabled) return;
  const audio = getContext();
  if (!audio) return;
  if (audio.state === 'suspended') void audio.resume();
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(900, now);
  osc.frequency.exponentialRampToValueAtTime(480, now + 0.03);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.06);
}

/** Âm báo đúng/sai cho bài tập (dùng ở các bước sau). */
export function playFeedback(enabled: boolean, correct: boolean): void {
  if (!enabled) return;
  const audio = getContext();
  if (!audio) return;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const now = audio.currentTime;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(correct ? 660 : 220, now);
  gain.gain.setValueAtTime(0.06, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}
