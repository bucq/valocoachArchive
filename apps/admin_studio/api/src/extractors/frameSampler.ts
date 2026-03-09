/**
 * YouTube 動画からゲームプレイフレームをサンプリングする。
 *
 * YouTube は動画を処理する際に自動サムネイル候補を生成し、以下の URL で公開する:
 *   https://img.youtube.com/vi/{videoId}/0.jpg  ← 動画序盤（企画紹介が多い → スキップ）
 *   https://img.youtube.com/vi/{videoId}/1.jpg  ← 約 25% 地点
 *   https://img.youtube.com/vi/{videoId}/2.jpg  ← 約 50% 地点（中盤）
 *   https://img.youtube.com/vi/{videoId}/3.jpg  ← 約 75% 地点（後半）
 *
 * マップはゲームプレイ画面の左上ミニマップから識別する。
 * Workers 環境では画像のクロップ/回転が困難なため、フレーム全体を LLM に渡し、
 * プロンプトで「左上ミニマップに注目せよ」と指示する。
 * LLM 側でミニマップの回転差（0°/90°/180°/270°）も考慮するよう促す。
 *
 * 取得は並列で行い、プレースホルダ（< 5KB）は除外する。
 */

export interface FrameImageData {
  base64: string;
  mediaType: string;
  /** 動画内の相対位置（0〜1）—デバッグ用 */
  position: number;
  /** minimap: 左上クロップ済み（マップ判定用）/ full: 全体フレーム（HUD テキスト判定用） */
  frameType: 'minimap' | 'full';
}

/** プレースホルダ判定の最小バイト数（5 KB 以下は無効） */
const MIN_VALID_BYTES = 5_000;

/** 取得するフレームの相対位置。0.0（序盤）はスキップし中盤〜後半を優先。 */
const SAMPLE_POSITIONS = [0.25, 0.5, 0.75];

/**
 * 動画 ID から実際のゲームプレイフレームを最大 3 枚取得する。
 * フレームが取得できない場合は空配列を返す（呼び出し元でフォールバック）。
 */
export async function sampleGameplayFrames(videoId: string): Promise<FrameImageData[]> {
  // index 1, 2, 3 → 約 25%, 50%, 75%（0 は序盤スキップ）
  const indices = [1, 2, 3];
  const positions = SAMPLE_POSITIONS;

  const results = await Promise.allSettled(
    indices.map((idx, i) => fetchFrameAtIndex(videoId, idx, positions[i]!)),
  );

  const frames: FrameImageData[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      frames.push(r.value);
    }
  }

  return frames;
}

async function fetchFrameAtIndex(
  videoId: string,
  index: number,
  position: number,
): Promise<FrameImageData | null> {
  const url = `https://img.youtube.com/vi/${videoId}/${index}.jpg`;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return null;

      const buf = await res.arrayBuffer();
      if (buf.byteLength < MIN_VALID_BYTES) return null; // プレースホルダ

      return {
        base64: arrayBufferToBase64(buf),
        mediaType: res.headers.get('content-type') ?? 'image/jpeg',
        position,
        frameType: 'full',
      };
    } catch {
      if (attempt < 1) await new Promise(r => setTimeout(r, 300));
    }
  }
  return null;
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 8192;
  for (let i = 0; i < bytes.byteLength; i += chunk) {
    binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}
