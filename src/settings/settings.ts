import type { Lang } from '../i18n/messages';
import { browserAdapter, createTypedStore, type LoadResult, type TypedStore } from '../storage/store';

export type Theme = 'dark' | 'light';
export type Quality = 'high' | 'low';

export interface Settings {
  readonly theme: Theme;
  readonly lang: Lang;
  /** Thời gian quay một lượt 90° (ms). */
  readonly quarterTurnMs: number;
  readonly quality: Quality;
  readonly soundOn: boolean;
  readonly reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  lang: 'vi',
  quarterTurnMs: 180,
  quality: 'high',
  soundOn: false,
  reducedMotion: false,
};

export const SETTINGS_VERSION = 1;
export const SETTINGS_KEY = 'rubix.settings';

export const SPEED_CHOICES: readonly number[] = [400, 250, 180, 110, 60];

function isSettings(data: unknown): data is Settings {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return (
    (d.theme === 'dark' || d.theme === 'light') &&
    (d.lang === 'vi' || d.lang === 'en') &&
    typeof d.quarterTurnMs === 'number' &&
    d.quarterTurnMs >= 0 &&
    d.quarterTurnMs <= 2000 &&
    (d.quality === 'high' || d.quality === 'low') &&
    typeof d.soundOn === 'boolean' &&
    typeof d.reducedMotion === 'boolean'
  );
}

export function createSettingsStore(adapter = browserAdapter()): TypedStore<Settings> {
  return createTypedStore<Settings>({
    adapter,
    key: SETTINGS_KEY,
    version: SETTINGS_VERSION,
    fallback: DEFAULT_SETTINGS,
    validate: isSettings,
  });
}

export function loadSettings(store: TypedStore<Settings>): { settings: Settings; notice: LoadResult<Settings>['status'] } {
  const r = store.load();
  return { settings: r.value, notice: r.status };
}

/** Chuẩn hóa tốc độ: giữ trong danh sách đã định nghĩa, nếu không thì dùng giá trị gần nhất. */
export function nearestSpeed(ms: number): number {
  return SPEED_CHOICES.reduce((best, s) => (Math.abs(s - ms) < Math.abs(best - ms) ? s : best), SPEED_CHOICES[0]);
}
