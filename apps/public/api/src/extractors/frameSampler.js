/**
 * YouTube 動画からゲームプレイフレームをサンプリングする（CDN版）。
 * fetch のみ使用 — Cloudflare Workers 対応。
 *
 * YouTube の自動サムネイル候補:
 *   index 1 → 約 25% 地点
 *   index 2 → 約 50% 地点（中盤）
 *   index 3 → 約 75% 地点（後半）
 */
const MIN_VALID_BYTES = 5_000;
const SAMPLE_POSITIONS = [0.25, 0.5, 0.75];
export async function sampleGameplayFrames(videoId) {
    const indices = [1, 2, 3];
    const results = await Promise.allSettled(indices.map((idx, i) => fetchFrameAtIndex(videoId, idx, SAMPLE_POSITIONS[i])));
    const frames = [];
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
            frames.push(r.value);
        }
    }
    return frames;
}
async function fetchFrameAtIndex(videoId, index, position) {
    const url = `https://img.youtube.com/vi/${videoId}/${index}.jpg`;
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
            if (!res.ok)
                return null;
            const buf = await res.arrayBuffer();
            if (buf.byteLength < MIN_VALID_BYTES)
                return null;
            return {
                base64: arrayBufferToBase64(buf),
                mediaType: res.headers.get('content-type') ?? 'image/jpeg',
                position,
                frameType: 'full',
            };
        }
        catch {
            if (attempt < 1)
                await new Promise((r) => setTimeout(r, 300));
        }
    }
    return null;
}
function arrayBufferToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunk = 8192;
    for (let i = 0; i < bytes.byteLength; i += chunk) {
        binary += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
    }
    return btoa(binary);
}
