/**
 * tagger.ts — LLMタグ付けサービス（D1対応・per-video設計）
 *
 * Workers の 30s 制限を考慮し、1動画ずつ処理する設計に変更。
 * バッチループはクライアント側（admin UI）が担当する。
 */
import { eq, inArray } from 'drizzle-orm';
import { videos } from '../../db/schema';
import { sampleGameplayFrames } from '../../extractors/frameSampler';
import { detectCoachingType } from '../../extractors/regexExtractor';
import { analyzeThumbnail } from '../../extractors/thumbnailExtractor';
const CONFIDENCE_VALUE = {
    manual: 100,
    regex: 80,
    caption_llm: 65,
    thumbnail_llm: 45,
};
const CONFIDENCE_FLOAT_MAP = {
    high: 0.9,
    medium: 0.65,
    low: 0.45,
    none: 0,
};
/** pending/failed 動画の一覧を取得する */
export async function getPendingVideos(db, maxCount = 500) {
    return db
        .select({
        id: videos.id,
        title: videos.title,
        map: videos.map,
        agent: videos.agent,
        rank: videos.rank,
        mapSource: videos.mapSource,
        agentSource: videos.agentSource,
        rankSource: videos.rankSource,
        coachingType: videos.coachingType,
    })
        .from(videos)
        .where(inArray(videos.aiTaggingStatus, ['pending', 'failed']))
        .limit(maxCount);
}
/** 1動画をタグ付けする — Workers の 30s 制限内に収まる設計 */
export async function tagSingleVideo(db, video, opts) {
    const { geminiApiKey, provider = 'gemma', dryRun = false } = opts;
    const now = new Date().toISOString();
    const { result, failReason } = await analyzeThumbnail(video.id, geminiApiKey, provider, video.title, sampleGameplayFrames);
    if (!result) {
        if (!dryRun) {
            await db
                .update(videos)
                .set({ aiTaggingStatus: 'failed', aiTaggedAt: now, updatedAt: now })
                .where(eq(videos.id, video.id));
        }
        return { status: 'failed', videoId: video.id, failReason: failReason ?? 'no result' };
    }
    const incomingConf = CONFIDENCE_VALUE.thumbnail_llm;
    const resolvedMap = resolveField(result.map, video.map, video.mapSource, incomingConf);
    const resolvedAgent = resolveField(result.agent, video.agent, video.agentSource, incomingConf);
    const resolvedRank = resolveField(result.rank, video.rank, video.rankSource, incomingConf);
    const reviewNeeded = (result.map !== null && result.map_confidence !== 'high') ||
        (result.agent !== null && result.agent_confidence !== 'high') ||
        (result.rank !== null && result.rank_confidence !== 'high')
        ? 1
        : 0;
    const coachingType = result.coaching_type ?? detectCoachingType(video.title);
    if (!dryRun) {
        await db
            .update(videos)
            .set({
            map: resolvedMap.value,
            agent: resolvedAgent.value,
            rank: resolvedRank.value,
            mapSource: resolvedMap.source,
            agentSource: resolvedAgent.source,
            rankSource: resolvedRank.source,
            mapConfidence: result.map !== null ? (CONFIDENCE_FLOAT_MAP[result.map_confidence] ?? 0.45) : 0,
            agentConfidence: result.agent !== null ? (CONFIDENCE_FLOAT_MAP[result.agent_confidence] ?? 0.45) : 0,
            rankConfidence: result.rank !== null ? (CONFIDENCE_FLOAT_MAP[result.rank_confidence] ?? 0.45) : 0,
            coachingType,
            aiTaggingStatus: 'complete',
            aiTaggedAt: now,
            updatedAt: now,
            reviewNeeded,
            llmReasoning: JSON.stringify({ thumbnailLLM: result.reasoning }),
        })
            .where(eq(videos.id, video.id));
    }
    return {
        status: 'tagged',
        videoId: video.id,
        map: resolvedMap.value,
        agent: resolvedAgent.value,
        rank: resolvedRank.value,
    };
}
/** タグ付けステータスをリセット */
export async function resetTaggingStatus(db, statuses) {
    const now = new Date().toISOString();
    const result = await db
        .update(videos)
        .set({ aiTaggingStatus: 'pending', aiTaggedAt: null, llmReasoning: null, updatedAt: now })
        .where(inArray(videos.aiTaggingStatus, statuses));
    return result.meta?.changes ?? 0;
}
function resolveField(newVal, existVal, existSrc, incomingWeight) {
    if (newVal === null)
        return { value: existVal, source: existSrc };
    const existConf = existSrc ? (CONFIDENCE_VALUE[existSrc] ?? 0) : 0;
    if (existVal !== null && existConf > incomingWeight)
        return { value: existVal, source: existSrc };
    return { value: newVal, source: 'thumbnail_llm' };
}
