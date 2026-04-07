/**
 * collector.ts — 動画収集サービス（D1対応・Workers版）
 *
 * better-sqlite3 を排除し、drizzle D1 インスタンスを引数で受け取る。
 */

import { sql } from 'drizzle-orm';
import type { drizzle } from 'drizzle-orm/d1';
import { videos } from '../../db/schema';
import { isValorantCoachingVideo, regexExtract } from '../../extractors/regexExtractor';
import { CONFIDENCE_FLOAT } from '../../extractors/types';
import { COACH_CHANNEL_IDS } from '../coaches';
import type { YouTubeVideoItem } from '../youtube';
import { fetchChannelVideos, searchVideos } from '../youtube';

type Db = ReturnType<typeof drizzle>;

export interface CollectEvent {
  type: 'channel_start' | 'channel_done' | 'video_collected' | 'video_filtered' | 'done' | 'error';
  channelId?: string;
  channelTitle?: string;
  videoId?: string;
  title?: string;
  aiTaggingStatus?: string;
  fetched?: number;
  coaching?: number;
  filtered?: number;
  total?: number;
  message?: string;
}

export interface CollectOptions {
  apiKey: string;
  channelIds?: string[];
  maxPerChannel?: number;
  dryRun?: boolean;
  onEvent?: (event: CollectEvent) => void;
}

export interface CollectResult {
  totalCollected: number;
  totalFiltered: number;
  totalSkipped: number;
  totalPending: number;
}

export async function collectVideos(db: Db, opts: CollectOptions): Promise<CollectResult> {
  const {
    apiKey,
    channelIds = COACH_CHANNEL_IDS,
    maxPerChannel = 9999,
    dryRun = false,
    onEvent,
  } = opts;

  const emit = (event: CollectEvent) => onEvent?.(event);

  let totalCollected = 0;
  let totalFiltered = 0;
  let totalSkipped = 0;
  let totalPending = 0;

  const now = new Date().toISOString();

  for (const channelId of channelIds) {
    if (channelId.startsWith('REPLACE_')) {
      emit({ type: 'channel_start', channelId, message: 'スキップ（未設定チャンネル）' });
      continue;
    }

    emit({ type: 'channel_start', channelId });

    let items: YouTubeVideoItem[];
    try {
      items = await fetchChannelVideos(channelId, apiKey, maxPerChannel);
    } catch (err) {
      emit({ type: 'error', channelId, message: String(err) });
      continue;
    }

    let channelCoaching = 0;
    const insertRows: (typeof videos.$inferInsert)[] = [];

    for (const item of items) {
      const title = item.snippet.title;
      const description = item.snippet.description;
      const tags = item.snippet.tags ?? [];

      if (!isValorantCoachingVideo(title)) {
        totalFiltered++;
        emit({ type: 'video_filtered', channelId, title });
        continue;
      }

      channelCoaching++;
      const extraction = regexExtract(title, description, tags);
      const allExtracted =
        extraction.map.value !== null &&
        extraction.agent.value !== null &&
        extraction.rank.value !== null;

      const aiTaggingStatus = allExtracted ? 'skipped' : 'pending';
      const thumbnailUrl =
        item.snippet.thumbnails.maxres?.url ??
        item.snippet.thumbnails.high?.url ??
        item.snippet.thumbnails.medium?.url ??
        item.snippet.thumbnails.default?.url ??
        '';

      insertRows.push({
        id: item.id,
        title,
        description,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl,
        duration: item.contentDetails.duration,
        viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
        map: extraction.map.value,
        agent: extraction.agent.value,
        rank: extraction.rank.value,
        mapConfidence:
          extraction.map.value !== null ? CONFIDENCE_FLOAT[extraction.map.confidence] : 0,
        agentConfidence:
          extraction.agent.value !== null ? CONFIDENCE_FLOAT[extraction.agent.confidence] : 0,
        rankConfidence:
          extraction.rank.value !== null ? CONFIDENCE_FLOAT[extraction.rank.confidence] : 0,
        mapSource: extraction.map.value !== null ? 'regex' : null,
        agentSource: extraction.agent.value !== null ? 'regex' : null,
        rankSource: extraction.rank.value !== null ? 'regex' : null,
        aiTaggingStatus,
        syncedAt: now,
        updatedAt: now,
      });

      emit({ type: 'video_collected', channelId, videoId: item.id, title, aiTaggingStatus });
      totalCollected++;
      if (aiTaggingStatus === 'skipped') totalSkipped++;
      else totalPending++;
    }

    if (!dryRun && insertRows.length > 0) {
      const BATCH = 100;
      for (let i = 0; i < insertRows.length; i += BATCH) {
        const batch = insertRows.slice(i, i + BATCH);
        await db
          .insert(videos)
          .values(batch)
          .onConflictDoUpdate({
            target: videos.id,
            set: {
              title: sql`excluded.title`,
              viewCount: sql`excluded.view_count`,
              syncedAt: sql`excluded.synced_at`,
              updatedAt: sql`excluded.updated_at`,
            },
          });
      }
    }

    emit({
      type: 'channel_done',
      channelId,
      fetched: items.length,
      coaching: channelCoaching,
      filtered: items.length - channelCoaching,
    });
  }

  emit({ type: 'done', total: totalCollected });
  return { totalCollected, totalFiltered, totalSkipped, totalPending };
}

export async function searchCollect(
  db: Db,
  opts: {
    apiKey: string;
    query: string;
    maxResults?: number;
    onEvent?: (event: CollectEvent) => void;
  },
): Promise<{ fetched: number; upserted: number; filtered: number }> {
  const { apiKey, query, maxResults = 20, onEvent } = opts;
  const emit = (event: CollectEvent) => onEvent?.(event);

  const items = await searchVideos(query, apiKey, maxResults);
  const now = new Date().toISOString();

  let upserted = 0;
  let filtered = 0;

  for (const item of items) {
    const title = item.snippet.title;
    if (!isValorantCoachingVideo(title)) {
      filtered++;
      emit({ type: 'video_filtered', title });
      continue;
    }

    const description = item.snippet.description;
    const tags = item.snippet.tags ?? [];
    const extraction = regexExtract(title, description, tags);
    const allExtracted =
      extraction.map.value !== null &&
      extraction.agent.value !== null &&
      extraction.rank.value !== null;

    const thumbnailUrl =
      item.snippet.thumbnails.maxres?.url ??
      item.snippet.thumbnails.high?.url ??
      item.snippet.thumbnails.medium?.url ??
      item.snippet.thumbnails.default?.url ??
      '';

    await db
      .insert(videos)
      .values({
        id: item.id,
        title,
        description,
        channelId: item.snippet.channelId,
        channelTitle: item.snippet.channelTitle,
        publishedAt: item.snippet.publishedAt,
        thumbnailUrl,
        duration: item.contentDetails.duration,
        viewCount: parseInt(item.statistics.viewCount ?? '0', 10),
        map: extraction.map.value,
        agent: extraction.agent.value,
        rank: extraction.rank.value,
        mapConfidence:
          extraction.map.value !== null ? CONFIDENCE_FLOAT[extraction.map.confidence] : 0,
        agentConfidence:
          extraction.agent.value !== null ? CONFIDENCE_FLOAT[extraction.agent.confidence] : 0,
        rankConfidence:
          extraction.rank.value !== null ? CONFIDENCE_FLOAT[extraction.rank.confidence] : 0,
        mapSource: extraction.map.value !== null ? 'regex' : null,
        agentSource: extraction.agent.value !== null ? 'regex' : null,
        rankSource: extraction.rank.value !== null ? 'regex' : null,
        aiTaggingStatus: allExtracted ? 'skipped' : 'pending',
        syncedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: videos.id,
        set: {
          title: sql`excluded.title`,
          viewCount: sql`excluded.view_count`,
          syncedAt: sql`excluded.synced_at`,
          updatedAt: sql`excluded.updated_at`,
        },
      });

    upserted++;
    emit({ type: 'video_collected', videoId: item.id, title });
  }

  emit({ type: 'done', total: upserted });
  return { fetched: items.length, upserted, filtered };
}
