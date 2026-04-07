import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  apiFetch,
  type StatsResponse,
  type TagPendingVideoRow,
  type TagSingleResult,
} from '../lib/api.ts';

interface TagLog {
  type: 'tagged' | 'failed' | 'rate_limited' | 'done' | 'stopped';
  videoId?: string;
  title?: string;
  map?: string | null;
  agent?: string | null;
  rank?: string | null;
  message?: string;
  processed?: number;
  success?: number;
  failed?: number;
}

const RATE_LIMIT_WAIT_SEC = 60;

export default function TagPage() {
  const [provider, setProvider] = useState<'gemma' | 'gemini' | 'anthropic'>('gemma');
  const [dryRun, setDryRun] = useState(false);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<TagLog[]>([]);
  const [total, setTotal] = useState(0);
  const [current, setCurrent] = useState(0);
  const [countdown, setCountdown] = useState(0);
  const [resetMsg, setResetMsg] = useState('');
  const stoppedRef = useRef(false);
  const logRef = useRef<HTMLDivElement>(null);

  const addLog = useCallback((log: TagLog) => {
    setLogs((prev) => [...prev, log]);
  }, []);

  const fetchStats = useCallback(() => {
    apiFetch<StatsResponse>('/api/admin/videos/stats').then(setStats).catch(console.error);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: ログ追記時に末尾スクロール
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const handleStart = async () => {
    stoppedRef.current = false;
    setRunning(true);
    setLogs([]);
    setCurrent(0);
    setTotal(0);
    setCountdown(0);

    try {
      const { videos: pending } = await apiFetch<{ count: number; videos: TagPendingVideoRow[] }>(
        '/api/admin/tag/pending?maxCount=500',
      );

      if (pending.length === 0) {
        addLog({ type: 'done', processed: 0, success: 0, failed: 0 });
        return;
      }

      setTotal(pending.length);
      let successCount = 0;
      let failCount = 0;

      for (let i = 0; i < pending.length; i++) {
        if (stoppedRef.current) {
          addLog({ type: 'stopped', message: `${i} 件処理済みで停止しました` });
          break;
        }

        const video = pending[i]!;
        setCurrent(i + 1);

        let attempt = 0;
        let done = false;

        while (!done && attempt <= 3) {
          try {
            const result = await apiFetch<TagSingleResult>(`/api/admin/tag/video/${video.id}`, {
              method: 'POST',
              body: JSON.stringify({ provider, dryRun }),
            });

            if (result.status === 'tagged') {
              successCount++;
              addLog({
                type: 'tagged',
                videoId: video.id,
                title: video.title,
                map: result.map,
                agent: result.agent,
                rank: result.rank,
              });
            } else {
              failCount++;
              addLog({
                type: 'failed',
                videoId: video.id,
                title: video.title,
                message: result.failReason,
              });
            }
            done = true;
          } catch (err) {
            const isRateLimit =
              (err instanceof ApiError && err.status === 429) ||
              (err instanceof Error &&
                (err.message.includes('429') || err.message.includes('rate_limited')));

            if (isRateLimit && attempt < 3 && !stoppedRef.current) {
              attempt++;
              addLog({
                type: 'rate_limited',
                message: `レート制限。${RATE_LIMIT_WAIT_SEC}秒後にリトライ (${attempt}/3)`,
              });
              for (let s = RATE_LIMIT_WAIT_SEC; s > 0; s--) {
                if (stoppedRef.current) break;
                setCountdown(s);
                await new Promise((r) => setTimeout(r, 1000));
              }
              setCountdown(0);
            } else {
              failCount++;
              addLog({
                type: 'failed',
                videoId: video.id,
                title: video.title,
                message: err instanceof Error ? err.message.slice(0, 120) : String(err),
              });
              done = true;
            }
          }
        }
      }

      if (!stoppedRef.current) {
        addLog({
          type: 'done',
          processed: pending.length,
          success: successCount,
          failed: failCount,
        });
      }
    } catch (err) {
      addLog({ type: 'failed', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setRunning(false);
      setCountdown(0);
      fetchStats();
    }
  };

  const handleStop = () => {
    stoppedRef.current = true;
  };

  const handleReset = async () => {
    setResetMsg('');
    try {
      const res = await apiFetch<{ status: string; count: number }>('/api/admin/tag/reset', {
        method: 'POST',
        body: JSON.stringify({ statuses: ['complete', 'skipped', 'failed'] }),
      });
      setResetMsg(`リセット完了: ${res.count} 件を pending に戻しました`);
      fetchStats();
    } catch (e) {
      setResetMsg(`エラー: ${String(e)}`);
    }
  };

  const progressPct = total > 0 ? Math.round((current / total) * 100) : 0;

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
            <div
              className="stat-num"
              style={{ color: stats.byStatus.failed > 0 ? '#FF4655' : undefined }}
            >
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
        <div className="section-label">一括タグ付け — LLM Vision</div>
        <div className="flex gap-5 items-center flex-wrap">
          <label className="flex items-center gap-2 text-dim" style={{ fontSize: '0.85rem' }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.72rem',
                letterSpacing: '0.08em',
              }}
            >
              MODEL
            </span>
            <select
              className="field"
              value={provider}
              onChange={(e) => setProvider(e.target.value as typeof provider)}
            >
              <option value="gemma">Gemma (推奨)</option>
              <option value="gemini">Gemini</option>
              <option value="anthropic">Anthropic</option>
            </select>
          </label>
          <label
            className="flex items-center gap-2 text-dim cursor-pointer"
            style={{ fontSize: '0.85rem' }}
          >
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              style={{ accentColor: '#FF4655' }}
            />
            <span>ドライラン（DB更新しない）</span>
          </label>
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={handleStart} disabled={running} className="btn btn-accent">
            {running ? (
              <>
                <span className="live-dot" style={{ marginRight: '0.4em' }} />
                タグ付け中...
              </>
            ) : (
              '▶ タグ付け開始'
            )}
          </button>
          {running && (
            <button type="button" onClick={handleStop} className="btn btn-danger">
              ■ 停止
            </button>
          )}
        </div>
      </div>

      {/* ── Progress ────────────────────────────── */}
      {(running || logs.some((l) => l.type === 'done')) && total > 0 && (
        <div className="panel p-4 space-y-3">
          <div className="flex justify-between items-center">
            <span
              className="text-dim"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
            >
              {countdown > 0 ? `レート制限 — ${countdown}s 待機中...` : `${current} / ${total}`}
            </span>
            <span
              className="text-accent font-bold"
              style={{ fontFamily: 'Rajdhani, sans-serif', fontSize: '1.1rem' }}
            >
              {progressPct}%
            </span>
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${progressPct}%`,
                background: countdown > 0 ? '#FFB84A' : undefined,
              }}
            />
          </div>
        </div>
      )}

      {/* ── Log ─────────────────────────────────── */}
      {logs.length > 0 && (
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
            {logs.map((ev, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only log
              <TagLogLine key={i} event={ev} />
            ))}
          </div>
        </div>
      )}

      {/* ── Reset ───────────────────────────────── */}
      <div className="panel p-4 space-y-3">
        <div className="section-label">ステータスリセット</div>
        <p className="text-dim" style={{ fontSize: '0.82rem' }}>
          complete / skipped / failed を pending に戻します（再タグ付け用）。
        </p>
        <button type="button" onClick={handleReset} disabled={running} className="btn btn-danger">
          リセット実行
        </button>
        {resetMsg && (
          <p
            className="text-ok"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
          >
            {resetMsg}
          </p>
        )}
      </div>
    </div>
  );
}

function TagLogLine({ event }: { event: TagLog }) {
  switch (event.type) {
    case 'tagged':
      return (
        <p style={{ color: '#45D483' }}>
          ✔ {event.title} → map:{event.map ?? '—'} agent:{event.agent ?? '—'} rank:
          {event.rank ?? '—'}
        </p>
      );
    case 'failed':
      return (
        <p style={{ color: '#FF4655' }}>
          ✘ {event.title ?? event.videoId}: {event.message}
        </p>
      );
    case 'rate_limited':
      return <p style={{ color: '#FFB84A' }}>⚠ {event.message}</p>;
    case 'done':
      return (
        <p style={{ color: '#FFB84A' }}>
          ✔ 完了 処理:{event.processed} 成功:{event.success} 失敗:{event.failed}
        </p>
      );
    case 'stopped':
      return <p style={{ color: '#888896' }}>■ {event.message}</p>;
    default:
      return <p style={{ color: '#888896' }}>{JSON.stringify(event)}</p>;
  }
}
