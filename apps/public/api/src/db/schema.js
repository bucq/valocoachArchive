import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';
export const videos = sqliteTable('videos', {
    // ── Core identity ──────────────────────────────────────────────
    id: text('id').primaryKey(), // YouTube動画ID
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    channelId: text('channel_id').notNull(),
    channelTitle: text('channel_title').notNull().default(''),
    publishedAt: text('published_at').notNull(), // ISO 8601
    thumbnailUrl: text('thumbnail_url').notNull().default(''),
    duration: text('duration').notNull().default(''), // ISO 8601 e.g. PT12M30S
    viewCount: integer('view_count').notNull().default(0),
    // ── 抽出メタデータ ──────────────────────────────────────────────
    map: text('map'), // Ascent | Bind | ... | null
    agent: text('agent'), // Jett | Sage | ... | null
    rank: text('rank'), // Iron | Bronze | ... | Radiant | null
    // ── 信頼度 (0.0–1.0) ──────────────────────────────────────────
    mapConfidence: real('map_confidence').notNull().default(0),
    agentConfidence: real('agent_confidence').notNull().default(0),
    rankConfidence: real('rank_confidence').notNull().default(0),
    // ── 抽出ソース ─────────────────────────────────────────────────
    // 'regex' | 'caption_llm' | 'thumbnail_llm' | 'manual'
    mapSource: text('map_source'),
    agentSource: text('agent_source'),
    rankSource: text('rank_source'),
    // ── 字幕キャッシュ ─────────────────────────────────────────────
    // NULL = 未取得, 空文字 = 取得済みだが字幕なし
    captionText: text('caption_text'),
    captionFetchedAt: text('caption_fetched_at'),
    // ── コーチング判定 ─────────────────────────────────────────────
    // 1 = コーチング動画（表示対象）
    // 0 = 偽陽性（非表示）
    isValorantCoaching: integer('is_valorant_coaching').notNull().default(1),
    // ── コーチング種別 ─────────────────────────────────────────────
    // 'individual' = 個人コーチング（デフォルト）
    // 'team'       = チーム・複数人コーチング
    coachingType: text('coaching_type').notNull().default('individual'),
    // ── AIタグ付け状態 ─────────────────────────────────────────────
    // 'pending'     → 収集済み・LLM未処理
    // 'in_progress' → LLM処理中
    // 'complete'    → LLM処理完了（タグの有無はmap/agent/rankフィールドで判断）
    // 'skipped'     → regexで全フィールド埋まったためLLM不要
    // 'failed'      → エラーで失敗（要再試行）
    aiTaggingStatus: text('ai_tagging_status').notNull().default('pending'),
    aiTaggedAt: text('ai_tagged_at'),
    // ── LLM reasoning ─────────────────────────────────────────────
    // JSON: { captionLLM?: string, thumbnailLLM?: string }
    llmReasoning: text('llm_reasoning'),
    // ── レビュー管理 ───────────────────────────────────────────────
    // 1 = LLMが低〜中信頼度で抽出したフィールドあり（手動確認推奨）
    // 0 = 全フィールド high confidence または null
    reviewNeeded: integer('review_needed').notNull().default(0),
    // ── システム ───────────────────────────────────────────────────
    syncedAt: text('synced_at').notNull(),
    updatedAt: text('updated_at').notNull(),
}, (table) => [
    index('idx_videos_map').on(table.map),
    index('idx_videos_agent').on(table.agent),
    index('idx_videos_rank').on(table.rank),
    index('idx_videos_channel').on(table.channelId),
    index('idx_videos_ai_status').on(table.aiTaggingStatus),
    index('idx_videos_published').on(table.publishedAt),
    index('idx_videos_review').on(table.reviewNeeded),
]);
export const aiTaggingJobs = sqliteTable('ai_tagging_jobs', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    videoId: text('video_id')
        .notNull()
        .references(() => videos.id),
    tier: text('tier').notNull(), // 'caption_llm' | 'thumbnail_llm'
    status: text('status').notNull().default('queued'), // 'queued'|'running'|'done'|'failed'
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    errorMessage: text('error_message'),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
});
export const tagCorrectionRequests = sqliteTable('tag_correction_requests', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    videoId: text('video_id')
        .notNull()
        .references(() => videos.id),
    suggestedMap: text('suggested_map'),
    suggestedAgent: text('suggested_agent'),
    suggestedRank: text('suggested_rank'),
    note: text('note'),
    // 'pending' | 'resolved' | 'dismissed'
    status: text('status').notNull().default('pending'),
    createdAt: text('created_at').notNull(),
});
