import { useCallback, useEffect, useMemo, useState } from 'react';
import { createSettingsStore, DEFAULT_SETTINGS, type Settings } from '../settings/settings';
import { MESSAGES, type Lang, type Messages } from '../i18n/messages';
import type { TypedStore } from '../storage/store';

export interface SettingsApi {
  readonly settings: Settings;
  readonly t: Messages;
  readonly update: (patch: Partial<Settings>) => void;
  readonly resetAll: () => void;
  readonly storageError: boolean;
  readonly corrupt: boolean;
}

/**
 * Quản lý cài đặt: đọc từ storage khi khởi động, lưu lại khi thay đổi,
 * và áp dụng theme/ngôn ngữ lên thẻ <html>.
 */
export function useSettings(storeArg?: TypedStore<Settings>): SettingsApi {
  const [store] = useState<TypedStore<Settings>>(() => storeArg ?? createSettingsStore());
  const [initial] = useState(() => store.load());
  const [settings, setSettings] = useState<Settings>(initial.value);
  const [storageError, setStorageError] = useState(false);

  const t = useMemo<Messages>(() => MESSAGES[settings.lang as Lang] as Messages, [settings.lang]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = settings.theme;
    root.lang = settings.lang;
    root.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
  }, [settings.theme, settings.lang, settings.reducedMotion]);

  const update = useCallback(
    (patch: Partial<Settings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...patch };
        const res = store.save(next);
        setStorageError(!res.ok);
        return next;
      });
    },
    [store],
  );

  const resetAll = useCallback(() => {
    store.clear();
    setSettings(DEFAULT_SETTINGS);
    setStorageError(false);
  }, [store]);

  return {
    settings,
    t,
    update,
    resetAll,
    storageError,
    corrupt: initial.status === 'corrupt',
  };
}
