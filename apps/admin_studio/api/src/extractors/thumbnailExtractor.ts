import type { LLMExtractionResult, LLMProvider } from './types';
import { sampleGameplayFrames, type FrameImageData } from './frameSampler';
import { fetchThumbnailAsBase64, type ThumbnailFetchFailReason } from './thumbnailShared';
import { analyzeThumbnailGemini, analyzeThumbnailGemma, analyzeThumbnailGemmaStepwise } from './thumbnailGemini';
import { analyzeThumbnailAnthropic } from './thumbnailAnthropic';

type FrameSampler = (videoId: string) => Promise<FrameImageData[]>;

// ── Public types ──────────────────────────────────────────────────────────────

export type { ThumbnailFetchFailReason };

export interface ThumbnailAnalyzeResult {
  result: LLMExtractionResult | null;
  failReason?: ThumbnailFetchFailReason;
}

// ── Entry point ───────────────────────────────────────────────────────────────

/**
 * Tier 3: サムネイル＋ゲームプレイフレームからValorantメタデータを抽出する。
 *
 * Gemini (推奨):
 *   - カタログ80枚を Context Cache に登録し、リクエストごとの画像コストを削減
 *   - サムネイル1枚でAgent/Rank判定
 *   - ゲームプレイフレーム最大3枚のミニマップでMap判定（多数決）
 *
 * Anthropic:
 *   - カタログ画像をインラインで送信（キャッシュなし）
 *   - サムネイル＋フレームを同一リクエストで送信
 */
export async function analyzeThumbnail(
  videoId: string,
  apiKey: string,
  provider: LLMProvider = 'gemma',
  title?: string,
  frameSampler: FrameSampler = sampleGameplayFrames,
): Promise<ThumbnailAnalyzeResult> {
  const { imageData, failReason } = await fetchThumbnailAsBase64(videoId);
  if (!imageData) return { result: null, failReason };

  // ゲームプレイフレームを取得（失敗しても続行）
  const frames = await frameSampler(videoId);
  console.log(`[thumbnailLLM] videoId=${videoId} frames=${frames.length}`);

  if (provider === 'gemini') {
    return { result: await analyzeThumbnailGemini(videoId, imageData, frames, apiKey, title) };
  }
  if (provider === 'gemma') {
    return { result: await analyzeThumbnailGemmaStepwise(imageData, frames, apiKey, title) };
  }
  return { result: await analyzeThumbnailAnthropic(imageData, frames, apiKey, title) };
}
