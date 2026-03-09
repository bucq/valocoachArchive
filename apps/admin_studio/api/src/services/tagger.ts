/**
 * tagger.ts — LLMタグ付けサービス（SSEコールバック対応）
 *
 * bulk-tag.ts のロジックを Drizzle + better-sqlite3 ベースに移植。
 * wrangler サブプロセス不要。SSE でリアルタイム進捗通知に対応。
 */

import { eq, inArray } from 'drizzle-orm';
import { db } from '../db.js';
import { videos } from '@public-api/db/schema.js';
import { analyzeThumbnail } from '../extractors/thumbnailExtractor.js';
import { sampleGameplayFrames } from '../extractors/frameSampler.js';
import { sampleGameplayFramesLocal } from '../extractors/frameSamplerLocal.js';

/** yt-dlp → CDN の順でフレームを取得する */
async function getFrames(videoId: string) {
  const local = await sampleGameplayFramesLocal(videoId);
  if (local.length > 0) return local;
  return sampleGameplayFrames(videoId);
}

// Gemini 無料枠: 1分間 15〜20 RPM 程度を想定
// 並行数を上げすぎると 429 エラーになるため、安全な値を設定
const CONCURRENCY = 3;
const RATE_LIMIT_STAGGER_MS = 2000; // 並行開始時のずらし時間

const CONFIDENCE_VALUE: Record<string, number> = {
  manual: 100, regex: 80, caption_llm: 65, thumbnail_llm: 45,
};
const CONFIDENCE_FLOAT_MAP: Record<string, number> = {
  high: 0.9, medium: 0.65, low: 0.45, none: 0,
};

export interface TagEvent {
  type: 'start' | 'progress' | 'tagged' | 'failed' | 'rate_limited' | 'done';
  current?: number;
  total?: number;
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

export interface TagOptions {
  geminiApiKey: string;
  provider?: 'gemini' | 'gemma' | 'anthropic';
  maxCount?: number;
  dryRun?: boolean;
  onEvent?: (event: TagEvent) => void;
}

export async function tagPendingVideos(opts: TagOptions): Promise<{ processed: number; success: number; failed: number }> {
  const {
    geminiApiKey,
    maxCount = 500,
    dryRun = false,
    onEvent,
  } = opts;

  const emit = (event: TagEvent) => onEvent?.(event);

  // pending/failed の動画を取得
  const rows = await db
    .select({
      id: videos.id,
      title: videos.title,
      map: videos.map,
      agent: videos.agent,
      rank: videos.rank,
      mapSource: videos.mapSource,
      agentSource: videos.agentSource,
      rankSource: videos.rankSource,
    })
    .from(videos)
    .where(
      inArray(videos.aiTaggingStatus, ['pending', 'failed'])
    )
    .limit(maxCount);

  if (rows.length === 0) {
    emit({ type: 'done', processed: 0, success: 0, failed: 0 });
    return { processed: 0, success: 0, failed: 0 };
  }

  emit({ type: 'start', total: rows.length });

  let successCount = 0;
  let failCount = 0;
  let processedCount = 0;
  const now = new Date().toISOString();

  // ワーカー関数
  const processVideo = async (video: typeof rows[0], index: number) => {
    // 開始を少しずらして API への同時アクセス集中を避ける
    await new Promise(r => setTimeout(r, (index % CONCURRENCY) * RATE_LIMIT_STAGGER_MS));

    const MAX_RETRIES = 3;
    const RETRY_WAIT_MS = 60000; // レート制限時の待機時間（1分）

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        if (attempt === 0) {
          emit({ type: 'progress', current: ++processedCount, total: rows.length, videoId: video.id, title: video.title });
        }

        const { result, failReason } = await analyzeThumbnail(
          video.id,
          geminiApiKey,
          opts.provider ?? 'gemma',
          video.title,
          () => getFrames(video.id),
        );

        if (!result) {
          if (!dryRun) {
            await db.update(videos).set({
              aiTaggingStatus: 'failed',
              aiTaggedAt: now,
              updatedAt: now,
            }).where(eq(videos.id, video.id));
          }
          emit({ type: 'failed', videoId: video.id, title: video.title, message: failReason ?? 'no result' });
          failCount++;
          return;
        }

        const incomingConf = CONFIDENCE_VALUE['thumbnail_llm']!;
        const resolvedMap = resolveField(result.map, video.map, video.mapSource, incomingConf);
        const resolvedAgent = resolveField(result.agent, video.agent, video.agentSource, incomingConf);
        const resolvedRank = resolveField(result.rank, video.rank, video.rankSource, incomingConf);

        const reviewNeeded =
          (result.map !== null && result.map_confidence !== 'high') ||
            (result.agent !== null && result.agent_confidence !== 'high') ||
            (result.rank !== null && result.rank_confidence !== 'high') ? 1 : 0;

        if (!dryRun) {
          await db.update(videos).set({
            map: resolvedMap.value,
            agent: resolvedAgent.value,
            rank: resolvedRank.value,
            mapSource: resolvedMap.source,
            agentSource: resolvedAgent.source,
            rankSource: resolvedRank.source,
            mapConfidence: result.map !== null ? CONFIDENCE_FLOAT_MAP[result.map_confidence] ?? 0.45 : 0,
            agentConfidence: result.agent !== null ? CONFIDENCE_FLOAT_MAP[result.agent_confidence] ?? 0.45 : 0,
            rankConfidence: result.rank !== null ? CONFIDENCE_FLOAT_MAP[result.rank_confidence] ?? 0.45 : 0,
            aiTaggingStatus: 'complete',
            aiTaggedAt: now,
            updatedAt: now,
            reviewNeeded,
            llmReasoning: JSON.stringify({ thumbnailLLM: result.reasoning }),
          }).where(eq(videos.id, video.id));
        }

        emit({
          type: 'tagged',
          videoId: video.id,
          title: video.title,
          map: resolvedMap.value,
          agent: resolvedAgent.value,
          rank: resolvedRank.value,
        });
        successCount++;
        return; // 成功したので終了

      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        const isRateLimit = msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED');

        if (isRateLimit && attempt < MAX_RETRIES) {
          emit({
            type: 'rate_limited',
            message: `レート制限に達しました。${RETRY_WAIT_MS / 1000}秒後に再試行します (${attempt + 1}/${MAX_RETRIES})`
          });
          await new Promise(r => setTimeout(r, RETRY_WAIT_MS));
          continue; // リトライ
        }

        // 失敗確定時の処理
        if (!dryRun) {
          await db.update(videos).set({ aiTaggingStatus: 'failed', aiTaggedAt: now, updatedAt: now }).where(eq(videos.id, video.id));
        }

        if (isRateLimit) {
          emit({ type: 'rate_limited', message: 'レート制限が継続しているため一括処理を中断します。' });
          failCount++;
          throw new Error('RATE_LIMIT'); // これにより Promise.all が失敗し、メインループが break する
        }

        emit({ type: 'failed', videoId: video.id, title: video.title, message: msg.slice(0, 120) });
        failCount++;
        return;
      }
    }
  };

  function resolveField(newVal: string | null, existVal: string | null, existSrc: string | null, incomingWeight: number) {
    if (newVal === null) return { value: existVal, source: existSrc };
    const existConf = existSrc ? (CONFIDENCE_VALUE[existSrc] ?? 0) : 0;
    if (existVal !== null && existConf > incomingWeight) return { value: existVal, source: existSrc };
    return { value: newVal, source: 'thumbnail_llm' };
  }

  // 並行実行のチャンク制御
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const chunk = rows.slice(i, i + CONCURRENCY);
    try {
      await Promise.all(chunk.map((video, idx) => processVideo(video, i + idx)));
    } catch (err) {
      if (err instanceof Error && err.message === 'RATE_LIMIT') break;
    }
  }

  emit({ type: 'done', processed: rows.length, success: successCount, failed: failCount });
  return { processed: rows.length, success: successCount, failed: failCount };
}

/** タグ付けステータスをリセット */
export async function resetTaggingStatus(statuses: string[]): Promise<number> {
  const now = new Date().toISOString();
  const result = await db
    .update(videos)
    .set({ aiTaggingStatus: 'pending', aiTaggedAt: null, llmReasoning: null, updatedAt: now })
    .where(inArray(videos.aiTaggingStatus, statuses));
  return result.changes ?? 0;
}
