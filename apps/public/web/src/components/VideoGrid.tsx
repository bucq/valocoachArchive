import { useState, useEffect, useCallback } from 'react';
import VideoCard from './VideoCard';
import VideoPlayer from './VideoPlayer';
import CorrectionModal from './CorrectionModal';
import { fetchVideos } from '../lib/api';
import type { VideoItem, VideoFilters } from '../lib/api';

interface Props {
  apiBase:        string;
  initialFilters: VideoFilters;
}

export default function VideoGrid({ apiBase, initialFilters }: Props) {
  const [videos, setVideos]         = useState<VideoItem[]>([]);
  const [total, setTotal]           = useState(0);
  const [page, setPage]             = useState(initialFilters.page ?? 1);
  const [filters, setFilters]       = useState<VideoFilters>(initialFilters);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selectedId, setSelectedId]       = useState<string | null>(null);
  const [reportingVideo, setReportingVideo] = useState<VideoItem | null>(null);

  const load = useCallback(async (f: VideoFilters, p: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchVideos(apiBase, { ...f, page: p, limit: 24 });
      setVideos(res.videos);
      setTotal(res.total);
    } catch (e) {
      setError('動画の取得に失敗しました');
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    const handler = (e: CustomEvent<VideoFilters>) => {
      const newFilters = e.detail;
      setFilters(newFilters);
      setPage(1);
      load(newFilters, 1);
    };
    window.addEventListener('filterChange', handler as EventListener);
    return () => window.removeEventListener('filterChange', handler as EventListener);
  }, [load]);

  useEffect(() => {
    load(filters, page);
  }, []);

  const totalPages = Math.ceil(total / 24);

  return (
    <>
      <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>

        {/* 結果カウンター */}
        {!loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
            <div style={{
              width: '3px', height: '16px',
              background: 'var(--c-red)',
              flexShrink: 0,
            }} />
            <p className="font-condensed" style={{
              fontSize: '12px',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'var(--c-muted)',
            }}>
              <span style={{ color: 'var(--c-text)', fontSize: '15px', fontFamily: "'JetBrains Mono', monospace" }}>
                {total.toLocaleString()}
              </span>
              {' '}VIDEOS FOUND
              {(filters.map || filters.agent || filters.rank || filters.coach) && (
                <span style={{ color: 'var(--c-red)', marginLeft: '8px' }}>/ FILTERED</span>
              )}
            </p>
          </div>
        )}

        {/* ローディングスケルトン */}
        {loading && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="clip-br" style={{
                background: 'var(--c-surface)',
                border: '1px solid var(--c-border-dim)',
                overflow: 'hidden',
              }}>
                <div className="skeleton" style={{ aspectRatio: '16/9', width: '100%' }} />
                <div style={{ padding: '12px 14px' }}>
                  <div className="skeleton" style={{ height: '14px', width: '80%', marginBottom: '8px' }} />
                  <div className="skeleton" style={{ height: '11px', width: '50%', marginBottom: '12px' }} />
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <div className="skeleton" style={{ height: '18px', width: '56px' }} />
                    <div className="skeleton" style={{ height: '18px', width: '44px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* エラー */}
        {error && (
          <div className="font-rajdhani" style={{
            textAlign: 'center',
            padding: '60px 0',
            color: 'var(--c-red)',
            letterSpacing: '0.08em',
            fontSize: '14px',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.6 }}>⚠</div>
            {error}
          </div>
        )}

        {/* 空状態 */}
        {!loading && !error && videos.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div className="font-rajdhani" style={{
              fontSize: '13px',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
              color: 'var(--c-faint)',
              marginBottom: '8px',
            }}>
              NO INTEL FOUND
            </div>
            <div style={{ color: 'var(--c-muted)', fontSize: '13px' }}>
              フィルター条件を変更してみてください
            </div>
          </div>
        )}

        {/* 動画グリッド */}
        {!loading && videos.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {videos.map(video => (
              <VideoCard
                key={video.id}
                video={video}
                onClick={setSelectedId}
                onReport={setReportingVideo}
              />
            ))}
          </div>
        )}

        {/* ページネーション */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '40px' }}>
            <button
              className="page-btn"
              onClick={() => { const p = page - 1; setPage(p); load(filters, p); }}
              disabled={page <= 1}
            >
              ← PREV
            </button>
            <span className="font-mono" style={{
              fontSize: '13px',
              color: 'var(--c-muted)',
              padding: '0 8px',
              letterSpacing: '0.06em',
            }}>
              {String(page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
            </span>
            <button
              className="page-btn"
              onClick={() => { const p = page + 1; setPage(p); load(filters, p); }}
              disabled={page >= totalPages}
            >
              NEXT →
            </button>
          </div>
        )}
      </div>

      {/* 動画プレイヤーモーダル */}
      {selectedId && (
        <VideoPlayer
          videoId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* タグ修正リクエストモーダル */}
      {reportingVideo && (
        <CorrectionModal
          apiBase={apiBase}
          videoId={reportingVideo.id}
          title={reportingVideo.title}
          currentMap={reportingVideo.map}
          currentAgent={reportingVideo.agent}
          currentRank={reportingVideo.rank}
          onClose={() => setReportingVideo(null)}
        />
      )}
    </>
  );
}
