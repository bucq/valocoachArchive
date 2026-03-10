import { useEffect } from 'react';

interface Props {
  videoId: string;
  onClose: () => void;
}

export default function VideoPlayer({ videoId, onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  return (
    <div
      className="player-backdrop"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div className="player-container">
        {/* 閉じるボタン */}
        <button type="button" className="player-close" onClick={onClose} aria-label="Close player">
          <span>ESC</span>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
            <path
              d="M1 1l10 10M11 1L1 11"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* ターゲットブラケット付きフレーム */}
        <div className="player-frame">
          <div className="corner-bl" />
          <div className="corner-tr" />

          {/* YouTube iframe */}
          <div style={{ aspectRatio: '16/9', width: '100%', overflow: 'hidden' }}>
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`}
              title="YouTube video player"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              style={{ width: '100%', height: '100%', display: 'block', border: 'none' }}
            />
          </div>
        </div>

        {/* 下部ラベル */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            marginTop: '16px',
            gap: '8px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'var(--c-red)',
              boxShadow: '0 0 6px var(--c-red)',
            }}
          />
          <span
            style={{
              fontFamily: "'Rajdhani', sans-serif",
              fontSize: '11px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--c-muted)',
            }}
          >
            CLICK OUTSIDE OR PRESS ESC TO CLOSE
          </span>
          <div
            style={{
              width: '4px',
              height: '4px',
              borderRadius: '50%',
              background: 'var(--c-red)',
              boxShadow: '0 0 6px var(--c-red)',
            }}
          />
        </div>
      </div>
    </div>
  );
}
