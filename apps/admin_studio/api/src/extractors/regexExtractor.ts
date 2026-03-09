import { MAP_ALIAS_MAP, AGENT_ALIAS_MAP, RANK_ALIAS_MAP, MAP_LABELS, AGENT_LABELS } from './valorant';
import type { VideoMetadataExtraction, FieldExtraction } from './types';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * タイトルからValorantコーチング動画かどうかを判定する。
 *
 * 条件: 下記いずれかを満たす場合に true。
 *   A) 「Valorantゲーム名」AND「コーチング/教育系ワード」
 *   B) 「コーチング/教育系ワード」AND「Valorant固有のランク名」
 *      ← ゲーム名を省略して「【コーチング】アイアン...」と書くチャンネル対応
 * ゲーム名もランク名もない場合は false（誤検知防止）。
 * ※ description は含めない（偽陽性防止）
 */
export function isValorantCoachingVideo(title: string): boolean {
  const text = title.toLowerCase();

  // コーチング/教育系ワード
  const coachingPatterns = [
    /coaching/i,
    /コーチング/,
    /解説/,
  ];
  const hasCoachingKeyword = coachingPatterns.some(p => p.test(text));
  if (!hasCoachingKeyword) return false;

  // Valorantゲーム名キーワード
  const gamePatterns = [
    /valorant/i,
    /\bvalo\b/i,
    /ヴァロラント/,
    /ヴァロ/,
    /\bval\b/i,
  ];
  if (gamePatterns.some(p => p.test(text))) return true;

  // Valorant固有のランク名（ゲーム名を省略したタイトル対応）
  const valoRankPatterns = [
    /アイアン/, /ブロンズ/, /シルバー/, /ゴールド/, /プラチナ/,
    /ダイヤ/, /アセンダント/, /イモータル/, /レディアント/,
    /\biron\b/i, /\bbronze\b/i, /\bsilver\b/i, /\bgold\b/i,
    /\bplatinum\b/i, /\bplat\b/i, /\bdiamond\b/i,
    /\bascendant\b/i, /\bimmortal\b/i, /\bradiant\b/i,
  ];
  return valoRankPatterns.some(p => p.test(text));
}

/**
 * テキストから単語境界マッチで最初にヒットした値を返す。
 * aliasMapのキーはすべてlowercase前提。
 */
function matchFromAliasMap(
  text: string,
  aliasMap: Map<string, string>,
): string | null {
  for (const [alias, label] of aliasMap) {
    const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
    if (pattern.test(text)) return label;
  }
  return null;
}

/**
 * Tier 1: Regex 抽出
 * タイトル → タグ → 説明（先頭500文字）の順に検索。
 * cost: $0 / 同期処理
 */
export function regexExtract(
  title: string,
  description: string,
  tags: string[],
): VideoMetadataExtraction {
  // 優先度順にテキストソースを結合
  const primaryText   = [title, ...tags].join(' ');
  const secondaryText = description.slice(0, 500);

  const mapLabel   = matchFromAliasMap(primaryText, MAP_ALIAS_MAP)
                  ?? matchFromAliasMap(secondaryText, MAP_ALIAS_MAP);
  const agentLabel = matchFromAliasMap(primaryText, AGENT_ALIAS_MAP)
                  ?? matchFromAliasMap(secondaryText, AGENT_ALIAS_MAP);
  const rankLabel  = matchFromAliasMap(primaryText, RANK_ALIAS_MAP)
                  ?? matchFromAliasMap(secondaryText, RANK_ALIAS_MAP);

  const makeField = (value: string | null): FieldExtraction => ({
    value,
    confidence: value !== null ? 'high' : 'none',
    source:     'regex',
  });

  return {
    map:   makeField(mapLabel),
    agent: makeField(agentLabel),
    rank:  makeField(rankLabel),
  };
}
