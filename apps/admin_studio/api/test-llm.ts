/**
 * LLM 動作確認スクリプト
 *
 * 使い方:
 *   pnpm --filter admin_studio-api test:gemma
 *   pnpm --filter admin_studio-api test:gemini
 *   pnpm --filter admin_studio-api test:anthropic
 *
 * TEST_VIDEOS に検証したい YouTube 動画 ID を追加してください。
 * expected は省略可能（undefined にすると「比較なし」で結果だけ表示）。
 */
import { mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { analyzeThumbnail } from './src/extractors/thumbnailExtractor.js';
import { fetchThumbnailAsBase64 } from './src/extractors/thumbnailShared.js';
import { sampleGameplayFrames } from './src/extractors/frameSampler.js';
import { sampleGameplayFramesLocal } from './src/extractors/frameSamplerLocal.js';
import type { LLMProvider } from './src/extractors/types.js';

const IMAGES_DIR = resolve('./tmp-images');

/** yt-dlp → CDN の順でフレームを取得する */
async function getFrames(videoId: string) {
  const local = await sampleGameplayFramesLocal(videoId);
  if (local.length > 0) return { frames: local, source: 'yt-dlp' as const };
  const cdn = await sampleGameplayFrames(videoId);
  return { frames: cdn, source: 'cdn' as const };
}

async function saveImages(videoId: string, frames: Awaited<ReturnType<typeof getFrames>>['frames'], source: string): Promise<void> {
  const dir = resolve(IMAGES_DIR, videoId);
  mkdirSync(dir, { recursive: true });

  const { imageData } = await fetchThumbnailAsBase64(videoId);
  if (imageData) {
    const ext = imageData.mediaType.split('/')[1] ?? 'jpg';
    writeFileSync(resolve(dir, `thumbnail.${ext}`), Buffer.from(imageData.base64, 'base64'));
  }

  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const ext = f.mediaType.split('/')[1] ?? 'jpg';
    writeFileSync(resolve(dir, `frame${i + 1}_${Math.round(f.position * 100)}pct.${ext}`), Buffer.from(f.base64, 'base64'));
  }

  console.log(`  画像保存: ${dir}/ (thumbnail + ${frames.length} frames [${source}])`);
}

interface TestCase {
  label: string;
  videoId: string;
  expected?: {
    map?: string | null;
    agent?: string | null;
    rank?: string | null;
  };
}

const TEST_VIDEOS: TestCase[] = [
  // ── ここに検証用の動画を追加してください ────────────────────────────────

  {
    label: 'テスト1',
    videoId: '033YQXlm1j0',
    expected: { map: 'Haven', agent: 'Jett', rank: 'Silver' },
  },

  // {
  //   label: 'テスト2',
  //   videoId: 'ICCuYEPLy3w',
  //   expected: { map: 'Haven', agent: 'Sova', rank: 'Diamond' },
  // },

  // ─────────────────────────────────────────────────────────────────────────
];

// ── helpers ──────────────────────────────────────────────────────────────────

const GREEN  = '\x1b[32m';
const RED    = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET  = '\x1b[0m';

function mark(actual: string | null | undefined, expected: string | null | undefined): string {
  if (expected === undefined) return String(actual ?? 'null');
  if (actual === expected) return `${GREEN}${actual ?? 'null'} ✓${RESET}`;
  return `${RED}${actual ?? 'null'} ✗ (expected: ${expected ?? 'null'})${RESET}`;
}

const VALID_PROVIDERS: LLMProvider[] = ['gemma', 'gemini', 'anthropic'];

// ── main ─────────────────────────────────────────────────────────────────────

async function main() {
  const providerArg = process.argv[2] ?? 'gemma';
  if (!VALID_PROVIDERS.includes(providerArg as LLMProvider)) {
    console.error(`不正なプロバイダー: "${providerArg}". 使用可能: ${VALID_PROVIDERS.join(', ')}`);
    process.exit(1);
  }
  const provider = providerArg as LLMProvider;

  const envKey = provider === 'anthropic' ? 'ANTHROPIC_API_KEY' : 'GEMINI_API_KEY';
  const apiKey = process.env[envKey] ?? '';
  if (!apiKey) {
    console.error(`${envKey} が設定されていません`);
    process.exit(1);
  }

  console.log(`provider: ${YELLOW}${provider}${RESET}\n`);

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  for (const tc of TEST_VIDEOS) {
    if (tc.videoId.startsWith('REPLACE_ME')) {
      console.log(`${YELLOW}[SKIP]${RESET} ${tc.label} (videoId 未設定)`);
      skipped++;
      continue;
    }

    console.log(`${'─'.repeat(60)}`);
    console.log(`[${tc.label}] https://www.youtube.com/watch?v=${tc.videoId}`);

    try {
      const { frames, source } = await getFrames(tc.videoId);
      await saveImages(tc.videoId, frames, source);
      console.log(`  frames: ${frames.length} [${source}]`);
      const res = await analyzeThumbnail(tc.videoId, apiKey, provider, undefined, () => Promise.resolve(frames));

      if (!res.result) {
        console.log(`  ${RED}失敗: サムネイル取得不可 (${res.failReason})${RESET}`);
        failed++;
        continue;
      }

      const r = res.result;
      console.log(`  map   : ${mark(r.map,   tc.expected?.map)}   [${r.map_confidence}]`);
      console.log(`  agent : ${mark(r.agent, tc.expected?.agent)} [${r.agent_confidence}]`);
      console.log(`  rank  : ${mark(r.rank,  tc.expected?.rank)}  [${r.rank_confidence}]`);
      console.log(`  reasoning: ${r.reasoning}\n`);

      if (tc.expected !== undefined) {
        const ok =
          (tc.expected.map   === undefined || r.map   === tc.expected.map)   &&
          (tc.expected.agent === undefined || r.agent === tc.expected.agent)  &&
          (tc.expected.rank  === undefined || r.rank  === tc.expected.rank);
        ok ? passed++ : failed++;
      }
    } catch (err) {
      console.log(`  ${RED}エラー: ${err}${RESET}\n`);
      failed++;
    }
    //await new Promise(resolve => setTimeout(resolve, 60000));  // API連打を避けるため少し待機
  }

  console.log(`${'═'.repeat(60)}`);
  console.log(`結果: ${GREEN}${passed} passed${RESET} / ${RED}${failed} failed${RESET} / ${YELLOW}${skipped} skipped${RESET}`);
}

main();
