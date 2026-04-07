/**
 * catalogLoader.ts — Workers 対応版
 *
 * catalogData.ts の base64 データのみ使用。
 * node:fs に依存する getCatalogGrids() はグリッドファイルを Workers にバンドルできないため
 * 空配列を返す（Gemma stepwise は個別画像を使うため影響なし）。
 */
import { catalogBase64 } from './catalogData';

export interface CatalogEntry {
  name: string;
  base64: string;
  mediaType: string;
}

export interface LabeledCatalogEntry extends CatalogEntry {
  category: string;
}

export function getAgentCatalogImages(): CatalogEntry[] {
  return toEntries(catalogBase64.agent_catalog, 'image/webp');
}

export function getAgentPortraitImages(): CatalogEntry[] {
  return toEntries(catalogBase64.agent_portraits, 'image/webp');
}

export function getMapCatalogImages(): CatalogEntry[] {
  return toEntries(catalogBase64.map_catalog, 'image/webp');
}

export function getMapDisplayImages(): CatalogEntry[] {
  return toEntries(catalogBase64.map_display_catalog, 'image/webp');
}

export function getRankCatalogImages(): CatalogEntry[] {
  return toEntries(catalogBase64.rank_catalog, 'image/webp');
}

export function getAllCatalogsLabeled(): LabeledCatalogEntry[] {
  const entries: LabeledCatalogEntry[] = [];
  for (const e of getMapDisplayImages()) entries.push({ ...e, category: 'MAP_MINIMAP' });
  for (const e of getMapCatalogImages()) entries.push({ ...e, category: 'MAP_SCENE' });
  for (const e of getAgentCatalogImages()) entries.push({ ...e, category: 'AGENT_ICON' });
  for (const e of getAgentPortraitImages()) entries.push({ ...e, category: 'AGENT_PORTRAIT' });
  for (const e of getRankCatalogImages()) entries.push({ ...e, category: 'RANK' });
  return entries;
}

export function getAllCatalogs(): CatalogEntry[] {
  return getAllCatalogsLabeled();
}

/** Workers では grid ファイルをバンドルできないため空配列を返す */
export function getCatalogGrids(): LabeledCatalogEntry[] {
  return [];
}

function toEntries(map: Record<string, string>, mediaType: string): CatalogEntry[] {
  return Object.entries(map).map(([name, base64]) => ({ name, base64, mediaType }));
}
