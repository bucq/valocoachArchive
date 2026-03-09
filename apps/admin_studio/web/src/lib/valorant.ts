import { MAPS as MAP_ENTRIES, AGENTS as AGENT_ENTRIES, RANKS as RANK_ENTRIES } from '@valocoach/valorant';

// React セレクト用 string 配列（既存コンポーネントの変更不要）
export const MAPS   = MAP_ENTRIES.map(m => m.label);
export const AGENTS = AGENT_ENTRIES.map(a => a.label);
export const RANKS  = RANK_ENTRIES.map(r => r.label);
