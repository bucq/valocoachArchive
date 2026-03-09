/**
 * yt-dlp + ffmpeg を使ったローカルフレームサンプラー。
 *
 * CDN方式（frameSampler.ts）と異なり、動画の正確な位置からフレームを抽出できる。
 * admin_studio ローカル環境専用（Workers 非対応）。
 *
 * 前提条件:
 *   brew install yt-dlp ffmpeg
 */
import { execFile } from 'child_process';
import type { FrameImageData } from './frameSampler.js';

/** 0.25〜0.95 を均等分割した 10 点（ミニマップクロップ用） */
const MINIMAP_POSITIONS = Array.from({ length: 10 }, (_, i) => 0.25 + (i / 9) * 0.70);
/** ミニマップ10点のうち等間隔3点（全体フレーム用: 25% / 61% / 95%） */
const FULL_POSITIONS = [MINIMAP_POSITIONS[0]!, MINIMAP_POSITIONS[4]!, MINIMAP_POSITIONS[9]!];
/** Valorant ミニマップは左上隅に表示（720p基準で約400×400px） */
const MINIMAP_CROP = 'crop=400:400:0:0';

/**
 * videoId の動画から 10 フレームを抽出する。
 * yt-dlp / ffmpeg が未インストールの場合は空配列を返す（CDN方式へフォールバック可能）。
 */
export async function sampleGameplayFramesLocal(videoId: string): Promise<FrameImageData[]> {
  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Step 1+2: duration と stream URL を1回の yt-dlp 呼び出しで取得（-j でJSON出力）
  let duration: number;
  let streamUrl: string;
  try {
    const stdout = await execFileText('yt-dlp', [
      '-j',
      '-f', 'best[height<=720][ext=mp4]/best[height<=720]/best',
      '--no-playlist',
      ytUrl,
    ]);

    const info = JSON.parse(stdout) as { duration?: number; url?: string };
    duration = info.duration ?? 0;
    streamUrl = info.url ?? '';

    if (!duration || isNaN(duration)) {
      console.warn('[frameSamplerLocal] invalid duration:', duration);
      return [];
    }
    if (!streamUrl) {
      console.warn('[frameSamplerLocal] empty stream URL');
      return [];
    }
  } catch (err) {
    console.warn('[frameSamplerLocal] yt-dlp failed:', String(err).slice(0, 200));
    return [];
  }

  console.log(`[frameSamplerLocal] duration=${duration}s`);

  // Step 3: minimap クロップ×10 + 全体フレーム×3 を並列抽出
  const results = await Promise.allSettled([
    ...MINIMAP_POSITIONS.map(p => extractFrame(streamUrl, duration, p, 'minimap', MINIMAP_CROP)),
    ...FULL_POSITIONS.map(p => extractFrame(streamUrl, duration, p, 'full')),
  ]);

  const frames: FrameImageData[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      frames.push(result.value);
    }
  }

  return frames;
}

async function extractFrame(
  streamUrl: string,
  duration: number,
  position: number,
  frameType: 'minimap' | 'full',
  cropFilter?: string,
): Promise<FrameImageData | null> {
  const timestamp = Math.floor(duration * position);
  const ffmpegArgs = [
    '-ss', String(timestamp),   // 入力前シーク（高速）
    '-i', streamUrl,
    '-vframes', '1',
    ...(cropFilter ? ['-vf', cropFilter] : []),
    '-f', 'image2pipe',
    '-vcodec', 'mjpeg',
    '-q:v', '3',                // JPEG品質（1=最高, 31=最低）
    'pipe:1',
  ];
  try {
    const buf = await execFileBuffer('ffmpeg', ffmpegArgs);

    if (buf.byteLength > 5_000) {
      console.log(`[frameSamplerLocal] ${frameType} ${Math.round(position * 100)}% (${timestamp}s): ${Math.round(buf.byteLength / 1024)}KB`);
      return { base64: buf.toString('base64'), mediaType: 'image/jpeg', position, frameType };
    }
    return null;
  } catch (err) {
    console.warn(`[frameSamplerLocal] ffmpeg failed at ${timestamp}s (${frameType}):`, String(err).slice(0, 200));
    return null;
  }
}

function execFileText(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'utf8', timeout: 30_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout as string);
    });
  });
}

function execFileBuffer(cmd: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024, timeout: 30_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout as Buffer);
    });
  });
}
