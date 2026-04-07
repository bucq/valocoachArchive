/**
 * thumbnailExtractor.ts — Workers 対応版
 *
 * frameSamplerLocal (yt-dlp/ffmpeg) は Workers 非対応のため除外。
 * CDN 版 frameSampler のみ使用。
 */
import { sampleGameplayFrames } from './frameSampler';
import { analyzeThumbnailAnthropic } from './thumbnailAnthropic';
import { analyzeThumbnailGemini, analyzeThumbnailGemmaStepwise } from './thumbnailGemini';
import { fetchThumbnailAsBase64 } from './thumbnailShared';
export async function analyzeThumbnail(videoId, apiKey, provider = 'gemma', title, frameSampler = sampleGameplayFrames) {
    const { imageData, failReason } = await fetchThumbnailAsBase64(videoId);
    if (!imageData)
        return { result: null, failReason };
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
