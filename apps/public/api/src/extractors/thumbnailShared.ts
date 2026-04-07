// ── Shared types ──────────────────────────────────────────────────────────────

export interface ImageData {
  base64: string;
  mediaType: string;
}

// ── Thumbnail fetch ───────────────────────────────────────────────────────────

export type ThumbnailFetchFailReason = 'fetch_error' | 'placeholder' | 'not_found';

export async function fetchThumbnailAsBase64(videoId: string): Promise<{
  imageData: ImageData | null;
  failReason?: ThumbnailFetchFailReason;
}> {
  const urls = [
    `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  ];
  let lastFailReason: ThumbnailFetchFailReason = 'not_found';
  for (const url of urls) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          lastFailReason = 'not_found';
          break;
        }
        const buf = await res.arrayBuffer();
        if (buf.byteLength < 5_000) {
          lastFailReason = 'placeholder';
          break;
        }
        return {
          imageData: {
            base64: arrayBufferToBase64(buf),
            mediaType: res.headers.get('content-type') ?? 'image/jpeg',
          },
        };
      } catch {
        lastFailReason = 'fetch_error';
        if (attempt < 2) await new Promise((r) => setTimeout(r, 200));
      }
    }
  }
  return { imageData: null, failReason: lastFailReason };
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

// ── Prompt ────────────────────────────────────────────────────────────────────

export function buildAnalysisPrompt(title: string | undefined): string {
  return `${title ? `VIDEO TITLE（最優先ヒント — タイトルに明記された値は high confidence で採用）: "${title}"\n\n` : ''}以下の手順で分析し、3つのフィールドを独立して評価してください。

MAP（マップ）— 以下の優先順位で特定してください（事前知識ではなく必ず提供されたカタログ画像との視覚的照合を根拠にすること）:
1. ゲームプレイフレーム（提供された場合）のミニマップを MAP_MINIMAP カタログと照合（主判定）
   - ミニマップは回転している場合があります — 全方向を考慮してください
   - 複数フレームがある場合は多数決で採用し、真っ暗・ノイズフレームは無視してください
   - カタログに含まれるマップ名のみを回答候補とし、カタログにない名前は使用しないでください
   - ゲームプレイフレームにはマップが写っていない場合もあるため、フレームからマップが特定できない場合は多数決に含めないでください

AGENT（エージェント）— サムネイルのキャラクターを AGENT_ICON / AGENT_PORTRAIT カタログと照合してください:
- 識別可能なエージェントが見えない場合は agent_confidence を "low" にしてください

RANK（ランク）— サムネイルの直接的証拠から識別してください:
- RANK CATALOG（IRON_1〜RADIANT の個別バッジ画像）と照合し、テキストオーバーレイがあれば最優先で採用
- 各ランクのバッジの色・形状の特徴:
  - Iron: 暗いグレー/黒。シンプルな交差剣のみ。最も地味。
  - Bronze: 茶色/ブロンズ色。交差剣に盾が加わる。
  - Silver: 銀色/明るいグレー。盾と剣の組み合わせ。
  - Gold: 金色/黄色。より装飾的なデザイン。
  - Platinum: ティール/シアン色。宝石の多面カットのような輝き。
  - Diamond: 紫色。ダイヤモンドの結晶形状が特徴的。
  - Ascendant: 緑色。翼/上昇するモチーフ。
  - Immortal: 赤/深紅色。炎や頭蓋骨をイメージした攻撃的なデザイン。
  - Radiant: 金/白色の光。太陽のような放射状デザイン。最も豪華。
- ランクの証拠が弱い場合も最善の推測を返しつつ rank_confidence を "low" にしてください

COACHING TYPE（コーチング種別）— タイトルとサムネイルの文脈から判定してください:
- "team": チーム全体へのコーチング（チーム練習、スクリム解説、複数人への同時コーチング、部活など）
- "individual": 個人への1対1コーチング（VODレビュー、個人セッション、ソロプレイ解説など）
タイトルに「チーム」「スクリム」「team」「5v5」「練習試合」「全員」等が含まれる場合は "team"。

各フィールドに独立した confidence（high/medium/low）を割り当て、reasoning で根拠を説明してください。`;
}
