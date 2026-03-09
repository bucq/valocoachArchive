import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogBase64 } from './catalogData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data/catalog_data');

export interface CatalogEntry {
  /** エージェント名・マップ名など（例: "Jett", "Ascent"） */
  name: string;
  base64: string;
  mediaType: string;
}

// ── 個別カテゴリ取得 ──────────────────────────────────────────────────────────

/** エージェントアイコン一覧 */
export function getAgentCatalogImages(): CatalogEntry[] {
  return toEntries(catalogBase64.agent_catalog, 'image/webp');
}

/** エージェント全身像一覧 */
export function getAgentPortraitImages(): CatalogEntry[] {
  return toEntries(catalogBase64.agent_portraits, 'image/webp');
}

/** マップ背景シーン一覧 */
export function getMapCatalogImages(): CatalogEntry[] {
  return toEntries(catalogBase64.map_catalog, 'image/webp');
}

/** マップミニマップ一覧（ゲームプレイ左上表示と比較用） */
export function getMapDisplayImages(): CatalogEntry[] {
  return toEntries(catalogBase64.map_display_catalog, 'image/webp');
}

/** ランクカタログ（IRON_1〜RADIANT の個別画像一覧） */
export function getRankCatalogImages(): CatalogEntry[] {
  return toEntries(catalogBase64.rank_catalog, 'image/webp');
}

// ── 一括取得 ─────────────────────────────────────────────────────────────────

/**
 * Gemini Context Cache 用：全カタログを順番付きで返す。
 * ラベルテキスト用に category フィールドを追加した拡張型を返す。
 */
export interface LabeledCatalogEntry extends CatalogEntry {
  category: string;
}

export function getAllCatalogsLabeled(): LabeledCatalogEntry[] {
  const entries: LabeledCatalogEntry[] = [];

  for (const e of getMapDisplayImages()) {
    entries.push({ ...e, category: 'MAP_MINIMAP' });
  }
  for (const e of getMapCatalogImages()) {
    entries.push({ ...e, category: 'MAP_SCENE' });
  }
  for (const e of getAgentCatalogImages()) {
    entries.push({ ...e, category: 'AGENT_ICON' });
  }
  for (const e of getAgentPortraitImages()) {
    entries.push({ ...e, category: 'AGENT_PORTRAIT' });
  }
  for (const e of getRankCatalogImages()) {
    entries.push({ ...e, category: 'RANK' });
  }

  return entries;
}

/**
 * Anthropic など非キャッシュ用：全画像をフラット配列で返す（後方互換）。
 * 順序: map_display → map → agent_icons → agent_portraits → rank
 */
export function getAllCatalogs(): CatalogEntry[] {
  return getAllCatalogsLabeled();
}

/**
 * Gemma など入力画像枚数制限があるプロバイダー用。
 * 個別画像ではなく、タイル状に結合されたグリッド画像を返す。
 */
export function getCatalogGrids(): LabeledCatalogEntry[] {
  const grids: LabeledCatalogEntry[] = [];
  const definitions = [
    { name: 'map_display_catalog_grid.webp', category: 'MAP_MINIMAP_GRID' },
    { name: 'map_catalog_grid.webp', category: 'MAP_SCENE_GRID' },
    { name: 'agent_catalog_grid.webp', category: 'AGENT_ICON_GRID' },
    { name: 'agent_portraits_grid.webp', category: 'AGENT_PORTRAIT_GRID' },
    { name: 'rank_catalog_grid.webp', category: 'RANK_GRID' },
  ];

  for (const def of definitions) {
    try {
      const filePath = path.join(DATA_DIR, def.name);
      if (fs.existsSync(filePath)) {
        const base64 = fs.readFileSync(filePath, 'base64');
        grids.push({
          name: def.name.replace('_grid.webp', ''),
          base64,
          mediaType: 'image/webp',
          category: def.category,
        });
      }
    } catch (err) {
      console.error(`[catalogLoader] Failed to load grid: ${def.name}`, err);
    }
  }

  return grids;
}

// ── 内部ヘルパー ──────────────────────────────────────────────────────────────

function toEntries(
  map: Record<string, string>,
  mediaType: string,
): CatalogEntry[] {
  return Object.entries(map).map(([name, base64]) => ({ name, base64, mediaType }));
}
