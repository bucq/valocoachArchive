/**
 * valorant-assets.ts
 * アイコン URL は @valocoach/valorant パッケージから共有。
 * RANK_COLORS はこのアプリ固有のスタイル定数。
 */

export { AGENT_ICONS, MAP_ICONS, RANK_ICONS } from '@valocoach/valorant';

/** Rank color tokens (mirrors CSS vars in valo.css) */
export const RANK_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  Iron:      { bg: 'rgba(140,145,150,0.2)',  text: '#8C9196', border: '#8C9196' },
  Bronze:    { bg: 'rgba(168,114, 71,0.2)',  text: '#A87247', border: '#A87247' },
  Silver:    { bg: 'rgba(170,186,199,0.2)',  text: '#AABAC7', border: '#AABAC7' },
  Gold:      { bg: 'rgba(232,200, 74,0.2)',  text: '#E8C84A', border: '#E8C84A' },
  Platinum:  { bg: 'rgba( 76,191,186,0.2)',  text: '#26b9de', border: '#26b9de' },
  Diamond:   { bg: 'rgba( 69,170,217,0.2)',  text: '#9948cf', border: '#9948cf' },
  Ascendant: { bg: 'rgba( 45,201,126,0.2)',  text: '#087b68', border: '#087b68' },
  Immortal:  { bg: 'rgba(187, 37, 56,0.25)', text: '#BB2538', border: '#BB2538' },
  Radiant:   { bg: 'rgba(245,225,114,0.15)', text: '#F5E172', border: '#F5E172' },
};
