import type { FieldExtraction, VideoMetadataExtraction } from './types';
import { AGENT_ALIAS_MAP, MAP_ALIAS_MAP, RANK_ALIAS_MAP } from './valorant';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** タイトルにコーチングキーワードが含まれれば true */
export function isValorantCoachingVideo(title: string): boolean {
  return /coaching/i.test(title) || /コーチング/.test(title);
}

/**
 * テキストから単語境界マッチで最初にヒットした値を返す。
 * aliasMapのキーはすべてlowercase前提。
 */
function matchFromAliasMap(text: string, aliasMap: Map<string, string>): string | null {
  for (const [alias, label] of aliasMap) {
    const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
    if (pattern.test(text)) return label;
  }
  return null;
}

/**
 * タイトルからコーチング種別を判定する。
 * チーム・複数人コーチングキーワードが含まれる場合は 'team'、それ以外は 'individual'。
 */
export function detectCoachingType(title: string): 'individual' | 'team' {
  const teamPatterns = [
    /チーム/,
    /team/i,
    /スクリム/,
    /scrim/i,
    /5\s*[vx]\s*5/i,
    /複数/,
    /全員/,
    /みんな/,
    /グループ/,
    /group/i,
    /部活/,
    /clan/i,
    /クラン/,
    /練習試合/,
  ];
  return teamPatterns.some((p) => p.test(title)) ? 'team' : 'individual';
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
  const primaryText = [title, ...tags].join(' ');
  const secondaryText = description.slice(0, 500);

  const mapLabel =
    matchFromAliasMap(primaryText, MAP_ALIAS_MAP) ??
    matchFromAliasMap(secondaryText, MAP_ALIAS_MAP);
  const agentLabel =
    matchFromAliasMap(primaryText, AGENT_ALIAS_MAP) ??
    matchFromAliasMap(secondaryText, AGENT_ALIAS_MAP);
  const rankLabel =
    matchFromAliasMap(primaryText, RANK_ALIAS_MAP) ??
    matchFromAliasMap(secondaryText, RANK_ALIAS_MAP);

  const makeField = (value: string | null): FieldExtraction => ({
    value,
    confidence: value !== null ? 'high' : 'none',
    source: 'regex',
  });

  return {
    map: makeField(mapLabel),
    agent: makeField(agentLabel),
    rank: makeField(rankLabel),
  };
}
