import type { LabeledCatalogEntry } from './catalogLoader';

/**
 * Gemini Context Caching — カタログ画像（~80枚）を1時間キャッシュし、
 * リクエストごとの画像送信コストを約90%削減する。
 *
 * Workers はステートレスだが同一インスタンス内なら module-level 変数が生きるため、
 * in-memory キャッシュで十分。失効時は次回リクエストで自動再作成される。
 *
 * 対応モデル: gemini-2.5-flash
 * 制約: 最小キャッシュサイズ 32,768 tokens（80枚なら十分）、最短 TTL 60s
 */

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

/** キャッシュ有効期間（秒）。Gemini の最小 TTL は 60s。 */
const CACHE_TTL_SECONDS = 3600;

/** TTL の何秒前に in-memory キャッシュを更新するか（期限切れを安全にかわす）。 */
const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000; // 5 分前

interface InMemoryEntry {
  /** Gemini から返された cachedContents/xxx 形式の名前 */
  name: string;
  expiresAt: number;
}

// Workers インスタンスごとに 1 つのキャッシュエントリを保持
let _entry: InMemoryEntry | null = null;
/** true の場合、キャッシュ作成を試みない（フリープランなど非対応環境） */
let _disabled = false;

/**
 * キャッシュ済み名前を返す。期限切れ/未作成なら新規作成して返す。
 * 失敗時は null を返し、呼び出し元が fallback（インラインで画像送信）を行う。
 */
export async function getOrCreateCatalogCache(
  apiKey: string,
  model: string,
  catalogs: LabeledCatalogEntry[],
): Promise<string | null> {
  if (_disabled) return null;

  const now = Date.now();

  if (_entry && now < _entry.expiresAt - REFRESH_BEFORE_EXPIRY_MS) {
    console.log(`[contextCache] hit: ${_entry.name}`);
    return _entry.name;
  }

  console.log('[contextCache] creating new cached content...');
  const name = await createCachedContent(apiKey, model, catalogs);
  if (name) {
    _entry = { name, expiresAt: now + CACHE_TTL_SECONDS * 1000 };
    console.log(`[contextCache] created: ${name}`);
  } else {
    _disabled = true;
    console.warn('[contextCache] cache unavailable, switching to inline mode permanently');
  }
  return name;
}

/** キャッシュを明示的に無効化（モデル変更時などに呼ぶ）。 */
export function invalidateCatalogCache(): void {
  _entry = null;
}

// ── 内部実装 ─────────────────────────────────────────────────────────────────

async function createCachedContent(
  apiKey: string,
  model: string,
  catalogs: LabeledCatalogEntry[],
): Promise<string | null> {
  // カテゴリグループごとにラベルテキストと画像パーツを並べる
  const parts: object[] = [
    { text: 'これらはValorantのリファレンスカタログ画像です。各画像は直前のラベルに対応します。' },
    { text: '=== MAP MINIMAP CATALOG（ゲームプレイ左上のミニマップ。マップ特定の主要参照） ===' },
  ];

  let currentCategory = '';
  for (const entry of catalogs) {
    if (entry.category !== currentCategory) {
      currentCategory = entry.category;
      if (currentCategory !== 'MAP_MINIMAP') {
        const labels: Record<string, string> = {
          MAP_SCENE: '=== MAP SCENE CATALOG（マップの背景シーン・建築様式） ===',
          AGENT_ICON: '=== AGENT ICON CATALOG（エージェントのアイコン） ===',
          AGENT_PORTRAIT: '=== AGENT PORTRAIT CATALOG（エージェントの全身像） ===',
          RANK: '=== RANK CATALOG（IRON_1〜RADIANT のランクバッジ個別画像） ===',
        };
        parts.push({ text: labels[currentCategory] ?? `=== ${currentCategory} ===` });
      }
    }
    parts.push({ text: `[${entry.category}] ${entry.name}:` });
    parts.push({
      inline_data: {
        mime_type: entry.mediaType,
        data: entry.base64,
      },
    });
  }

  const body = {
    model: `models/${model}`,
    displayName: 'valocoach-catalog-v2',
    system_instruction: {
      parts: [{
        text: 'あなたはValorantのeスポーツアナリストです。最初にキャッシュされたリファレンスカタログ（マップ・エージェント・ランクの参照画像群）が提供されています。各推論リクエストではこのカタログを参照して回答してください。',
      }],
    },
    contents: [{
      role: 'user',
      parts,
    }],
    ttl: `${CACHE_TTL_SECONDS}s`,
  };

  try {
    const res = await fetch(`${GEMINI_BASE}/cachedContents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[contextCache] create failed ${res.status}: ${errText}`);
      return null;
    }

    const data = await res.json() as { name?: string };
    return data.name ?? null;
  } catch (err) {
    console.error('[contextCache] fetch error:', err);
    return null;
  }
}
