import { useCallback, useState } from 'react';
import type { FiltersResponse, VideoFilters } from '../lib/api';
import { AGENT_ICONS, MAP_ICONS, RANK_COLORS, RANK_ICONS } from '../lib/valorant-assets';

interface Props {
  availableFilters: FiltersResponse;
  initialFilters: VideoFilters;
}

export default function FilterPanel({ availableFilters, initialFilters }: Props) {
  const [filters, setFilters] = useState<VideoFilters>(initialFilters);
  const [isOpen, setIsOpen] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('filterPanelOpen') !== 'false';
  });

  const update = useCallback(
    (key: keyof VideoFilters, value: string) => {
      // クリックで同じ値なら解除（トグル）
      const isToggle = filters[key] === value;
      const next = { ...filters, [key]: isToggle ? undefined : value, page: 1 };
      setFilters(next);
      window.dispatchEvent(new CustomEvent('filterChange', { detail: next }));
      const url = new URL(window.location.href);
      if (!isToggle) {
        url.searchParams.set(key, value);
      } else {
        url.searchParams.delete(key);
      }
      url.searchParams.delete('page');
      window.history.replaceState({}, '', url.toString());
    },
    [filters],
  );

  const clearAll = useCallback(() => {
    const cleared: VideoFilters = { page: 1 };
    setFilters(cleared);
    window.dispatchEvent(new CustomEvent('filterChange', { detail: cleared }));
    const url = new URL(window.location.href);
    for (const k of ['map', 'agent', 'rank', 'coach', 'coachingType', 'page']) {
      url.searchParams.delete(k);
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      localStorage.setItem('filterPanelOpen', String(next));
      return next;
    });
  }, []);

  const hasActiveFilters =
    filters.map || filters.agent || filters.rank || filters.coach || filters.coachingType;

  return (
    <div className="filter-wrap">
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '0 24px' }}>
        {/* ── トグルバー（常時表示）────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 0',
            minHeight: '40px',
          }}
        >
          {/* FILTERS ボタン */}
          <button
            type="button"
            className={`filter-toggle-btn${isOpen ? ' open' : ''}`}
            onClick={toggleOpen}
            aria-expanded={isOpen}
            aria-label="フィルターを開く"
          >
            {/* フィルターアイコン（三本線） */}
            <svg
              width="12"
              height="10"
              viewBox="0 0 12 10"
              fill="none"
              aria-hidden="true"
              style={{ flexShrink: 0 }}
            >
              <line
                x1="0"
                y1="1"
                x2="12"
                y2="1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="2"
                y1="5"
                x2="10"
                y2="5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <line
                x1="4"
                y1="9"
                x2="8"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <span style={{ pointerEvents: 'none', lineHeight: 1 }}>FILTERS</span>
            <svg
              width="7"
              height="4"
              viewBox="0 0 7 4"
              fill="none"
              aria-hidden="true"
              style={{
                transition: 'transform 0.25s ease',
                transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)',
                flexShrink: 0,
                marginLeft: '1px',
              }}
            >
              <path
                d="M0.5 0.5l3 3 3-3"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {/* セパレーター */}
          <div
            style={{
              width: '1px',
              height: '16px',
              background: 'var(--c-border-dim)',
              flexShrink: 0,
            }}
          />

          {/* アクティブフィルタ簡易バッジ */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flex: 1,
              flexWrap: 'wrap',
              overflow: 'hidden',
            }}
          >
            {filters.map && (
              <ActiveFilterBadge
                type="map"
                label={filters.map}
                onRemove={() => update('map', filters.map!)}
              />
            )}
            {filters.agent && (
              <ActiveFilterBadge
                type="agent"
                label={filters.agent}
                onRemove={() => update('agent', filters.agent!)}
              />
            )}
            {filters.rank && (
              <ActiveFilterBadge
                type="rank"
                label={filters.rank}
                onRemove={() => update('rank', filters.rank!)}
              />
            )}
            {filters.coach && (
              <ActiveFilterBadge
                type="coach"
                label={filters.coach}
                onRemove={() => update('coach', filters.coach!)}
              />
            )}
            {!hasActiveFilters && (
              <span
                className="filter-label"
                style={{ fontSize: '9px', color: 'var(--c-faint)', letterSpacing: '0.1em' }}
              >
                NO FILTERS
              </span>
            )}
          </div>

          {/* Clear All */}
          {hasActiveFilters && (
            <button
              type="button"
              className="clear-btn"
              onClick={clearAll}
              style={{ flexShrink: 0, padding: '4px 10px', fontSize: '10px' }}
            >
              Clear ×
            </button>
          )}
        </div>

        {/* ── 折りたたみコンテンツ ──────────────────────────────────── */}
        <div className={`filter-body${isOpen ? '' : ' collapsed'}`}>
          <div style={{ paddingBottom: '12px' }}>
            {/* ── TYPE ROW ────────────────────────────────────────────── */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}
            >
              <span
                className="filter-label"
                style={{ width: '52px', flexShrink: 0, fontSize: '10px', letterSpacing: '0.14em' }}
              >
                TYPE
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['individual', 'team'] as const).map((type) => (
                  <button
                    type="button"
                    key={type}
                    onClick={() => update('coachingType', type)}
                    style={{
                      padding: '4px 12px',
                      fontSize: '10px',
                      fontFamily: "'Rajdhani', sans-serif",
                      fontWeight: 700,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      cursor: 'pointer',
                      border: `1px solid ${filters.coachingType === type ? 'var(--c-red)' : 'var(--c-border-dim)'}`,
                      background:
                        filters.coachingType === type
                          ? 'rgba(255,70,85,0.12)'
                          : 'var(--c-surface-2)',
                      color: filters.coachingType === type ? 'var(--c-red)' : 'var(--c-muted)',
                      transition: 'all 0.15s',
                      clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
                    }}
                  >
                    {type === 'individual' ? '👤 SOLO' : '👥 TEAM'}
                  </button>
                ))}
              </div>
            </div>

            {/* ── MAP ROW ─────────────────────────────────────────────── */}
            {availableFilters.maps.length > 0 && (
              <FilterRow label="MAP">
                {availableFilters.maps.map((map) => (
                  <MapChip
                    key={map}
                    name={map}
                    selected={filters.map === map}
                    onClick={() => update('map', map)}
                  />
                ))}
              </FilterRow>
            )}

            {/* ── AGENT ROW ───────────────────────────────────────────── */}
            {availableFilters.agents.length > 0 && (
              <FilterRow label="AGENT">
                {availableFilters.agents.map((agent) => (
                  <AgentChip
                    key={agent}
                    name={agent}
                    selected={filters.agent === agent}
                    onClick={() => update('agent', agent)}
                  />
                ))}
              </FilterRow>
            )}

            {/* ── RANK ROW ────────────────────────────────────────────── */}
            {availableFilters.ranks.length > 0 && (
              <FilterRow label="RANK">
                {availableFilters.ranks.map((rank) => (
                  <RankChip
                    key={rank}
                    rank={rank}
                    selected={filters.rank === rank}
                    onClick={() => update('rank', rank)}
                  />
                ))}
              </FilterRow>
            )}

            {/* ── COACH ROW ───────────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <span
                className="filter-label"
                style={{ width: '52px', flexShrink: 0, fontSize: '10px' }}
              >
                COACH
              </span>
              <select
                className="filter-select"
                value={filters.coach ?? ''}
                onChange={(e) => update('coach', e.target.value)}
              >
                <option value="">All</option>
                {availableFilters.coaches.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* スクロールバー非表示 */}
      <style>{`
        .filter-scroll::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}

// ── Active filter badge (トグルバー内の簡易表示) ───────────────────────
function ActiveFilterBadge({
  type,
  label,
  onRemove,
}: {
  type: 'map' | 'agent' | 'rank' | 'coach';
  label: string;
  onRemove: () => void;
}) {
  const agentIcon = type === 'agent' ? AGENT_ICONS[label] : null;
  const rankIcon = type === 'rank' ? RANK_ICONS[label] : null;
  const rankColor = type === 'rank' ? (RANK_COLORS[label]?.text ?? 'var(--c-muted)') : null;

  return (
    <button
      type="button"
      className="active-filter-badge"
      onClick={onRemove}
      title={`Remove ${label}`}
      data-type={type}
      style={{ '--rank-color': rankColor ?? 'var(--c-muted)' } as React.CSSProperties}
    >
      {type === 'map' && <span style={{ fontSize: '10px', lineHeight: 1, flexShrink: 0 }}>⬡</span>}
      {agentIcon && (
        <img
          src={agentIcon}
          alt=""
          width={14}
          height={14}
          style={{
            objectFit: 'cover',
            flexShrink: 0,
            clipPath:
              'polygon(22% 0%, 78% 0%, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0% 78%, 0% 22%)',
          }}
          loading="lazy"
        />
      )}
      {rankIcon && (
        <img
          src={rankIcon}
          alt=""
          width={13}
          height={13}
          style={{ objectFit: 'contain', flexShrink: 0 }}
          loading="lazy"
        />
      )}
      <span>{label}</span>
      <span style={{ opacity: 0.5, fontSize: '9px', lineHeight: 1 }}>×</span>
    </button>
  );
}

// ── Row container ──────────────────────────────────────────────────────
function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
      <span
        className="filter-label"
        style={{
          width: '52px',
          flexShrink: 0,
          fontSize: '10px',
          letterSpacing: '0.14em',
        }}
      >
        {label}
      </span>
      <div
        className="filter-scroll"
        style={{
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          flexWrap: 'nowrap',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          paddingBottom: '2px',
          alignItems: 'flex-end',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ── Map chip — fullbleed radar image with text overlay ────────────────
function MapChip({
  name,
  selected,
  onClick,
}: {
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const icon = MAP_ICONS[name];
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      style={{
        position: 'relative',
        width: 88,
        height: 44,
        padding: 0,
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        overflow: 'hidden',
        background: 'var(--c-surface-2)',
        clipPath: 'polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 0 100%)',
        transition: 'box-shadow 0.15s',
        boxShadow: selected
          ? '0 0 0 2px var(--c-red), 0 0 14px rgba(255,70,85,0.45)'
          : '0 0 0 1px rgba(255,255,255,0.04)',
      }}
    >
      {/* マップ画像 */}
      {icon ? (
        <img
          src={icon}
          alt={name}
          width={80}
          height={80}
          style={{
            display: 'block',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            filter: selected ? 'brightness(1.15) saturate(1.2)' : 'brightness(0.45) saturate(0.4)',
            transition: 'filter 0.15s',
          }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--c-faint)',
            fontSize: '24px',
          }}
        >
          ⬡
        </div>
      )}

      {/* 下部グラデーションスクリム */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '40px',
          background: 'linear-gradient(to top, rgba(9,14,20,0.88) 0%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />

      {/* テキストオーバーレイ */}
      <span
        style={{
          position: 'absolute',
          bottom: 5,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: '9px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: selected ? 'var(--c-red)' : 'rgba(236,232,225,0.75)',
          whiteSpace: 'nowrap',
          lineHeight: 1,
          transition: 'color 0.15s',
          pointerEvents: 'none',
        }}
      >
        {name}
      </span>

      {/* 選択時の赤コーナーアクセント */}
      {selected && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            width: 10,
            height: 10,
            background: 'var(--c-red)',
            clipPath: 'polygon(100% 0, 100% 100%, 0 0)',
            pointerEvents: 'none',
          }}
        />
      )}
    </button>
  );
}

// ── Agent chip — shows portrait icon (oct-clipped) ────────────────────
function AgentChip({
  name,
  selected,
  onClick,
}: {
  name: string;
  selected: boolean;
  onClick: () => void;
}) {
  const icon = AGENT_ICONS[name];
  return (
    <button
      type="button"
      onClick={onClick}
      title={name}
      style={{
        background: selected ? 'rgba(255,70,85,0.1)' : 'transparent',
        border: `1px solid ${selected ? 'rgba(255,70,85,0.7)' : 'transparent'}`,
        padding: '3px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        transition: 'all 0.15s',
        flexShrink: 0,
        boxShadow: selected ? '0 0 8px rgba(255,70,85,0.25)' : 'none',
      }}
    >
      {icon ? (
        <img
          src={icon}
          alt={name}
          width={42}
          height={42}
          style={{
            display: 'block',
            objectFit: 'cover',
            clipPath:
              'polygon(22% 0%, 78% 0%, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0% 78%, 0% 22%)',
            filter: selected ? 'brightness(1.15) saturate(1.1)' : 'brightness(0.55) saturate(0.4)',
            transition: 'filter 0.15s',
          }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: 42,
            height: 42,
            background: 'var(--c-surface-2)',
            clipPath:
              'polygon(22% 0%, 78% 0%, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0% 78%, 0% 22%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--c-muted)',
            fontSize: '14px',
          }}
        >
          ?
        </div>
      )}
      {/* 選択時のみ名前表示 */}
      <span
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: '8px',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: selected ? 'var(--c-red)' : 'transparent',
          whiteSpace: 'nowrap',
          lineHeight: 1,
          height: '10px',
          transition: 'color 0.15s',
          userSelect: 'none',
        }}
      >
        {name}
      </span>
    </button>
  );
}

// ── Rank chip — emblem icon + name ────────────────────────────────────
function RankChip({
  rank,
  selected,
  onClick,
}: {
  rank: string;
  selected: boolean;
  onClick: () => void;
}) {
  const c = RANK_COLORS[rank] ?? {
    bg: 'rgba(255,255,255,0.05)',
    text: 'var(--c-muted)',
    border: 'var(--c-border)',
  };
  const icon = RANK_ICONS[rank];
  return (
    <button
      type="button"
      onClick={onClick}
      title={rank}
      style={{
        background: selected ? c.bg : 'var(--c-surface-2)',
        border: `1px solid ${selected ? c.border : 'var(--c-border-dim)'}`,
        padding: '4px 4px 5px',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '3px',
        transition: 'all 0.15s',
        clipPath: 'polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 0 100%)',
        flexShrink: 0,
        boxShadow: selected ? `0 0 10px ${c.border}55` : 'none',
        minWidth: '46px',
      }}
    >
      {icon ? (
        <img
          src={icon}
          alt={rank}
          width={34}
          height={34}
          style={{
            display: 'block',
            objectFit: 'contain',
            filter: selected
              ? 'brightness(1.2) saturate(1.15) drop-shadow(0 0 4px currentColor)'
              : 'brightness(0.45) saturate(0.3)',
            transition: 'filter 0.15s',
          }}
          loading="lazy"
        />
      ) : (
        <div
          style={{
            width: 34,
            height: 34,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: selected ? c.text : 'var(--c-faint)',
            fontSize: '18px',
          }}
        >
          ◆
        </div>
      )}
      <span
        style={{
          fontFamily: "'Rajdhani', sans-serif",
          fontWeight: 700,
          fontSize: '8px',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: selected ? c.text : 'var(--c-muted)',
          whiteSpace: 'nowrap',
          lineHeight: 1,
          transition: 'color 0.15s',
        }}
      >
        {rank}
      </span>
    </button>
  );
}
