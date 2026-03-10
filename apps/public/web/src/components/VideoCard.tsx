import type { VideoItem } from '../lib/api';
import { formatDuration } from '../lib/api';
import { AGENT_ICONS, RANK_ICONS } from '../lib/valorant-assets';

interface Props {
  video: VideoItem;
  onClick: (videoId: string) => void;
  onReport: (video: VideoItem) => void;
}

// Rank → CSS class suffix mapping
const RANK_CLASS: Record<string, string> = {
  Iron: 'iron',
  Bronze: 'bronze',
  Silver: 'silver',
  Gold: 'gold',
  Platinum: 'platinum',
  Diamond: 'diamond',
  Ascendant: 'ascendant',
  Immortal: 'immortal',
  Radiant: 'radiant',
};

export default function VideoCard({ video, onClick, onReport }: Props) {
  const duration = formatDuration(video.duration);
  const rankClass = video.rank ? RANK_CLASS[video.rank] : null;

  return (
    <button type="button" className="valo-card" onClick={() => onClick(video.id)}>
      {/* スキャンライン（ホバーアニメーション） */}
      <div className="scan-line" />

      {/* コーナーアクセント（斜めカット装飾） */}
      <div className="corner-accent" />

      {/* サムネイル */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '16/9',
          background: 'var(--c-surface-2)',
          overflow: 'hidden',
        }}
      >
        <img
          src={video.thumbnailUrl || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
          alt={video.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            transition: 'transform 0.3s ease',
          }}
          loading="lazy"
          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.04)')}
          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        />

        {/* 再生オーバーレイ */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(15,25,35,0.7) 0%, transparent 50%)',
            pointerEvents: 'none',
          }}
        />

        {/* 再生アイコン（ホバー時） */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: 'rgba(255,70,85,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
            pointerEvents: 'none',
          }}
          className="play-btn-overlay"
        >
          {/** biome-ignore lint/a11y/noSvgWithoutTitle: false positive */}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
            <polygon points="5,2 14,8 5,14" />
          </svg>
        </div>

        {/* デュレーションバッジ */}
        {duration && (
          <span
            className="font-mono"
            style={{
              position: 'absolute',
              bottom: '8px',
              right: '8px',
              background: 'rgba(9,14,20,0.85)',
              color: 'var(--c-text)',
              fontSize: '11px',
              padding: '2px 6px',
              letterSpacing: '0.05em',
            }}
          >
            {duration}
          </span>
        )}
      </div>

      {/* カード情報 */}
      <div style={{ padding: '12px 14px 14px' }}>
        <p
          className="font-rajdhani"
          style={{
            fontSize: '14px',
            fontWeight: 600,
            lineHeight: 1.35,
            color: 'var(--c-text)',
            marginBottom: '6px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            letterSpacing: '0.02em',
          }}
        >
          {video.title}
        </p>

        <p
          style={{
            fontSize: '11px',
            color: 'var(--c-muted)',
            marginBottom: '10px',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
          }}
        >
          {video.channelTitle}
        </p>

        {/* タグバッジ + 報告ボタン */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
          {video.map && video.map !== 'null' && <span className="map-badge">{video.map}</span>}
          {video.agent && video.agent !== 'null' && (
            <span
              className="agent-badge"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              {AGENT_ICONS[video.agent] && (
                <img
                  src={AGENT_ICONS[video.agent]}
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
              {video.agent}
            </span>
          )}
          {video.rank && video.rank !== 'null' && rankClass && (
            <span
              className={`rank-badge rank-${rankClass}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}
            >
              {RANK_ICONS[video.rank] && (
                <img
                  src={RANK_ICONS[video.rank]}
                  alt=""
                  width={13}
                  height={13}
                  style={{ objectFit: 'contain', flexShrink: 0 }}
                  loading="lazy"
                />
              )}
              {video.rank}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onReport(video);
            }}
            title="タグを修正提案する"
            style={{
              marginLeft: 'auto',
              background: 'rgba(255,70,85,0.08)',
              border: '1px solid rgba(255,70,85,0.25)',
              cursor: 'pointer',
              color: '#FF4655',
              fontSize: '11px',
              lineHeight: 1,
              padding: '4px 8px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              transition: 'background 0.15s, border-color 0.15s',
              fontFamily: 'JetBrains Mono, monospace',
              letterSpacing: '0.05em',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,70,85,0.2)';
              el.style.borderColor = '#FF4655';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.background = 'rgba(255,70,85,0.08)';
              el.style.borderColor = 'rgba(255,70,85,0.25)';
            }}
          >
            <span style={{ fontSize: '13px' }}>⚑</span>
            <span style={{ fontSize: '10px', letterSpacing: '0.08em' }}>修正</span>
          </button>
        </div>
      </div>

      <style>{`
        .valo-card:hover .play-btn-overlay { opacity: 1 !important; }
      `}</style>
    </button>
  );
}
