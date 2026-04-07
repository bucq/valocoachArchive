import { AGENT_ICONS, MAP_ICONS, RANK_ICONS } from '@valocoach/valorant';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  apiFetch,
  fetchVideoCorrections,
  resolveVideoCorrections,
  type TagCorrectionRequest,
  type Video,
} from '../lib/api.ts';
import { AGENTS, MAPS, RANKS } from '../lib/valorant.ts';

// ── カスタムアイコン付きセレクト ─────────────────────────────────────────────
interface IconSelectProps {
  value: string;
  options: string[];
  icons: Record<string, string>;
  iconClip?: string;
  iconSize?: number;
  onChange: (v: string) => void;
}

function IconSelect({ value, options, icons, iconClip, iconSize = 16, onChange }: IconSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '9rem' }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field"
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.72rem',
          borderColor: open ? 'rgba(255,255,255,0.3)' : undefined,
        }}
      >
        {value && icons[value] ? (
          <img
            src={icons[value]}
            alt=""
            width={iconSize}
            height={iconSize}
            style={{ objectFit: 'cover', flexShrink: 0, clipPath: iconClip }}
          />
        ) : (
          <span style={{ width: iconSize, flexShrink: 0 }} />
        )}
        <span style={{ flex: 1, color: value ? 'var(--c-text, #e8eaf0)' : '#555' }}>
          {value || '—'}
        </span>
        <span style={{ color: '#333', fontSize: '0.6rem' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 2px)',
            left: 0,
            right: 0,
            background: '#0a1018',
            border: '1px solid rgba(255,255,255,0.12)',
            zIndex: 50,
            maxHeight: '200px',
            overflowY: 'auto',
          }}
        >
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.4rem 0.6rem',
              background: value === '' ? 'rgba(255,255,255,0.05)' : 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#555',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.68rem',
              textAlign: 'left',
            }}
          >
            <span style={{ width: iconSize, flexShrink: 0 }} />—
          </button>
          {options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setOpen(false);
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.35rem 0.6rem',
                background: opt === value ? 'rgba(74,158,255,0.12)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: opt === value ? '#e8eaf0' : '#999',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.68rem',
                textAlign: 'left',
                transition: 'background 0.1s',
              }}
              onMouseEnter={(e) => {
                if (opt !== value)
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (opt !== value) (e.currentTarget as HTMLElement).style.background = 'none';
              }}
            >
              {icons[opt] ? (
                <img
                  src={icons[opt]}
                  alt=""
                  width={iconSize}
                  height={iconSize}
                  style={{ objectFit: 'cover', flexShrink: 0, clipPath: iconClip }}
                  loading="lazy"
                />
              ) : (
                <span style={{ width: iconSize, flexShrink: 0 }} />
              )}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ReviewVideo extends Video {
  _editing?: { map: string; agent: string; rank: string };
  _corrections?: TagCorrectionRequest[];
}

export default function ReviewPage() {
  const [videos, setVideos] = useState<ReviewVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchVideos = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await apiFetch<{ count: number; page: number; limit: number; videos: Video[] }>(
        `/api/admin/review?page=${p}&limit=20`,
      );
      const base = res.videos.map((v) => ({
        ...v,
        _editing: { map: v.map ?? '', agent: v.agent ?? '', rank: v.rank ?? '' },
      }));
      setTotal(res.count);
      setVideos(base);

      // corrections を並行 fetch（失敗しても無視）
      const correctionResults = await Promise.allSettled(
        base.map((v) => fetchVideoCorrections(v.id)),
      );
      setVideos((vs) =>
        vs.map((v, i) => ({
          ...v,
          _corrections:
            correctionResults[i].status === 'fulfilled' ? correctionResults[i].value : [],
        })),
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideos(page);
  }, [fetchVideos, page]);

  const setField = (id: string, field: 'map' | 'agent' | 'rank', value: string) => {
    setVideos((vs) =>
      vs.map((v) => (v.id === id ? { ...v, _editing: { ...v._editing!, [field]: value } } : v)),
    );
  };

  const handleCorrect = async (v: ReviewVideo) => {
    setMsg('');
    try {
      await apiFetch(`/api/admin/review/${v.id}/correct`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          map: v._editing?.map || null,
          agent: v._editing?.agent || null,
          rank: v._editing?.rank || null,
        }),
      });
      await resolveVideoCorrections(v.id, 'resolved').catch(() => {});
      setMsg(`✔ ${v.title} — 修正しました`);
      setVideos((vs) => vs.filter((x) => x.id !== v.id));
    } catch (e) {
      setMsg(`エラー: ${String(e)}`);
    }
  };

  const handleApprove = async (v: ReviewVideo) => {
    try {
      await apiFetch(`/api/admin/review/${v.id}/approve`, { method: 'POST' });
      await resolveVideoCorrections(v.id, 'dismissed').catch(() => {});
      setVideos((vs) => vs.filter((x) => x.id !== v.id));
    } catch (e) {
      setMsg(`エラー: ${String(e)}`);
    }
  };

  const handleReject = async (v: ReviewVideo) => {
    try {
      await apiFetch(`/api/admin/review/${v.id}/reject`, { method: 'POST' });
      await resolveVideoCorrections(v.id, 'dismissed').catch(() => {});
      setVideos((vs) => vs.filter((x) => x.id !== v.id));
    } catch (e) {
      setMsg(`エラー: ${String(e)}`);
    }
  };

  return (
    <div className="animate-in space-y-5">
      {/* ── Header ──────────────────────────────── */}
      <header className="flex items-end justify-between pb-3 border-b border-line">
        <div>
          <div className="page-eyebrow">// MODULE</div>
          <h2 className="page-title">レビュー待ち</h2>
        </div>
        <span
          className="text-dim"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}
        >
          {total} pending
        </span>
      </header>

      {/* ── Message ─────────────────────────────── */}
      {msg && (
        <div className="panel p-3" style={{ borderColor: '#45D48344' }}>
          <span
            className="text-ok"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
          >
            {msg}
          </span>
        </div>
      )}

      {/* ── Content ─────────────────────────────── */}
      {loading ? (
        <p
          className="text-dim"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
        >
          <span
            className="live-dot text-accent"
            style={{ display: 'inline-block', marginRight: '0.5em' }}
          />
          LOADING...
        </p>
      ) : videos.length === 0 ? (
        <div className="panel p-10 text-center">
          <div
            className="text-ok"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.85rem',
              letterSpacing: '0.1em',
            }}
          >
            // NO PENDING REVIEWS
          </div>
          <div
            className="text-faint"
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem',
              marginTop: '0.5rem',
            }}
          >
            all items reviewed
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((v) => (
            <div key={v.id} className="panel p-4 flex gap-4">
              {/* Thumbnail */}
              <img
                src={v.thumbnailUrl}
                alt=""
                style={{
                  width: '8rem',
                  height: '5rem',
                  objectFit: 'cover',
                  flexShrink: 0,
                  display: 'block',
                }}
                loading="lazy"
              />

              {/* Main content */}
              <div className="flex-1 min-w-0 space-y-2">
                <a
                  href={`https://youtube.com/watch?v=${v.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-info"
                  style={{
                    fontWeight: 600,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontSize: '0.88rem',
                    textDecoration: 'none',
                    transition: 'color 0.12s',
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#FF4655')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = '#4A9EFF')}
                >
                  {v.title}
                </a>
                <p
                  className="text-dim"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.68rem' }}
                >
                  {v.channelTitle}
                </p>

                {/* LLM reasoning */}
                {v.llmReasoning && (
                  <details style={{ fontSize: '0.75rem' }}>
                    <summary
                      className="text-faint cursor-pointer"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.68rem',
                        letterSpacing: '0.08em',
                      }}
                    >
                      // LLM 推論を表示
                    </summary>
                    <pre
                      className="panel-raised"
                      style={{
                        marginTop: '0.4rem',
                        padding: '0.6rem',
                        fontSize: '0.68rem',
                        fontFamily: 'JetBrains Mono, monospace',
                        color: '#888896',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        overflowX: 'auto',
                      }}
                    >
                      {JSON.stringify(JSON.parse(v.llmReasoning), null, 2)}
                    </pre>
                  </details>
                )}

                {/* User correction requests */}
                {(v._corrections ?? []).length > 0 && (
                  <div
                    style={{
                      border: '1px solid rgba(255,198,0,0.25)',
                      background: 'rgba(255,198,0,0.04)',
                      padding: '0.5rem 0.7rem',
                      marginTop: '0.25rem',
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.6rem',
                        letterSpacing: '0.12em',
                        color: '#F5C842',
                        marginBottom: '0.4rem',
                      }}
                    >
                      ⚑ タグ修正依頼 {v._corrections!.length}件
                    </div>
                    {v._corrections!.map((cr) => (
                      <div
                        key={cr.id}
                        style={{
                          marginBottom: '0.35rem',
                          fontSize: '0.72rem',
                          fontFamily: 'JetBrains Mono, monospace',
                        }}
                      >
                        <span style={{ color: '#888' }}>提案: </span>
                        {cr.suggestedMap && (
                          <span style={{ color: '#e8eaf0' }}>
                            map=<strong>{cr.suggestedMap}</strong>{' '}
                          </span>
                        )}
                        {cr.suggestedAgent && (
                          <span style={{ color: '#e8eaf0' }}>
                            agent=<strong>{cr.suggestedAgent}</strong>{' '}
                          </span>
                        )}
                        {cr.suggestedRank && (
                          <span style={{ color: '#e8eaf0' }}>
                            rank=<strong>{cr.suggestedRank}</strong>{' '}
                          </span>
                        )}
                        {cr.note && (
                          <span style={{ color: '#666', display: 'block', marginTop: '0.15rem' }}>
                            「{cr.note}」
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Edit fields */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {/* MAP — 背景画像グリッド */}
                  <div>
                    <span
                      className="text-faint"
                      style={{
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.6rem',
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        display: 'block',
                        marginBottom: '0.25rem',
                      }}
                    >
                      map
                    </span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                      {MAPS.map((m) => {
                        const selected = (v._editing?.map ?? '') === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setField(v.id, 'map', selected ? '' : m)}
                            style={{
                              position: 'relative',
                              width: '60px',
                              height: '32px',
                              backgroundImage: `url(${MAP_ICONS[m]})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              border: selected
                                ? '2px solid #4A9EFF'
                                : '2px solid rgba(255,255,255,0.06)',
                              cursor: 'pointer',
                              overflow: 'hidden',
                              padding: 0,
                              transition: 'border-color 0.12s, filter 0.12s, box-shadow 0.12s',
                              filter: selected ? 'none' : 'grayscale(40%) brightness(0.6)',
                              boxShadow: selected
                                ? '0 0 0 1px rgba(74,158,255,0.4), 0 2px 10px rgba(74,158,255,0.3)'
                                : 'none',
                            }}
                          >
                            <div
                              style={{
                                position: 'absolute',
                                inset: 0,
                                background: selected
                                  ? 'rgba(74,158,255,0.15)'
                                  : 'rgba(9,14,20,0.55)',
                                transition: 'background 0.12s',
                              }}
                            />
                            <span
                              style={{
                                position: 'relative',
                                fontFamily: 'JetBrains Mono, monospace',
                                fontSize: '0.5rem',
                                letterSpacing: '0.02em',
                                color: selected ? '#fff' : 'rgba(255,255,255,0.45)',
                                fontWeight: selected ? 700 : 400,
                                textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                                lineHeight: 1,
                              }}
                            >
                              {m}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* AGENT + RANK — アイコン付きドロップダウン */}
                  <div className="flex gap-2 flex-wrap">
                    {/* biome-ignore lint/a11y/noLabelWithoutControl: IconSelect renders a select */}
                    <label className="flex flex-col gap-0.5">
                      <span
                        className="text-faint"
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.6rem',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        agent
                      </span>
                      <IconSelect
                        value={v._editing?.agent ?? ''}
                        options={AGENTS}
                        icons={AGENT_ICONS}
                        iconSize={16}
                        iconClip="polygon(22% 0%, 78% 0%, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0% 78%, 0% 22%)"
                        onChange={(val) => setField(v.id, 'agent', val)}
                      />
                    </label>
                    {/* biome-ignore lint/a11y/noLabelWithoutControl: IconSelect renders a select */}
                    <label className="flex flex-col gap-0.5">
                      <span
                        className="text-faint"
                        style={{
                          fontFamily: 'JetBrains Mono, monospace',
                          fontSize: '0.6rem',
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                        }}
                      >
                        rank
                      </span>
                      <IconSelect
                        value={v._editing?.rank ?? ''}
                        options={RANKS}
                        icons={RANK_ICONS}
                        iconSize={14}
                        onChange={(val) => setField(v.id, 'rank', val)}
                      />
                    </label>
                  </div>
                </div>

                {/* Confidence indicators */}
                <div
                  className="flex gap-4"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.65rem',
                    color: '#444450',
                  }}
                >
                  <span>
                    map: {(v.mapConfidence * 100).toFixed(0)}%{' '}
                    <span style={{ color: '#222228' }}>({v.mapSource})</span>
                  </span>
                  <span>
                    agent: {(v.agentConfidence * 100).toFixed(0)}%{' '}
                    <span style={{ color: '#222228' }}>({v.agentSource})</span>
                  </span>
                  <span>
                    rank: {(v.rankConfidence * 100).toFixed(0)}%{' '}
                    <span style={{ color: '#222228' }}>({v.rankSource})</span>
                  </span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2 shrink-0 justify-start">
                <button
                  type="button"
                  onClick={() => handleCorrect(v)}
                  className="btn btn-info"
                  style={{ fontSize: '0.75rem', padding: '0.35em 0.9em' }}
                >
                  修正して承認
                </button>
                <button
                  type="button"
                  onClick={() => handleApprove(v)}
                  className="btn btn-ok"
                  style={{ fontSize: '0.75rem', padding: '0.35em 0.9em' }}
                >
                  そのまま承認
                </button>
                <button
                  type="button"
                  onClick={() => handleReject(v)}
                  className="btn btn-danger"
                  style={{ fontSize: '0.75rem', padding: '0.35em 0.9em' }}
                >
                  非表示にする
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Pagination ──────────────────────────── */}
      {total > 20 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="btn btn-ghost"
          >
            ← PREV
          </button>
          <span
            className="text-dim"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
          >
            p.{page}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={videos.length < 20}
            className="btn btn-ghost"
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
