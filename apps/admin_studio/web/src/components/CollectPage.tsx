import { useEffect, useRef, useState } from 'react';
import { apiFetch, type Channel } from '../lib/api.ts';
import { useSSE } from '../lib/useSSE.ts';

interface CollectEvent {
  type: string;
  channelId?: string;
  videoId?: string;
  title?: string;
  aiTaggingStatus?: string;
  fetched?: number;
  coaching?: number;
  filtered?: number;
  total?: number;
  message?: string;
}

export default function CollectPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [channelId, setChannelId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [maxResults, setMaxResults] = useState(20);
  const { logs, running, error, start } = useSSE<CollectEvent>();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    apiFetch<{ channels: Channel[] }>('/api/collect/channels')
      .then((r) => setChannels(r.channels))
      .catch(console.error);
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: logsが更新されるたびに末尾へスクロール
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const collectAll = () => start('/api/collect/all', { maxPerChannel: 9999 });
  const collectOne = () => {
    if (channelId.trim()) start(`/api/collect/channel/${channelId.trim()}`, { maxResults: 9999 });
  };
  const collectSearch = () => {
    if (searchQuery.trim()) start('/api/collect/search', { query: searchQuery.trim(), maxResults });
  };

  const realChannels = channels.filter((c) => !c.placeholder);

  return (
    <div className="animate-in space-y-5">
      {/* ── Header ──────────────────────────────── */}
      <header className="flex items-end justify-between pb-3 border-b border-line">
        <div>
          <div className="page-eyebrow">// MODULE</div>
          <h2 className="page-title">動画収集</h2>
        </div>
        <span
          className="text-dim"
          style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}
        >
          {realChannels.length} channels registered
        </span>
      </header>

      {/* ── Registered channels ─────────────────── */}
      <div className="panel p-4">
        <div className="section-label">登録チャンネル</div>
        {channels.length === 0 ? (
          <p
            className="text-dim"
            style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}
          >
            <span
              className="live-dot text-accent"
              style={{ display: 'inline-block', marginRight: '0.5em' }}
            />
            Loading...
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {channels.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`channel-chip${c.placeholder ? ' placeholder' : ''}`}
                onClick={() => {
                  if (!c.placeholder) setChannelId(c.id);
                }}
              >
                {c.placeholder ? c.id : `${c.id.slice(0, 12)}…`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Action panels ───────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        {/* All channels */}
        <div className="panel p-4 space-y-3">
          <div className="section-label">全チャンネル収集</div>
          <p className="text-dim" style={{ fontSize: '0.8rem' }}>
            登録済み全チャンネルの動画をDBに追加します。
          </p>
          <button
            type="button"
            onClick={collectAll}
            disabled={running}
            className="btn btn-accent w-full"
            style={{ justifyContent: 'center' }}
          >
            {running ? (
              <>
                <span className="live-dot" style={{ marginRight: '0.4em' }} />
                収集中...
              </>
            ) : (
              '▶ 全チャンネル収集'
            )}
          </button>
        </div>

        {/* Single channel */}
        <div className="panel p-4 space-y-3">
          <div className="section-label">単チャンネル収集</div>
          <input
            className="field w-full"
            placeholder="Channel ID"
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
          />
          <button
            type="button"
            onClick={collectOne}
            disabled={running || !channelId.trim()}
            className="btn btn-ghost w-full"
            style={{ justifyContent: 'center' }}
          >
            {running ? (
              <>
                <span className="live-dot" style={{ marginRight: '0.4em' }} />
                収集中...
              </>
            ) : (
              '▶ 収集'
            )}
          </button>
        </div>

        {/* Search */}
        <div className="panel p-4 space-y-3">
          <div className="section-label">キーワード検索収集</div>
          <input
            className="field w-full"
            placeholder="検索クエリ"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && collectSearch()}
          />
          <div className="flex gap-2 items-center">
            <span
              className="text-faint"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}
            >
              MAX
            </span>
            <input
              type="number"
              min={1}
              max={200}
              className="field"
              style={{ width: '5rem' }}
              value={maxResults}
              onChange={(e) => setMaxResults(parseInt(e.target.value, 10) || 20)}
            />
            <span
              className="text-faint"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.72rem' }}
            >
              件
            </span>
          </div>
          <button
            type="button"
            onClick={collectSearch}
            disabled={running || !searchQuery.trim()}
            className="btn btn-ghost w-full"
            style={{ justifyContent: 'center' }}
          >
            {running ? (
              <>
                <span className="live-dot" style={{ marginRight: '0.4em' }} />
                収集中...
              </>
            ) : (
              '▶ 検索して収集'
            )}
          </button>
        </div>
      </div>

      {/* ── SSE Log ─────────────────────────────── */}
      {(logs.length > 0 || running || error) && (
        <div className="terminal">
          <div className="terminal-header">
            <span>// COLLECT LOG</span>
            {running && (
              <span className="text-ok flex items-center gap-1.5">
                <span className="live-dot" />
                RUNNING
              </span>
            )}
          </div>
          <div ref={logRef} className="terminal-body" style={{ height: '20rem' }}>
            {error && <p style={{ color: '#FF4655' }}>ERROR: {error}</p>}
            {logs.map((ev, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: 追記専用ログのためインデックスで安全
              <LogLine key={i} event={ev} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LogLine({ event }: { event: CollectEvent }) {
  const colors: Record<string, string> = {
    channel_start: '#4A9EFF',
    channel_done: '#45D483',
    video_collected: '#C8C8D0',
    video_filtered: '#444450',
    done: '#FFB84A',
    error: '#FF4655',
  };
  const color = colors[event.type] ?? '#888896';

  let text = '';
  switch (event.type) {
    case 'channel_start':
      text = `[${event.channelId}] 収集開始${event.message ? ` — ${event.message}` : ''}`;
      break;
    case 'channel_done':
      text = `[${event.channelId}] 完了 取得:${event.fetched} コーチング:${event.coaching} フィルタ:${event.filtered}`;
      break;
    case 'video_collected':
      text = `  + ${event.title} (${event.aiTaggingStatus})`;
      break;
    case 'video_filtered':
      text = `  - ${event.title}`;
      break;
    case 'done':
      text = `✔ 収集完了 合計: ${event.total} 件`;
      break;
    case 'error':
      text = `✘ エラー: ${event.message}`;
      break;
    default:
      text = JSON.stringify(event);
  }

  return <p style={{ color }}>{text}</p>;
}
