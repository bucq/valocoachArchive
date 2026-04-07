/**
 * thumbnailExtractor.ts — Workers 対応版
 *
 * frameSamplerLocal (yt-dlp/ffmpeg) は Workers 非対応のため除外。
 * CDN 版 frameSampler のみ使用。
 */
import { type FrameImageData, sampleGameplayFrames } from './frameSampler';
import { analyzeThumbnailAnthropic } from './thumbnailAnthropic';
import { analyzeThumbnailGemini, analyzeThumbnailGemmaStepwise } from './thumbnailGemini';
import { fetchThumbnailAsBase64, type ThumbnailFetchFailReason } from './thumbnailShared';
import type { LLMExtractionResult, LLMProvider } from './types';

type FrameSampler = (videoId: string) => Promise<FrameImageData[]>;

export type { ThumbnailFetchFailReason };

export interface ThumbnailAnalyzeResult {
  result: LLMExtractionResult | null;
  failReason?: ThumbnailFetchFailReason;
}

export async function analyzeThumbnail(
  videoId: string,
  apiKey: string,
  provider: LLMProvider = 'gemma',
  title?: string,
  frameSampler: FrameSampler = sampleGameplayFrames,
): Promise<ThumbnailAnalyzeResult> {
  const { imageData, failReason } = await fetchThumbnailAsBase64(videoId);
  if (!imageData) return { result: null, failReason };

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
