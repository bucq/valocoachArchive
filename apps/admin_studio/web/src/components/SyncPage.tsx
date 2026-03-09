import { useRef, useEffect } from 'react';
import { useSSE } from '../lib/useSSE.ts';

interface SyncEvent {
  type:    'step' | 'done' | 'error';
  message: string;
}

function SyncPanel({
  title, description, flowNodes, buttonLabel, endpoint,
}: {
  title:       string;
  description: string;
  flowNodes:   [string, string, string];
  buttonLabel: string;
  endpoint:    string;
}) {
  const { logs, running, error, start } = useSSE<SyncEvent>();
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  const isDone  = logs.some(l => l.type === 'done');
  const isError = logs.some(l => l.type === 'error') || !!error;

  return (
    <div className="panel p-5 space-y-4">
      <div className="section-label">{title}</div>
      <p className="text-dim" style={{ fontSize: '0.85rem', lineHeight: '1.6' }}>
        {description}
      </p>

      <div className="flex items-center gap-2 flex-wrap" style={{ padding: '0.75rem', background: '#0B0B0D', border: '1px solid #222228' }}>
        <span className="flow-node">{flowNodes[0]}</span>
        <span className="flow-arrow">→ export →</span>
        <span className="flow-node">{flowNodes[1]}</span>
        <span className="flow-arrow">→ execute →</span>
        <span className="flow-node highlight">{flowNodes[2]}</span>
      </div>

      <button onClick={() => start(endpoint, {})} disabled={running} className="btn btn-info">
        {running
          ? <><span className="live-dot" style={{ marginRight: '0.4em' }} />処理中...</>
          : buttonLabel}
      </button>

      {isDone  && (
        <p className="text-ok" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
          ✔ 完了
        </p>
      )}
      {isError && (
        <p style={{ color: '#FF4655', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
          ✘ エラーが発生しました
        </p>
      )}

      {(logs.length > 0 || running || error) && (
        <div className="terminal">
          <div className="terminal-header">
            <span>// LOG</span>
            {running && (
              <span className="text-info flex items-center gap-1.5">
                <span className="live-dot" />
                RUNNING
              </span>
            )}
          </div>
          <div ref={logRef} className="terminal-body" style={{ height: '10rem' }}>
            {error && <p style={{ color: '#FF4655' }}>ERROR: {error}</p>}
            {logs.map((ev, i) => (
              <p key={i} style={{
                color: ev.type === 'done'  ? '#45D483' :
                       ev.type === 'error' ? '#FF4655' :
                       '#C8C8D0',
              }}>
                {ev.type === 'done'  ? '✔ ' :
                 ev.type === 'error' ? '✘ ' :
                 '→ '}
                {ev.message}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SyncPage() {
  return (
    <div className="animate-in space-y-5">
      <header className="pb-3 border-b border-line">
        <div className="page-eyebrow">// MODULE</div>
        <h2 className="page-title">D1 同期</h2>
      </header>

      <div className="space-y-5" style={{ maxWidth: '38rem' }}>
        <SyncPanel
          title="ローカル → Cloudflare D1"
          description="ローカルの SQLite（wrangler D1）を SQL エクスポートし、リモートの Cloudflare D1 に適用します。数分かかる場合があります。"
          flowNodes={['local D1 (.sqlite)', 'tmp.sql', 'Cloudflare D1']}
          buttonLabel="↑ PUSH TO CLOUDFLARE D1"
          endpoint="/api/sync/push"
        />

        <SyncPanel
          title="Cloudflare D1 → ローカル"
          description="リモートの Cloudflare D1 をエクスポートし、ローカルの SQLite に上書きします。ローカルの未同期データは失われます。"
          flowNodes={['Cloudflare D1', 'tmp.sql', 'local D1 (.sqlite)']}
          buttonLabel="↓ PULL FROM CLOUDFLARE D1"
          endpoint="/api/sync/pull"
        />
      </div>
    </div>
  );
}
