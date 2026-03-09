/** biome-ignore-all lint/a11y/useKeyWithClickEvents: backdrop <div> onClick is supplementary; keyboard dismissal is handled via ESC key (useEffect) and the × button */

import { useEffect, useRef, useState } from 'react';
import { submitCorrection } from '../lib/api';
import { AGENT_ICONS, MAP_ICONS, RANK_ICONS } from '../lib/valorant-assets';

const MAPS = Object.keys(MAP_ICONS);
const AGENTS = Object.keys(AGENT_ICONS);
const RANKS = Object.keys(RANK_ICONS);

interface Props {
  apiBase: string;
  videoId: string;
  title: string;
  currentMap: string | null;
  currentAgent: string | null;
  currentRank: string | null;
  onClose: () => void;
}

type Status = 'idle' | 'submitting' | 'success' | 'alreadyPending' | 'error';

// ── カスタムアイコン付きセレクト ────────────────────────────────────────────
interface IconSelectProps {
  label: string;
  value: string;
  options: string[];
  icons: Record<string, string>;
  iconClip?: string;
  iconSize?: number;
  onChange: (v: string) => void;
}

function IconSelect({
  label,
  value,
  options,
  icons,
  iconClip,
  iconSize = 16,
  onChange,
}: IconSelectProps) {
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

  const selectedIcon = value ? icons[value] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <span
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: '0.6rem',
          letterSpacing: '0.12em',
          color: '#555',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>

      <div ref={ref} style={{ position: 'relative' }}>
        {/* トリガーボタン */}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          style={{
            width: '100%',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${open ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)'}`,
            color: value ? 'var(--c-text, #e8eaf0)' : '#555',
            padding: '0.4rem 0.7rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: 'pointer',
            textAlign: 'left',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.75rem',
            transition: 'border-color 0.12s',
          }}
        >
          {selectedIcon ? (
            <img
              src={selectedIcon}
              alt=""
              width={iconSize}
              height={iconSize}
              style={{ objectFit: 'cover', flexShrink: 0, clipPath: iconClip }}
            />
          ) : (
            <span style={{ width: iconSize, height: iconSize, flexShrink: 0 }} />
          )}
          <span style={{ flex: 1 }}>{value || '変更なし'}</span>
          <span style={{ color: '#444', fontSize: '0.65rem' }}>{open ? '▲' : '▼'}</span>
        </button>

        {/* ドロップダウンリスト */}
        {open && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 2px)',
              left: 0,
              right: 0,
              background: '#0d1620',
              border: '1px solid rgba(255,255,255,0.12)',
              zIndex: 100,
              maxHeight: '220px',
              overflowY: 'auto',
            }}
          >
            {/* 変更なし */}
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
                gap: '0.5rem',
                padding: '0.45rem 0.7rem',
                background: value === '' ? 'rgba(255,255,255,0.06)' : 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#555',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.72rem',
                textAlign: 'left',
              }}
            >
              <span style={{ width: iconSize, flexShrink: 0 }} />
              変更なし
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
                  gap: '0.5rem',
                  padding: '0.4rem 0.7rem',
                  background: opt === value ? 'rgba(255,70,85,0.12)' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: opt === value ? '#e8eaf0' : '#aaa',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '0.72rem',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  if (opt !== value)
                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
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
    </div>
  );
}

// ── メインコンポーネント ────────────────────────────────────────────────────

export default function CorrectionModal({
  apiBase,
  videoId,
  title,
  currentMap,
  currentAgent,
  currentRank,
  onClose,
}: Props) {
  const [map, setMap] = useState('');
  const [agent, setAgent] = useState('');
  const [rank, setRank] = useState('');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  // ESC キーで閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const hasChange = map !== '' || agent !== '' || rank !== '';

  const handleSubmit = async () => {
    if (!hasChange) return;
    setStatus('submitting');
    try {
      const payload: Record<string, string> = {};
      if (map) payload.suggestedMap = map;
      if (agent) payload.suggestedAgent = agent;
      if (rank) payload.suggestedRank = rank;
      if (note.trim()) payload.note = note.trim();

      const res = await submitCorrection(apiBase, videoId, payload);
      if (res.alreadyPending) {
        setStatus('alreadyPending');
      } else {
        setStatus('success');
        setTimeout(onClose, 1800);
      }
    } catch {
      setStatus('error');
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click-to-close is supplementary; ESC key and × button handle keyboard access
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(9,14,20,0.82)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: 'var(--c-surface-1, #0f1923)',
          border: '1px solid rgba(255,255,255,0.08)',
          width: '100%',
          maxWidth: '440px',
          padding: '1.5rem',
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#666',
            fontSize: '1.1rem',
            lineHeight: 1,
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.6rem',
              letterSpacing: '0.15em',
              color: '#FF4655',
              marginBottom: '0.4rem',
              textTransform: 'uppercase',
            }}
          >
            // タグ修正リクエスト
          </div>
          <p
            style={{
              fontSize: '0.82rem',
              fontWeight: 600,
              color: 'var(--c-text, #e8eaf0)',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              fontFamily: "'Rajdhani', sans-serif",
            }}
          >
            {title}
          </p>
        </div>

        {/* Current tags */}
        <div
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.05)',
            padding: '0.6rem 0.8rem',
            marginBottom: '1rem',
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '0.68rem',
          }}
        >
          <div style={{ color: '#555', marginBottom: '0.3rem', letterSpacing: '0.1em' }}>
            現在のタグ
          </div>
          <div style={{ color: '#888', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <span>
              map: <span style={{ color: '#aaa' }}>{currentMap ?? '—'}</span>
            </span>
            <span>
              agent: <span style={{ color: '#aaa' }}>{currentAgent ?? '—'}</span>
            </span>
            <span>
              rank: <span style={{ color: '#aaa' }}>{currentRank ?? '—'}</span>
            </span>
          </div>
        </div>

        {/* Fields */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}
        >
          {/* MAP — 背景画像グリッド */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                color: '#555',
                textTransform: 'uppercase',
              }}
            >
              MAP
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {MAPS.map((m) => {
                const selected = map === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMap(selected ? '' : m)}
                    style={{
                      position: 'relative',
                      width: '72px',
                      height: '38px',
                      backgroundImage: `url(${MAP_ICONS[m]})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      border: selected ? '2px solid #FF4655' : '2px solid rgba(255,255,255,0.08)',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      padding: 0,
                      transition: 'border-color 0.12s, filter 0.12s, box-shadow 0.12s',
                      filter: selected ? 'none' : 'grayscale(40%) brightness(0.55)',
                      boxShadow: selected
                        ? '0 0 0 1px rgba(255,70,85,0.5), 0 2px 10px rgba(255,70,85,0.35)'
                        : 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: selected ? 'rgba(255,70,85,0.2)' : 'rgba(9,14,20,0.6)',
                        transition: 'background 0.12s',
                      }}
                    />
                    <span
                      style={{
                        position: 'relative',
                        fontFamily: 'JetBrains Mono, monospace',
                        fontSize: '0.58rem',
                        letterSpacing: '0.04em',
                        color: selected ? '#fff' : 'rgba(255,255,255,0.4)',
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

          <IconSelect
            label="AGENT"
            value={agent}
            options={AGENTS}
            icons={AGENT_ICONS}
            iconSize={18}
            iconClip="polygon(22% 0%, 78% 0%, 100% 22%, 100% 78%, 78% 100%, 22% 100%, 0% 78%, 0% 22%)"
            onChange={setAgent}
          />
          <IconSelect
            label="RANK"
            value={rank}
            options={RANKS}
            icons={RANK_ICONS}
            iconSize={16}
            onChange={setRank}
          />

          <label style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            <span
              style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.6rem',
                letterSpacing: '0.12em',
                color: '#555',
                textTransform: 'uppercase',
              }}
            >
              NOTE（任意）
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={200}
              rows={2}
              placeholder="根拠など（200文字以内）"
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--c-text, #e8eaf0)',
                padding: '0.4rem 0.6rem',
                resize: 'vertical',
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: '0.72rem',
                width: '100%',
                outline: 'none',
              }}
            />
          </label>
        </div>

        {/* Status messages */}
        {status === 'success' && (
          <div
            style={{
              color: '#45D483',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem',
              marginBottom: '0.75rem',
            }}
          >
            ✔ 修正リクエストを送信しました
          </div>
        )}
        {status === 'alreadyPending' && (
          <div
            style={{
              color: '#F5C842',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem',
              marginBottom: '0.75rem',
            }}
          >
            ⚠ 他のユーザーからすでにリクエストが届いています。管理者が対応中です。
          </div>
        )}
        {status === 'error' && (
          <div
            style={{
              color: '#FF4655',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.72rem',
              marginBottom: '0.75rem',
            }}
          >
            ✕ 送信に失敗しました。しばらくしてから再試行してください。
          </div>
        )}

        {/* Submit button */}
        {status !== 'success' && (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!hasChange || status === 'submitting'}
            style={{
              width: '100%',
              background: hasChange && status !== 'submitting' ? '#FF4655' : 'rgba(255,70,85,0.25)',
              color: hasChange && status !== 'submitting' ? '#fff' : '#FF4655',
              border: 'none',
              padding: '0.55rem 1rem',
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.1em',
              cursor: hasChange ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s',
            }}
          >
            {status === 'submitting' ? 'SENDING...' : 'リクエストを送信'}
          </button>
        )}
      </div>
    </div>
  );
}
