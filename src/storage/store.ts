/**
 * Lưu trữ cục bộ an toàn: bọc localStorage trong một phong bì có phiên bản.
 * - Dữ liệu hỏng, sai phiên bản hoặc localStorage bị chặn đều trả về giá trị mặc định, không làm sập ứng dụng.
 * - Lỗi được trả về cho tầng giao diện hiển thị; không ghi dữ liệu người dùng vào log.
 */

export interface KeyValueAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type LoadResult<T> =
  | { readonly status: 'ok'; readonly value: T }
  | { readonly status: 'missing'; readonly value: T }
  | { readonly status: 'corrupt'; readonly value: T; readonly reason: string };

interface Envelope<T> {
  readonly v: number;
  readonly data: T;
}

export interface TypedStore<T> {
  load(): LoadResult<T>;
  save(value: T): { ok: true } | { ok: false; reason: string };
  clear(): void;
}

export function createTypedStore<T>(opts: {
  adapter: KeyValueAdapter;
  key: string;
  version: number;
  fallback: T;
  /** Tùy chọn kiểm tra kiểu dữ liệu đọc được. Trả về false nếu không hợp lệ. */
  validate?: (data: unknown) => data is T;
}): TypedStore<T> {
  const { adapter, key, version, fallback, validate } = opts;
  return {
    load(): LoadResult<T> {
      let raw: string | null;
      try {
        raw = adapter.getItem(key);
      } catch {
        return { status: 'corrupt', value: fallback, reason: 'storage-unavailable' };
      }
      if (raw === null) return { status: 'missing', value: fallback };
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return { status: 'corrupt', value: fallback, reason: 'invalid-json' };
      }
      const env = parsed as Partial<Envelope<unknown>> | null;
      if (!env || typeof env !== 'object' || env.v !== version || !('data' in env)) {
        return { status: 'corrupt', value: fallback, reason: 'version-mismatch' };
      }
      if (validate && !validate(env.data)) {
        return { status: 'corrupt', value: fallback, reason: 'shape-mismatch' };
      }
      return { status: 'ok', value: env.data as T };
    },
    save(value: T) {
      try {
        const envelope: Envelope<T> = { v: version, data: value };
        adapter.setItem(key, JSON.stringify(envelope));
        return { ok: true };
      } catch (err) {
        const name = err instanceof Error ? err.name : 'unknown';
        return { ok: false, reason: name };
      }
    },
    clear() {
      try {
        adapter.removeItem(key);
      } catch {
        // Bỏ qua: không có gì để xóa nếu storage không khả dụng.
      }
    },
  };
}

/** Adapter trong bộ nhớ, dùng cho kiểm thử và khi localStorage không khả dụng. */
export function createMemoryAdapter(): KeyValueAdapter {
  const map = new Map<string, string>();
  return {
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => {
      map.set(k, v);
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** Lấy localStorage nếu trình duyệt cho phép, ngược lại trả về adapter bộ nhớ. */
export function browserAdapter(): KeyValueAdapter {
  try {
    const ls = globalThis.localStorage;
    const probe = '__rubix_probe__';
    ls.setItem(probe, '1');
    ls.removeItem(probe);
    return ls;
  } catch {
    return createMemoryAdapter();
  }
}
