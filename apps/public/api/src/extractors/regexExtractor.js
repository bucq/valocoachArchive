import { AGENT_ALIAS_MAP, MAP_ALIAS_MAP, RANK_ALIAS_MAP } from './valorant';
function escapeRegex(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
/** タイトルにコーチングキーワードが含まれれば true */
export function isValorantCoachingVideo(title) {
    return /coaching/i.test(title) || /コーチング/.test(title);
}
function matchFromAliasMap(text, aliasMap) {
    for (const [alias, label] of aliasMap) {
        const pattern = new RegExp(`\\b${escapeRegex(alias)}\\b`, 'i');
        if (pattern.test(text))
            return label;
    }
    return null;
}
export function detectCoachingType(title) {
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
export function regexExtract(title, description, tags) {
    const primaryText = [title, ...tags].join(' ');
    const secondaryText = description.slice(0, 500);
    const mapLabel = matchFromAliasMap(primaryText, MAP_ALIAS_MAP) ??
        matchFromAliasMap(secondaryText, MAP_ALIAS_MAP);
    const agentLabel = matchFromAliasMap(primaryText, AGENT_ALIAS_MAP) ??
        matchFromAliasMap(secondaryText, AGENT_ALIAS_MAP);
    const rankLabel = matchFromAliasMap(primaryText, RANK_ALIAS_MAP) ??
        matchFromAliasMap(secondaryText, RANK_ALIAS_MAP);
    const makeField = (value) => ({
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
