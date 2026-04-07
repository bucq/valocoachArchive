import { getAllCatalogsLabeled } from './catalogLoader';
import type { FrameImageData } from './frameSampler';
import { buildAnalysisPrompt, type ImageData } from './thumbnailShared';
import type { LLMExtractionResult } from './types';
import { AGENT_LABELS, MAP_LABELS, RANK_LABELS } from './valorant';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

// ── Anthropic (Claude Haiku Vision) ──────────────────────────────────────────

export async function analyzeThumbnailAnthropic(
  imageData: ImageData,
  frames: FrameImageData[],
  apiKey: string,
  title?: string,
): Promise<LLMExtractionResult | null> {
  const catalogs = getAllCatalogsLabeled();

  // カタログ画像をインラインで並べる
  const catalogContent: object[] = [];
  let currentCategory = '';
  for (const cat of catalogs) {
    if (cat.category !== currentCategory) {
      currentCategory = cat.category;
      catalogContent.push({ type: 'text', text: `[${cat.category}]` });
    }
    catalogContent.push({ type: 'text', text: `${cat.name}:` });
    catalogContent.push({
      type: 'image',
      source: { type: 'base64', media_type: cat.mediaType, data: cat.base64 },
    });
  }

  const body = {
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [buildAnthropicTool()],
    tool_choice: { type: 'tool', name: 'extract_valorant_metadata' },
    messages: [
      {
        role: 'user',
        content: [...catalogContent, ...buildPerRequestContent(imageData, frames, title)],
      },
    ],
  };

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error(`[thumbnailLLM/anthropic] ${res.status}: ${errText}`);
      throw new Error(`Anthropic API error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as {
      content: Array<{ type: string; name?: string; input?: LLMExtractionResult }>;
    };
    const toolUse = data.content.find(
      (b) => b.type === 'tool_use' && b.name === 'extract_valorant_metadata',
    );
    return toolUse?.input ?? null;
  } catch (err) {
    console.error('[thumbnailLLM/anthropic] error:', err);
    return null;
  }
}

// ── Parts builder ─────────────────────────────────────────────────────────────

/**
 * Anthropic per-request コンテンツ（サムネイル + フレーム + プロンプト）。
 */
function buildPerRequestContent(
  imageData: ImageData,
  frames: FrameImageData[],
  title?: string,
): object[] {
  const content: object[] = [];

  content.push({ type: 'text', text: '--- 分析対象 START ---' });
  content.push({ type: 'text', text: '[THUMBNAIL] サムネイル画像（エージェント・ランク判定用）:' });
  content.push({
    type: 'image',
    source: { type: 'base64', media_type: imageData.mediaType, data: imageData.base64 },
  });

  if (frames.length > 0) {
    content.push({
      type: 'text',
      text: `[GAMEPLAY FRAMES] ゲームプレイフレーム ${frames.length} 枚（マップ判定用）:`,
    });
    for (const frame of frames) {
      content.push({
        type: 'text',
        text: `フレーム（動画内 ${Math.round(frame.position * 100)}% 地点）:`,
      });
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: frame.mediaType, data: frame.base64 },
      });
    }
  }

  content.push({ type: 'text', text: buildAnalysisPrompt(title) });
  return content;
}

// ── Tool definition ───────────────────────────────────────────────────────────

function buildAnthropicTool() {
  return {
    name: 'extract_valorant_metadata',
    description:
      'Extract Valorant game metadata from the thumbnail and gameplay frames. Evaluate each field independently.',
    input_schema: {
      type: 'object',
      properties: {
        map: { type: ['string', 'null'], enum: [...MAP_LABELS, null] },
        agent: { type: ['string', 'null'], enum: [...AGENT_LABELS, null] },
        rank: { type: ['string', 'null'], enum: [...RANK_LABELS, null] },
        map_confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Confidence for map field only.',
        },
        agent_confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Confidence for agent field only.',
        },
        rank_confidence: {
          type: 'string',
          enum: ['high', 'medium', 'low'],
          description: 'Confidence for rank field only.',
        },
        reasoning: {
          type: 'string',
          description: 'Brief explanation of visual cues used for each field.',
        },
      },
      required: [
        'map',
        'agent',
        'rank',
        'map_confidence',
        'agent_confidence',
        'rank_confidence',
        'reasoning',
      ],
    },
  };
}
