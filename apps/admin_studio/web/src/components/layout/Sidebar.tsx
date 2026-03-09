import type { Page } from '../../App.tsx';

const NAV: { id: Page; label: string; code: string }[] = [
  { id: 'videos', label: '動画一覧', code: 'VIDEOS' },
  { id: 'collect', label: '動画収集', code: 'COLLECT' },
  { id: 'tag', label: 'タグ付け', code: 'TAGGING' },
  { id: 'review', label: 'レビュー', code: 'REVIEW' },
  { id: 'sync', label: 'D1 同期', code: 'SYNC' },
];

interface Props {
  current: Page;
  onNavigate: (page: Page) => void;
}

export default function Sidebar({ current, onNavigate }: Props) {
  return (
    <aside
      className="relative z-10 flex flex-col shrink-0 border-r border-line bg-surface"
      style={{ width: '14rem' }}
    >
      {/* ── Logo ──────────────────────────────────── */}
      <div className="px-5 pt-5 pb-4 border-b border-line">
        <div className="page-eyebrow" style={{ marginBottom: '0.4rem' }}>
          // TACTICAL OPS
        </div>
        <div
          className="text-accent font-bold uppercase leading-none"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '1.45rem',
            letterSpacing: '0.04em',
          }}
        >
          ValoCoach
        </div>
        <div
          className="text-dim font-semibold uppercase"
          style={{
            fontFamily: 'Rajdhani, sans-serif',
            fontSize: '0.85rem',
            letterSpacing: '0.18em',
            marginTop: '0.1rem',
          }}
        >
          Admin Studio
        </div>
      </div>

      {/* ── Navigation ────────────────────────────── */}
      <nav className="flex-1 py-2">
        {NAV.map((item, i) => {
          const active = current === item.id;
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="animate-in w-full flex items-center gap-3 px-5 py-3 text-left transition-colors relative"
              style={{
                animationDelay: `${i * 35}ms`,
                background: active ? 'rgba(255,70,85,0.06)' : 'transparent',
                color: active ? '#C8C8D0' : '#888896',
              }}
              onMouseEnter={(e) => {
                if (!active) (e.currentTarget as HTMLElement).style.background = '#17171C';
              }}
              onMouseLeave={(e) => {
                if (!active)
                  (e.currentTarget as HTMLElement).style.background = active
                    ? 'rgba(255,70,85,0.06)'
                    : 'transparent';
              }}
            >
              {/* Active left border */}
              {active && (
                <span
                  className="absolute left-0 top-0 bottom-0"
                  style={{ width: '3px', background: '#FF4655' }}
                />
              )}

              {/* Indicator */}
              <span
                style={{
                  fontSize: '0.42rem',
                  color: active ? '#FF4655' : '#444450',
                  transition: 'color 0.15s',
                }}
              >
                {active ? '◆' : '◇'}
              </span>

              {/* Label + code */}
              <span className="flex-1">
                <span
                  className="block font-semibold"
                  style={{
                    fontFamily: 'Rajdhani, sans-serif',
                    fontSize: '0.9rem',
                    letterSpacing: '0.04em',
                  }}
                >
                  {item.label}
                </span>
                <span
                  className="block"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.6rem',
                    letterSpacing: '0.14em',
                    color: active ? '#FF465540' : '#44445066',
                    marginTop: '0.05rem',
                  }}
                >
                  {item.code}
                </span>
              </span>

              {active && <span style={{ fontSize: '0.6rem', color: '#FF4655' }}>▶</span>}
            </button>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────── */}
      <div
        className="px-5 py-3 border-t border-line"
        style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.65rem' }}
      >
        <div className="flex justify-between items-center">
          <span className="text-faint">API</span>
          <span className="text-ok flex items-center gap-1.5">
            <span className="live-dot" />
            ONLINE
          </span>
        </div>
        <div className="text-faint" style={{ opacity: 0.5, marginTop: '0.15rem' }}>
          localhost:3001
        </div>
      </div>
    </aside>
  );
}
