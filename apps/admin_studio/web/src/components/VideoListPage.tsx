import { type CSSProperties, useCallback, useEffect, useState } from 'react';
import { apiFetch, type StatsResponse, type Video, type VideoListResponse } from '../lib/api.ts';
import { AGENTS, MAPS, RANKS } from '../lib/valorant.ts';

const STATUSES = ['pending', 'in_progress', 'complete', 'skipped', 'failed'];

interface Filters {
  map: string;
  agent: string;
  rank: string;
  status: string;
  review: string;
  channel: string;
  q: string;
  coachingType: string;
}

const INIT_FILTERS: Filters = {
  map: '',
  agent: '',
  rank: '',
  status: '',
  review: '',
  channel: '',
  q: '',
  coachingType: '',
};

interface EditableVideo extends Video {
  _editing: { map: string; agent: string; rank: string; coachingType: string };
}

function toEditable(v: Video): EditableVideo {
  return {
    ...v,
    _editing: {
      map: v.map ?? '',
      agent: v.agent ?? '',
      rank: v.rank ?? '',
      coachingType: v.coachingType ?? 'individual',
    },
  };
}

export default function VideoListPage() {
  const [filters, setFilters] = useState<Filters>(INIT_FILTERS);
  const [applied, setApplied] = useState<Filters>(INIT_FILTERS);
  const [videos, setVideos] = useState<EditableVideo[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchStats = useCallback(() => {
    apiFetch<StatsResponse>('/api/admin/videos/stats').then(setStats).catch(console.error);
  }, []);

  const fetchChannels = useCallback(() => {
    apiFetch<string[]>('/api/admin/videos/channels').then(setChannels).catch(console.error);
  }, []);

  const fetchVideos = useCallback(async (f: Filters, p: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (f.map) params.set('map', f.map);
      if (f.agent) params.set('agent', f.agent);
      if (f.rank) params.set('rank', f.rank);
      if (f.status) params.set('status', f.status);
      if (f.review) params.set('review', f.review);
      if (f.channel) params.set('coach', f.channel);
      if (f.q) params.set('q', f.q);
      if (f.coachingType) params.set('coachingType', f.coachingType);
      const res = await apiFetch<VideoListResponse>(`/api/admin/videos?${params}`);
      setVideos(res.videos.map(toEditable));
      setTotal(res.total);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchChannels();
  }, [fetchStats, fetchChannels]);
  useEffect(() => {
    fetchVideos(applied, page);
  }, [fetchVideos, applied, page]);

  const handleSearch = () => {
    setPage(1);
    setApplied(filters);
  };
  const handleReset = () => {
    setFilters(INIT_FILTERS);
    setPage(1);
    setApplied(INIT_FILTERS);
  };

  const setField = (
    id: string,
    field: 'map' | 'agent' | 'rank' | 'coachingType',
    value: string,
  ) => {
    setVideos((vs) =>
      vs.map((v) => (v.id === id ? { ...v, _editing: { ...v._editing, [field]: value } } : v)),
    );
  };

  const handleSave = async (v: EditableVideo) => {
    setMsg('');
    try {
      await apiFetch(`/api/admin/review/${v.id}/correct`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          map: v._editing.map || null,
          agent: v._editing.agent || null,
          rank: v._editing.rank || null,
          coachingType: v._editing.coachingType || 'individual',
        }),
      });
      setMsg(`✔ ${v.title} — 保存しました`);
      setVideos((vs) =>
        vs.map((x) =>
          x.id === v.id
            ? {
                ...x,
                map: v._editing.map || null,
                agent: v._editing.agent || null,
                rank: v._editing.rank || null,
                coachingType: v._editing.coachingType,
              }
            : x,
        ),
      );
    } catch (e) {
      setMsg(`エラー: ${String(e)}`);
    }
  };

  const handleToggleHide = async (v: EditableVideo) => {
    const hidden = v.isValorantCoaching === 0;
    try {
      await apiFetch(`/api/admin/review/${v.id}/${hidden ? 'restore' : 'reject'}`, {
        method: 'POST',
      });
      setVideos((vs) =>
        vs.map((x) => (x.id === v.id ? { ...x, isValorantCoaching: hidden ? 1 : 0 } : x)),
      );
    } catch (e) {
      setMsg(`エラー: ${String(e)}`);
    }
  };

  const totalPages = Math.ceil(total / 50);

  return (
    <div className="animate-in space-y-5">
      {/* ── Header ──────────────────────────────── */}
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
      <header className="flex items-end justify-between pb-3 border-b border-line">
        <div>
          <div className="page-eyebrow">// MODULE</div>
          <h2 className="page-title">動画一覧</h2>
        </div>
        <span
          className="text-dim"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}
        >
          {total.toLocaleString()} entries
        </span>
      </header>

      {/* ── Stat cards ──────────────────────────── */}
      {stats && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
          {[
            { label: 'TOTAL', val: stats.total, accent: '#FF4655', alert: false },
            { label: 'PENDING', val: stats.byStatus.pending, accent: '#FFB84A', alert: false },
            { label: 'COMPLETE', val: stats.byStatus.complete, accent: '#45D483', alert: false },
            { label: 'SKIPPED', val: stats.byStatus.skipped, accent: '#888896', alert: false },
            { label: 'FAILED', val: stats.byStatus.failed, accent: '#FF4655', alert: true },
            { label: 'REVIEW', val: stats.reviewNeeded, accent: '#4A9EFF', alert: false },
          ].map((s) => (
            <div
              key={s.label}
              className="stat-card"
              style={{ '--stat-accent': s.accent } as CSSProperties}
            >
              <div
                className="stat-num"
                style={{ color: s.alert && s.val > 0 ? '#FF4655' : '#C8C8D0' }}
              >
                {s.val.toLocaleString()}
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Filters ─────────────────────────────── */}
      <div className="panel p-3">
        <div className="section-label">フィルター</div>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            className="field"
            style={{ width: '10rem' }}
            placeholder="タイトル検索"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          <select
            className="field"
            style={{ width: '6.5rem' }}
            value={filters.map}
            onChange={(e) => setFilters((f) => ({ ...f, map: e.target.value }))}
          >
            <option value="">全 Map</option>
            {MAPS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <select
            className="field"
            style={{ width: '6.5rem' }}
            value={filters.agent}
            onChange={(e) => setFilters((f) => ({ ...f, agent: e.target.value }))}
          >
            <option value="">全 Agent</option>
            {AGENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <select
            className="field"
            style={{ width: '6.5rem' }}
            value={filters.rank}
            onChange={(e) => setFilters((f) => ({ ...f, rank: e.target.value }))}
          >
            <option value="">全 Rank</option>
            {RANKS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="">全 Status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={filters.review}
            onChange={(e) => setFilters((f) => ({ ...f, review: e.target.value }))}
          >
            <option value="">全 Review</option>
            <option value="1">要レビュー</option>
            <option value="0">OK</option>
          </select>
          <select
            className="field"
            style={{ maxWidth: '12rem' }}
            value={filters.channel}
            onChange={(e) => setFilters((f) => ({ ...f, channel: e.target.value }))}
          >
            <option value="">全 Channel</option>
            {channels.map((ch) => (
              <option key={ch} value={ch}>
                {ch}
              </option>
            ))}
          </select>
          <select
            className="field"
            value={filters.coachingType}
            onChange={(e) => setFilters((f) => ({ ...f, coachingType: e.target.value }))}
          >
            <option value="">全 Type</option>
            <option value="individual">Individual</option>
            <option value="team">Team</option>
          </select>
          <button type="button" onClick={handleSearch} className="btn btn-accent">
            検索
          </button>
          <button type="button" onClick={handleReset} className="btn btn-ghost">
            リセット
          </button>
        </div>
      </div>

      {/* ── Table ───────────────────────────────── */}
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              {[
                'Thumb',
                'Title',
                'Channel',
                'Map',
                'Agent',
                'Rank',
                'Type',
                'Status',
                'Review',
                'Actions',
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={10}
                  className="text-center py-10 text-dim"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.75rem',
                    letterSpacing: '0.1em',
                  }}
                >
                  <span
                    className="live-dot text-accent"
                    style={{ display: 'inline-block', marginRight: '0.5em' }}
                  />
                  LOADING...
                </td>
              </tr>
            ) : videos.length === 0 ? (
              <tr>
                <td
                  colSpan={10}
                  className="text-center py-10 text-faint"
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: '0.75rem',
                    letterSpacing: '0.1em',
                  }}
                >
                  NO RESULTS
                </td>
              </tr>
            ) : (
              videos.map((v) => (
                <tr key={v.id} style={{ opacity: v.isValorantCoaching === 0 ? 0.45 : 1 }}>
                  <td style={{ width: '9rem', padding: '0.5rem' }}>
                    <img
                      src={v.thumbnailUrl}
                      alt=""
                      style={{
                        width: '8rem',
                        height: '4.5rem',
                        objectFit: 'cover',
                        display: 'block',
                      }}
                      loading="lazy"
                    />
                  </td>
                  <td style={{ maxWidth: '18rem' }}>
                    <a
                      href={`https://youtube.com/watch?v=${v.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-info"
                      style={{
                        fontSize: '0.82rem',
                        fontWeight: 600,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        transition: 'color 0.12s',
                        textDecoration: 'none',
                      }}
                      onMouseEnter={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = '#FF4655')
                      }
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.color = '#4A9EFF')
                      }
                    >
                      {v.title}
                    </a>
                  </td>
                  <td
                    className="text-dim"
                    style={{
                      fontFamily: 'JetBrains Mono, monospace',
                      fontSize: '0.68rem',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.channelTitle}
                  </td>
                  <td>
                    <select
                      className="field"
                      style={{ width: '6rem', fontSize: '0.72rem' }}
                      value={v._editing.map}
                      onChange={(e) => setField(v.id, 'map', e.target.value)}
                    >
                      <option value="">—</option>
                      {MAPS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="field"
                      style={{ width: '6rem', fontSize: '0.72rem' }}
                      value={v._editing.agent}
                      onChange={(e) => setField(v.id, 'agent', e.target.value)}
                    >
                      <option value="">—</option>
                      {AGENTS.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="field"
                      style={{ width: '6rem', fontSize: '0.72rem' }}
                      value={v._editing.rank}
                      onChange={(e) => setField(v.id, 'rank', e.target.value)}
                    >
                      <option value="">—</option>
                      {RANKS.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>
                    <select
                      className="field"
                      style={{ width: '6.5rem', fontSize: '0.72rem' }}
                      value={v._editing.coachingType}
                      onChange={(e) => setField(v.id, 'coachingType', e.target.value)}
                    >
                      <option value="individual">Individual</option>
                      <option value="team">Team</option>
                    </select>
                  </td>
                  <td>
                    <span className={`badge badge-${v.aiTaggingStatus}`}>{v.aiTaggingStatus}</span>
                  </td>
                  <td>
                    {v.reviewNeeded ? (
                      <span className="badge badge-pending">要確認</span>
                    ) : (
                      <span className="text-faint" style={{ fontSize: '0.7rem' }}>
                        —
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => handleSave(v)}
                        className="btn btn-info"
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.25em 0.6em',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        保存
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleHide(v)}
                        className="btn btn-danger"
                        style={{
                          fontSize: '0.68rem',
                          padding: '0.25em 0.6em',
                          whiteSpace: 'nowrap',
                          opacity: v.isValorantCoaching === 0 ? 1 : 0.7,
                        }}
                      >
                        {v.isValorantCoaching === 0 ? '表示に戻す' : '非表示'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────── */}
      {totalPages > 1 && (
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
            {page} / {totalPages} &nbsp;·&nbsp; {total.toLocaleString()} items
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="btn btn-ghost"
          >
            NEXT →
          </button>
        </div>
      )}
    </div>
  );
}
