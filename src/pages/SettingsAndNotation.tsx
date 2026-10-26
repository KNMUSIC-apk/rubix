import type { Messages, Lang } from '../i18n/messages';
import { SPEED_CHOICES, type Settings } from '../settings/settings';

interface SettingsPageProps {
  readonly t: Messages;
  readonly settings: Settings;
  readonly update: (patch: Partial<Settings>) => void;
  readonly resetAll: () => void;
}

function Segmented<T extends string | number>(props: {
  readonly value: T;
  readonly options: readonly { value: T; label: string }[];
  readonly onChange: (v: T) => void;
  readonly ariaLabel: string;
}) {
  return (
    <div className="segmented" role="group" aria-label={props.ariaLabel}>
      {props.options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className="btn"
          aria-pressed={props.value === o.value}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SettingsPage({ t, settings, update, resetAll }: SettingsPageProps) {
  const speedLabel = (ms: number) => (ms >= 400 ? 'Chậm' : ms >= 250 ? 'Vừa' : ms >= 180 ? 'Bình thường' : ms >= 110 ? 'Nhanh' : 'Rất nhanh');
  const speedOptions = SPEED_CHOICES.map((ms) => ({ value: ms, label: `${speedLabel(ms)} (${ms} ms)` }));
  return (
    <section aria-labelledby="settings-title">
      <header style={{ marginBottom: 16 }}>
        <h1 id="settings-title">{t.settings.title}</h1>
      </header>
      <div className="card settings-grid">
        <div className="setting-row">
          <span>{t.settings.theme}</span>
          <Segmented
            ariaLabel={t.settings.theme}
            value={settings.theme}
            onChange={(v) => update({ theme: v })}
            options={[
              { value: 'dark', label: t.settings.themeDark },
              { value: 'light', label: t.settings.themeLight },
            ]}
          />
        </div>
        <div className="setting-row">
          <span>{t.settings.language}</span>
          <Segmented<Lang>
            ariaLabel={t.settings.language}
            value={settings.lang}
            onChange={(v) => update({ lang: v })}
            options={[
              { value: 'vi', label: 'Tiếng Việt' },
              { value: 'en', label: 'English' },
            ]}
          />
        </div>
        <div className="setting-row">
          <span>{t.settings.speed}</span>
          <Segmented
            ariaLabel={t.settings.speed}
            value={settings.quarterTurnMs}
            onChange={(v) => update({ quarterTurnMs: v })}
            options={speedOptions}
          />
        </div>
        <div className="setting-row">
          <span>{t.settings.quality}</span>
          <Segmented
            ariaLabel={t.settings.quality}
            value={settings.quality}
            onChange={(v) => update({ quality: v })}
            options={[
              { value: 'high', label: t.settings.qualityHigh },
              { value: 'low', label: t.settings.qualityLow },
            ]}
          />
        </div>
        <div className="setting-row">
          <span>{t.settings.sound}</span>
          <Segmented
            ariaLabel={t.settings.sound}
            value={settings.soundOn ? 'on' : 'off'}
            onChange={(v) => update({ soundOn: v === 'on' })}
            options={[
              { value: 'on', label: t.settings.soundOn },
              { value: 'off', label: t.settings.soundOff },
            ]}
          />
        </div>
        <div className="setting-row">
          <span>{t.settings.reducedMotion}</span>
          <Segmented
            ariaLabel={t.settings.reducedMotion}
            value={settings.reducedMotion ? 'on' : 'off'}
            onChange={(v) => update({ reducedMotion: v === 'on' })}
            options={[
              { value: 'on', label: t.settings.soundOn },
              { value: 'off', label: t.settings.soundOff },
            ]}
          />
        </div>
        <div className="setting-row">
          <span className="muted">{t.settings.reset}</span>
          <button type="button" className="btn" onClick={resetAll}>
            {t.settings.reset}
          </button>
        </div>
      </div>
    </section>
  );
}

const NOTATION_ROWS: readonly { symbol: string; vi: string; en: string }[] = [
  { symbol: 'U / D / L / R / F / B', vi: 'Quay một lớp ngoài theo chiều kim đồng hồ, nhìn trực tiếp vào mặt được quay.', en: 'Turn one outer layer clockwise, as seen looking straight at that face.' },
  { symbol: "R'", vi: 'Dấu nháy: quay ngược chiều kim đồng hồ (tương đương ba lần quay thuận).', en: 'Prime: counter-clockwise (equal to three clockwise turns).' },
  { symbol: 'R2', vi: 'Quay 180° (hai lần quay thuận).', en: 'Double turn: 180°.' },
  { symbol: 'u / d / l / r / f / b', vi: 'Wide move: quay hai lớp (lớp ngoài và lớp giữa cạnh đó).', en: 'Wide move: turn two layers (the outer layer and the middle layer next to it).' },
  { symbol: 'M / E / S', vi: 'Lát cắt giữa: M theo chiều L, E theo chiều D, S theo chiều F.', en: 'Slice moves: M follows L, E follows D, S follows F.' },
  { symbol: 'x / y / z', vi: 'Quay toàn khối theo chiều R, U, F. Trạng thái giải không đổi, chỉ thay đổi hướng nhìn.', en: 'Whole-cube rotations following R, U and F.' },
];

export function NotationPage({ t, lang }: { t: Messages; lang: Lang }) {
  return (
    <section aria-labelledby="notation-title">
      <header style={{ marginBottom: 16 }}>
        <h1 id="notation-title">{t.nav.notation}</h1>
      </header>
      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">{lang === 'vi' ? 'Ký hiệu' : 'Symbol'}</th>
              <th scope="col">{lang === 'vi' ? 'Ý nghĩa' : 'Meaning'}</th>
            </tr>
          </thead>
          <tbody>
            {NOTATION_ROWS.map((row) => (
              <tr key={row.symbol}>
                <td className="symbol">{row.symbol}</td>
                <td>{lang === 'vi' ? row.vi : row.en}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
