import {
  getAgentPortraitImages,
  getAllCatalogsLabeled,
  getCatalogGrids,
  getMapDisplayImages,
  getRankCatalogImages,
  type LabeledCatalogEntry,
} from './catalogLoader';
import type { FrameImageData } from './frameSampler';
import { buildAnalysisPrompt, type ImageData } from './thumbnailShared';
import type { LLMExtractionResult } from './types';
import { AGENT_LABELS, MAP_LABELS, RANK_LABELS } from './valorant';

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Gemini Context Caching に対応したモデル名（versioned）。
 * generateContent API ではサフィックスなしでも動くが、
 * cachedContent 作成時は versioned 名が必要。
 */
// const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';
// const GEMINI_MODEL = 'gemini-3-flash-preview';

const GEMMA_MODEL = 'gemma-3-27b-it';

/** 個別画像で送るカテゴリ（MAP_SCENE・AGENT_ICON は除外、AGENT_PORTRAIT のみ採用） */
const INDIVIDUAL_CATEGORIES = new Set(['MAP_MINIMAP' /*, 'AGENT_PORTRAIT'*/]);
/** グリッド画像で送るカテゴリ（RANK は25枚→1枚に圧縮） */
const GRID_CATEGORIES = new Set(['RANK_GRID', 'AGENT_PORTRAIT_GRID']);

function buildCatalogs(): LabeledCatalogEntry[] {
  return [
    ...getAllCatalogsLabeled().filter((c) => INDIVIDUAL_CATEGORIES.has(c.category)),
    ...getCatalogGrids().filter((g) => GRID_CATEGORIES.has(g.category)),
  ];
}

// ── Gemini (Context Cache + Frames) ──────────────────────────────────────────

export async function analyzeThumbnailGemini(
  _videoId: string,
  imageData: ImageData,
  frames: FrameImageData[],
  apiKey: string,
  title?: string,
): Promise<LLMExtractionResult | null> {
  const catalogs = buildCatalogs();

  // // Context Cache を取得（失敗時は null → インライン fallback）
  // const cacheName = await getOrCreateCatalogCache(apiKey, GEMINI_MODEL, catalogs);

  // // キャッシュあり：catalog 画像は省略し、per-request の画像のみ送る
  // if (cacheName) {
  //   return analyzeThumbnailGeminiCached(cacheName, imageData, frames, apiKey, title);
  // }

  // // fallback: カタログをインラインで送信（キャッシュ作成失敗時）
  // console.warn('[thumbnailLLM/gemini] cache unavailable, using inline catalogs');
  return analyzeThumbnailGeminiInline(catalogs, imageData, frames, apiKey, title);
}

/** インライン fallback（カタログ画像をそのまま送信） */
async function analyzeThumbnailGeminiInline(
  catalogs: LabeledCatalogEntry[],
  imageData: ImageData,
  frames: FrameImageData[],
  apiKey: string,
  title?: string,
): Promise<LLMExtractionResult | null> {
  const catalogParts: object[] = [{ text: 'これらはリファレンスカタログです。' }];
  let currentCategory = '';
  for (const cat of catalogs) {
    if (cat.category !== currentCategory) {
      currentCategory = cat.category;
      catalogParts.push({ text: `[${cat.category}]` });
    }
    catalogParts.push({ text: `${cat.name}:` });
    catalogParts.push({ inline_data: { mime_type: cat.mediaType, data: cat.base64 } });
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent`;
  const body = {
    system_instruction: {
      parts: [
        {
          text: 'あなたはValorantのeスポーツアナリストです。最初にリファレンスカタログ画像が提供され、その後に分析対象の画像が続きます。',
        },
      ],
    },
    contents: [
      {
        parts: [...catalogParts, ...buildPerRequestParts(imageData, frames, title)],
      },
    ],
    generationConfig: buildGenerationConfig(),
  };

  return callGeminiApi(url, apiKey, body);
}

// ── Gemma (Non-cache, Non-JSON-Schema) ──────────────────────────────────────

export async function analyzeThumbnailGemma(
  imageData: ImageData,
  frames: FrameImageData[],
  apiKey: string,
  title?: string,
): Promise<LLMExtractionResult | null> {
  // Gemma 3 27B は画像数制限 (32) があるため、個別画像ではなくタイル状のグリッド画像を使用する
  const grids = getCatalogGrids();

  const catalogParts: object[] = [{ text: 'リファレンスカタログ（グリッド一覧）:' }];
  for (const grid of grids) {
    catalogParts.push({ text: `[${grid.category}]` });
    catalogParts.push({ inline_data: { mime_type: grid.mediaType, data: grid.base64 } });
  }

  const url = `${GEMINI_BASE_URL}/${GEMMA_MODEL}:generateContent`;
  const body = {
    contents: [
      {
        parts: [
          ...catalogParts,
          ...buildPerRequestParts(imageData, frames, title),
          {
            text: `
分析対象の画像（サムネイルとプレイ中のフレーム）を、上記のカタロググリッド画像と比較して、マップ・エージェント・ランクを特定してください。
重要: 結果は必ず以下のJSON形式でのみ出力してください。説明や装飾（\`\`\`json 等）は一切不要です。
JSON Format: {"map": string|null, "agent": string|null, "rank": string|null, "coaching_type": "individual"|"team", "map_confidence": "high"|"medium"|"low", "agent_confidence": "high"|"medium"|"low", "rank_confidence": "high"|"medium"|"low", "reasoning": string}`,
          },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 8192 },
  };

  return callGeminiApi(url, apiKey, body);
}

// ── Gemma Stepwise (map / agent / rank を並列で別リクエスト) ───────────────────

/**
 * Gemma 3 27B の32枚制限を回避するため、map/agent/rank を独立リクエストで並列推論する。
 * 各ステップで必要なカタログ画像のみ送信するため、グリッド圧縮不要。
 */
export async function analyzeThumbnailGemmaStepwise(
  imageData: ImageData,
  frames: FrameImageData[],
  apiKey: string,
  title?: string,
): Promise<LLMExtractionResult | null> {
  const minimapFrames = frames.filter((f) => f.frameType === 'minimap');
  const fullFrames = frames.filter((f) => f.frameType === 'full');

  const [mapResult, agentResult, rankResult] = await Promise.all([
    inferStepMap(minimapFrames, apiKey),
    inferStepAgent(imageData, apiKey, title),
    inferStepRank(imageData, fullFrames, apiKey),
  ]);

  if (!mapResult && !agentResult && !rankResult) return null;

  return {
    map: mapResult?.value ?? null,
    agent: agentResult?.value ?? null,
    rank: rankResult?.value ?? null,
    coaching_type: agentResult?.coaching_type ?? 'individual',
    map_confidence: mapResult?.confidence ?? 'low',
    agent_confidence: agentResult?.confidence ?? 'low',
    rank_confidence: rankResult?.confidence ?? 'low',
    reasoning: [mapResult?.reasoning, agentResult?.reasoning, rankResult?.reasoning]
      .filter(Boolean)
      .join(' | '),
  };
}

interface StepResult {
  value: string | null;
  confidence: 'high' | 'medium' | 'low';
  coaching_type?: 'individual' | 'team';
  reasoning: string;
}

async function inferStepMap(
  minimapFrames: FrameImageData[],
  apiKey: string,
): Promise<StepResult | null> {
  const mapImages = getMapDisplayImages();
  const parts: object[] = [{ text: 'マップミニマップカタログ（ゲーム左上表示と比較用）:' }];
  for (const img of mapImages) {
    parts.push({ text: `${img.name}:` });
    parts.push({ inline_data: { mime_type: img.mediaType, data: img.base64 } });
  }
  parts.push({
    text: `[MINIMAP FRAMES] ゲームプレイ中のミニマップクロップ ${minimapFrames.length} 枚:`,
  });
  for (const frame of minimapFrames) {
    parts.push({ text: `${Math.round(frame.position * 100)}%:` });
    parts.push({ inline_data: { mime_type: frame.mediaType, data: frame.base64 } });
  }
  parts.push({
    text: `上記のミニマップクロップ画像をカタログと比較してマップを特定してください。
事前知識ではなく、提供されたカタログ画像との視覚的照合のみを根拠にしてください。カタログに含まれるマップ名のみを回答候補とし、カタログにない名前は使用しないでください。

ミニマップはプレイヤーの向きに応じて回転しています（0°/90°/180°/270°の可能性）。
各フレームのミニマップ候補を個別に列挙し、最も多く一致したマップを最終回答とする（多数決）。
真っ暗・ロード画面・スコアボード等でミニマップが見えないフレームは無視してください。
スケール・回転の違いを考慮しつつ、廊下や部屋の接続パターンで識別してください。

各マップのミニマップ形状の特徴:
VALORANT マップ判別フロー：幾何学アルゴリズム
ステップ1：マクロ構造（対称性と中心部）の確認
まず、マップの全体的な「枠組み」を見て、特殊な2マップを排除します。
【完全な対称性】があるか？
Yes: Corrode と判定。中央の円形を軸に、左右または上下が鏡合わせの図形。
【中央が空洞】のH型か？
Yes: Fracture と判定。中心部に描画がなく、4つの角に構造が分散している。
ステップ2：サイト数（黄色いエリア）のカウント
次に、設置場所を示す「黄色い四角」の数を数えます。
【サイトが3つ】あるか？
直線的・箱型の組み合わせなら: Haven と判定。通路が直角で構成されている。
曲線的・円形のジャンクションがあるなら: Lotus と判定。通路が弧を描いており、円形の回転扉エリアがある。
ステップ3：固有の図形的シグネチャー（2サイトマップの絞り込み）
サイトが2つの場合、以下の「形状の指紋」を探します。
【中央に巨大な正方形の空白】があるか？
Yes: Ascent と判定。最も標準的な「田の字」に近い格子状レイアウト。
【外周に本体と離れた細い線】があるか？
Yes: Bind と判定。マップ中央に通路がなく、外側を回るテレポーターのラインが特徴。
【Aサイト内に2つの円】と【中央の巨大なひし形】があるか？
Yes: Breeze と判定。全マップで最も白い余白部分（広場）の面積が広い。
【外周がギザギザに欠けている】か？
Yes: Abyss と判定。マップの縁が直線ではなく、落下ポイントを示すために不規則に削り取られたようなネガティブスペースがある。
【右下に長く折れ曲がったクランク】があるか？
Yes: Icebox と判定。全体が「L字」に近く、一箇所だけ複雑なジグザグの細長い通路（Bサイト）が突き出している。
【左側に極端に長い直線】があるか？
Yes: Pearl と判定。マップ左端を貫く長い廊下（Bロング）があり、中央部は非常に細かく入り組んだ多角形の集合体。
【縦長で中央に細い橋型の通路】があるか？
Yes: Split と判定。縦方向に細長く、中段に細い橋（ロープ）が渡された2段構造。
上記のどれにも当てはまらない場合: Sunset と判定。Ascentに似た格子状だが、ミッドが単純な1本道。

重要: 結果は必ず以下のJSON形式でのみ出力してください。
JSON Format: {"value": string|null, "confidence": "high"|"medium"|"low", "reasoning": string}
value は以下から選択: ${MAP_LABELS.join(', ')}, または null`,
  });

  const url = `${GEMINI_BASE_URL}/${GEMMA_MODEL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };
  return callGeminiStepApi(url, apiKey, body, 'map');
}

async function inferStepAgent(
  imageData: ImageData,
  apiKey: string,
  title?: string,
): Promise<StepResult | null> {
  const agentImages = getAgentPortraitImages();
  const parts: object[] = [{ text: 'エージェント全身像カタログ:' }];
  for (const img of agentImages) {
    parts.push({ text: `${img.name}:` });
    parts.push({ inline_data: { mime_type: img.mediaType, data: img.base64 } });
  }
  parts.push({ text: '[THUMBNAIL] サムネイル画像:' });
  parts.push({ inline_data: { mime_type: imageData.mediaType, data: imageData.base64 } });
  if (title) parts.push({ text: `動画タイトル: ${title}` });
  parts.push({
    text: `サムネイルに写っているエージェントをカタログと比較して特定し、あわせてコーチング種別を判定してください。
coaching_type: タイトルと文脈から「individual」（個人コーチング）または「team」（チーム・複数人コーチング）を判定。「チーム」「スクリム」「team」「5v5」「練習試合」等のキーワードがある場合は "team"。
重要: 結果は必ず以下のJSON形式でのみ出力してください。
JSON Format: {"value": string|null, "confidence": "high"|"medium"|"low", "coaching_type": "individual"|"team", "reasoning": string}
value は以下から選択: ${AGENT_LABELS.join(', ')}, または null`,
  });

  const url = `${GEMINI_BASE_URL}/${GEMMA_MODEL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };
  return callGeminiStepApi(url, apiKey, body, 'agent');
}

async function inferStepRank(
  imageData: ImageData,
  fullFrames: FrameImageData[],
  apiKey: string,
): Promise<StepResult | null> {
  const rankImages = getRankCatalogImages();
  const parts: object[] = [{ text: 'ランクアイコンカタログ（IRON_1〜RADIANT）:' }];
  for (const img of rankImages) {
    parts.push({ text: `${img.name}:` });
    parts.push({ inline_data: { mime_type: img.mediaType, data: img.base64 } });
  }
  parts.push({ text: '[THUMBNAIL] サムネイル画像:' });
  parts.push({ inline_data: { mime_type: imageData.mediaType, data: imageData.base64 } });
  if (fullFrames.length > 0) {
    parts.push({ text: `[GAMEPLAY FRAMES] HUD付き全体フレーム ${fullFrames.length} 枚:` });
    for (const frame of fullFrames) {
      parts.push({ text: `${Math.round(frame.position * 100)}%:` });
      parts.push({ inline_data: { mime_type: frame.mediaType, data: frame.base64 } });
    }
  }
  parts.push({
    text: `サムネイルまたはゲームプレイフレームのHUDに表示されているランクアイコンをカタログと比較して特定してください。
重要: 結果は必ず以下のJSON形式でのみ出力してください。
JSON Format: {"value": string|null, "confidence": "high"|"medium"|"low", "reasoning": string}
value は以下から選択: ${RANK_LABELS.join(', ')}, または null`,
  });

  const url = `${GEMINI_BASE_URL}/${GEMMA_MODEL}:generateContent`;
  const body = {
    contents: [{ parts }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  };
  return callGeminiStepApi(url, apiKey, body, 'rank');
}

async function callGeminiStepApi(
  url: string,
  apiKey: string,
  body: object,
  step: string,
): Promise<StepResult | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemma step[${step}] API error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as GeminiResponse;
    const u = data.usageMetadata;
    if (u) {
      console.log(
        `[thumbnailLLM/gemma-step/${step}] tokens: input=${u.promptTokenCount ?? '?'} output=${u.candidatesTokenCount ?? '?'} total=${u.totalTokenCount ?? '?'}`,
      );
    }
    const rawText = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    if (!rawText) return null;
    const text = extractJsonBlock(
      rawText
        .replace(/```json\n?/, '')
        .replace(/\n?```/, '')
        .trim(),
    );
    const parseStepResult = (parsed: StepResult): StepResult => {
      const conf = parsed.confidence;
      const ct = parsed.coaching_type;
      return {
        value: parsed.value === 'null' ? null : parsed.value || null,
        confidence: conf === 'high' || conf === 'medium' || conf === 'low' ? conf : 'low',
        coaching_type: ct === 'individual' || ct === 'team' ? ct : undefined,
        reasoning: parsed.reasoning ?? '',
      };
    };
    try {
      return parseStepResult(JSON.parse(text) as StepResult);
    } catch {
      const sanitized = sanitizeJsonStrings(text);
      try {
        return parseStepResult(JSON.parse(sanitized) as StepResult);
      } catch (err) {
        console.error(
          `[thumbnailLLM/gemma-step/${step}] JSON parse error:`,
          err,
          rawText.slice(0, 200),
        );
        return null;
      }
    }
  } catch (err) {
    console.error(`[thumbnailLLM/gemma-step/${step}] Request failed:`, err);
    return null;
  }
}

// ── Shared Gemini API caller ──────────────────────────────────────────────────

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    thoughtsTokenCount?: number;
    cachedContentTokenCount?: number;
    totalTokenCount?: number;
  };
}

export async function callGeminiApi(
  url: string,
  apiKey: string,
  body: object,
): Promise<LLMExtractionResult | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }
    const data = (await res.json()) as GeminiResponse;
    const u = data.usageMetadata;
    if (u) {
      const parts = [
        `input=${u.promptTokenCount ?? '?'}`,
        `output=${u.candidatesTokenCount ?? '?'}`,
        u.thoughtsTokenCount ? `thinking=${u.thoughtsTokenCount}` : null,
        u.cachedContentTokenCount ? `cached=${u.cachedContentTokenCount}` : null,
        `total=${u.totalTokenCount ?? '?'}`,
      ]
        .filter(Boolean)
        .join(' ');
      console.log(`[thumbnailLLM/gemini] tokens: ${parts}`);
    }
    const candidate = data.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn(`[thumbnailLLM/gemini] finishReason=${finishReason}`);
    }
    // parts が複数に分割される場合があるため全て結合する
    const parts = candidate?.content?.parts ?? [];
    const rawText = parts.map((p) => p.text ?? '').join('');
    if (!rawText) {
      console.warn('[thumbnailLLM/gemini] No text in candidates:', JSON.stringify(data));
      return null;
    }

    // JSONブロックの抽出（Gemmaなどの非JSONモード用）
    const text = extractJsonBlock(
      rawText
        .replace(/```json\n?/, '')
        .replace(/\n?```/, '')
        .trim(),
    );

    try {
      return normalizeGeminiResult(JSON.parse(text) as LLMExtractionResult);
    } catch {
      // 文字列値内の制御文字をエスケープしてリトライ
      const sanitized = sanitizeJsonStrings(text);
      try {
        return normalizeGeminiResult(JSON.parse(sanitized) as LLMExtractionResult);
      } catch (parseErr) {
        console.error('[thumbnailLLM/gemini] JSON parse error:', parseErr);
        console.error('[thumbnailLLM/gemini] Raw text from LLM:', text);
        throw parseErr;
      }
    }
  } catch (err) {
    console.error('[thumbnailLLM/api] Request failed:', err);
    throw err;
  }
}

// ── Parts builder ─────────────────────────────────────────────────────────────

/**
 * per-request パーツ（サムネイル1枚 + ゲームプレイフレーム最大3枚 + プロンプト）。
 * Gemini 用（parts 配列）。
 */
function buildPerRequestParts(
  imageData: ImageData,
  frames: FrameImageData[],
  title?: string,
): object[] {
  const parts: object[] = [];

  parts.push({ text: '--- 分析対象 START ---' });
  parts.push({ text: '[THUMBNAIL] サムネイル画像（エージェント・ランク判定用）:' });
  parts.push({ inline_data: { mime_type: imageData.mediaType, data: imageData.base64 } });

  const minimapFrames = frames.filter((f) => f.frameType === 'minimap');
  const fullFrames = frames.filter((f) => f.frameType === 'full');

  if (minimapFrames.length > 0) {
    parts.push({
      text: `[MINIMAP FRAMES] ミニマップクロップ ${minimapFrames.length} 枚（マップ判定用）:`,
    });
    for (const frame of minimapFrames) {
      parts.push({ text: `${Math.round(frame.position * 100)}%:` });
      parts.push({ inline_data: { mime_type: frame.mediaType, data: frame.base64 } });
    }
  }

  if (fullFrames.length > 0) {
    parts.push({
      text: `[GAMEPLAY FRAMES] 全体フレーム ${fullFrames.length} 枚（HUD テキスト・エージェント・ランク判定用）:`,
    });
    for (const frame of fullFrames) {
      parts.push({ text: `${Math.round(frame.position * 100)}%:` });
      parts.push({ inline_data: { mime_type: frame.mediaType, data: frame.base64 } });
    }
  }

  parts.push({ text: buildAnalysisPrompt(title) });
  return parts;
}

// ── Generation config / Normalization ─────────────────────────────────────────

function buildGenerationConfig() {
  return {
    responseMimeType: 'application/json',
    responseJsonSchema: {
      type: 'object',
      properties: {
        map: { type: 'string', nullable: true, enum: [...MAP_LABELS, null] },
        agent: { type: 'string', nullable: true, enum: [...AGENT_LABELS, null] },
        rank: { type: 'string', nullable: true, enum: [...RANK_LABELS, null] },
        coaching_type: { type: 'string', enum: ['individual', 'team'] },
        map_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        agent_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        rank_confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        reasoning: { type: 'string' },
      },
      required: [
        'map',
        'agent',
        'rank',
        'coaching_type',
        'map_confidence',
        'agent_confidence',
        'rank_confidence',
        'reasoning',
      ],
    },
    temperature: 0.1,
    maxOutputTokens: 8192, // gemini-2.5-flash は thinking トークンも消費するため大きめに設定
  };
}

/** `{...}` ブロックをブレース対応で正確に抽出する */
function extractJsonBlock(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text;
  let depth = 0;
  let inString = false;
  let isEscaping = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i]!;
    if (isEscaping) {
      isEscaping = false;
      continue;
    }
    if (c === '\\' && inString) {
      isEscaping = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (c === '{') depth++;
      else if (c === '}' && --depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** JSON 文字列値内のリテラル制御文字（改行・タブ等）をエスケープする */
function sanitizeJsonStrings(text: string): string {
  let result = '';
  let inString = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (!inString) {
      result += c;
      if (c === '"') inString = true;
    } else {
      if (c === '\\') {
        result += c + (text[i + 1] ?? '');
        i++;
      } else if (c === '"') {
        result += c;
        inString = false;
      } else if (c === '\n') {
        result += '\\n';
      } else if (c === '\r') {
        result += '\\r';
      } else if (c === '\t') {
        result += '\\t';
      } else {
        result += c;
      }
    }
    i++;
  }
  return result;
}

function normalizeGeminiResult(raw: LLMExtractionResult): LLMExtractionResult {
  const validConf = (v: string): 'high' | 'medium' | 'low' =>
    v === 'high' || v === 'medium' || v === 'low' ? v : 'low';
  return {
    ...raw,
    map: raw.map === 'null' ? null : raw.map,
    agent: raw.agent === 'null' ? null : raw.agent,
    rank: raw.rank === 'null' ? null : raw.rank,
    coaching_type: raw.coaching_type === 'team' ? 'team' : 'individual',
    map_confidence: validConf(raw.map_confidence),
    agent_confidence: validConf(raw.agent_confidence),
    rank_confidence: validConf(raw.rank_confidence),
  };
}
