import { useState, useEffect, useRef, type CSSProperties } from 'react';
import { apiFetch, type StatsResponse } from '../lib/api.ts';
import { useSSE } from '../lib/useSSE.ts';

interface TagEvent {
  type:       string;
  current?:   number;
  total?:     number;
  videoId?:   string;
  title?:     string;
  map?:       string | null;
  agent?:     string | null;
  rank?:      string | null;
  message?:   string;
  processed?: number;
  success?:   number;
  failed?:    number;
}

export default function TagPage() {
  const [maxCount, setMaxCount] = useState(500);
  const [dryRun, setDryRun]     = useState(false);
  const [stats, setStats]       = useState<StatsResponse | null>(null);
  const [resetMsg, setResetMsg] = useState('');
  const { logs, running, error, start } = useSSE<TagEvent>();
  const logRef = useRef<HTMLDivElement>(null);

  const fetchStats = () => {
    apiFetch<StatsResponse>('/api/videos/stats').then(setStats).catch(console.error);
  };

  useEffect(() => { fetchStats(); }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleStart = () => {
    start('/api/tag/batch', { maxCount, dryRun });
  };

  const handleReset = async () => {
    setResetMsg('');
    try {
      const res = await apiFetch<{ status: string; count: number }>('/api/tag/reset', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ statuses: ['complete', 'skipped', 'failed'] }),
      });
      setResetMsg(`リセット完了: ${res.count} 件を pending に戻しました`);
      fetchStats();
    } catch (e) {
      setResetMsg(`エラー: ${String(e)}`);
    }
  };

  // Progress from logs
  const startEvent  = logs.find(l => l.type === 'start');
  const latestProg  = [...logs].reverse().find(l => l.type === 'progress');
  const doneEvent   = logs.find(l => l.type === 'done');
  const progressPct = startEvent?.total && latestProg?.current
    ? Math.round((latestProg.current / startEvent.total) * 100)
    : 0;

  return (
    <div className="animate-in space-y-5">
      {/* ── Header ──────────────────────────────── */}
      <header className="pb-3 border-b border-line">
        <div className="page-eyebrow">// MODULE</div>
        <h2 className="page-title">タグ付け処理</h2>
      </header>

      {/* ── Stat cards ──────────────────────────── */}
      {stats && (
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card" style={{ '--stat-accent': '#FFB84A' } as CSSProperties}>
            <div className="stat-num">{stats.byStatus.pending.toLocaleString()}</div>
            <div className="stat-label">PENDING</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': '#FF4655' } as CSSProperties}>
            <div className="stat-num" style={{ color: stats.byStatus.failed > 0 ? '#FF4655' : undefined }}>
              {stats.byStatus.failed.toLocaleString()}
            </div>
            <div className="stat-label">FAILED</div>
          </div>
          <div className="stat-card" style={{ '--stat-accent': '#45D483' } as CSSProperties}>
            <div className="stat-num" style={{ color: '#45D483' }}>
              {stats.byStatus.complete.toLocaleString()}
            </div>
            <div className="stat-label">COMPLETE</div>
          </div>
        </div>
      )}

      {/* ── Controls ────────────────────────────── */}
      <div className="panel p-4 space-y-4">
        <div className="section-label">一括タグ付け — Gemini Vision</div>
        <div className="flex gap-5 items-center flex-wrap">
          <label className="flex items-center gap-2 text-dim" style={{ fontSize: '0.85rem' }}>
            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem', letterSpacing: '0.08em' }}>MAX</span>
            <input
              type="number" min={1} max={9999}
              className="field"
              style={{ width: '6rem' }}
              value={maxCount}
              onChange={e => setMaxCount(parseInt(e.target.value) || 500)}
            />
          </label>
          <label className="flex items-center gap-2 text-dim cursor-pointer" style={{ fontSize: '0.85rem' }}>
            <input
              type="checkbox"
              checked={dryRun}
              onChange={e => setDryRun(e.target.checked)}
              style={{ accentColor: '#FF4655' }}
            />
            <span>ドライラン（DB更新しない）</span>
          </label>
        </div>
        <button onClick={handleStart} disabled={running} className="btn btn-accent">
          {running
            ? <><span className="live-dot" style={{ marginRight: '0.4em' }} />タグ付け中...</>
            : '▶ タグ付け開始'}
        </button>
      </div>

      {/* ── Progress bar ────────────────────────── */}
      {(running || doneEvent) && startEvent?.total && (
        <div className="panel p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-dim" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
              {latestProg ? `${latestProg.current} / ${startEvent.total}` : '開始中...'}
            </span>
            <span className="text-accent font-bold" style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.1rem' }}>
              {progressPct}%
            </span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          {doneEvent && (
            <p className="text-ok" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
              ✔ 完了 — 処理: {doneEvent.processed}, 成功: {doneEvent.success}, 失敗: {doneEvent.failed}
            </p>
          )}
        </div>
      )}

      {/* ── SSE Log ─────────────────────────────── */}
      {(logs.length > 0 || error) && (
        <div className="terminal">
          <div className="terminal-header">
            <span>// TAG LOG</span>
            {running && (
              <span className="text-ok flex items-center gap-1.5">
                <span className="live-dot" />
                RUNNING
              </span>
            )}
          </div>
          <div ref={logRef} className="terminal-body" style={{ height: '18rem' }}>
            {error && <p style={{ color: '#FF4655' }}>ERROR: {error}</p>}
            {logs.map((ev, i) => <TagLogLine key={i} event={ev} />)}
          </div>
        </div>
      )}

      {/* ── Reset ───────────────────────────────── */}
      <div className="panel p-4 space-y-3">
        <div className="section-label">ステータスリセット</div>
        <p className="text-dim" style={{ fontSize: '0.82rem' }}>
          complete / skipped / failed を pending に戻します（再タグ付け用）。
        </p>
        <button onClick={handleReset} className="btn btn-danger">
          リセット実行
        </button>
        {resetMsg && (
          <p className="text-ok" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
            {resetMsg}
          </p>
        )}
      </div>
    </div>
  );
}

function TagLogLine({ event }: { event: TagEvent }) {
  switch (event.type) {
    case 'start':
      return <p style={{ color: '#4A9EFF' }}>▶ 開始 — 対象: {event.total} 件</p>;
    case 'progress':
      return <p style={{ color: '#444450' }}>[{event.current}/{event.total}] {event.title}</p>;
    case 'tagged':
      return <p style={{ color: '#45D483' }}>  ✔ {event.title} → map:{event.map} agent:{event.agent} rank:{event.rank}</p>;
    case 'failed':
      return <p style={{ color: '#FF4655' }}>  ✘ {event.title}: {event.message}</p>;
    case 'rate_limited':
      return <p style={{ color: '#FFB84A' }}>⚠ {event.message}</p>;
    case 'done':
      return <p style={{ color: '#FFB84A' }}>✔ 完了 処理:{event.processed} 成功:{event.success} 失敗:{event.failed}</p>;
    default:
      return <p style={{ color: '#888896' }}>{JSON.stringify(event)}</p>;
  }
}
