/** Valorant ゲーム内定数 — map/agent/rank の正規表現マッチングに使用 */

export interface MapEntry {
  id: string;
  label: string;
  aliases: string[];
}

export const MAPS: MapEntry[] = [
  { id: 'ascent', label: 'Ascent', aliases: ['ascent', 'アセント'] },
  { id: 'bind', label: 'Bind', aliases: ['bind', 'バインド'] },
  { id: 'breeze', label: 'Breeze', aliases: ['breeze', 'ブリーズ'] },
  { id: 'fracture', label: 'Fracture', aliases: ['fracture', 'frac', 'フラクチャー'] },
  { id: 'haven', label: 'Haven', aliases: ['haven', 'ヘイヴン', 'ヘイブン'] },
  { id: 'icebox', label: 'Icebox', aliases: ['icebox', 'ice box', 'アイスボックス'] },
  { id: 'lotus', label: 'Lotus', aliases: ['lotus', 'ロータス'] },
  { id: 'pearl', label: 'Pearl', aliases: ['pearl', 'パール'] },
  { id: 'split', label: 'Split', aliases: ['split', 'スプリット'] },
  { id: 'sunset', label: 'Sunset', aliases: ['sunset', 'サンセット'] },
  { id: 'abyss', label: 'Abyss', aliases: ['abyss', 'アビス'] },
  { id: 'corrode', label: 'Corrode', aliases: ['corrode', 'コロード'] },
];

export interface AgentEntry {
  id: string;
  label: string;
  role: 'duelist' | 'initiator' | 'controller' | 'sentinel';
  aliases: string[];
}

export const AGENTS: AgentEntry[] = [
  // Duelist
  { id: 'jett', label: 'Jett', role: 'duelist', aliases: ['jett', 'ジェット'] },
  { id: 'reyna', label: 'Reyna', role: 'duelist', aliases: ['reyna', 'レイナ'] },
  { id: 'raze', label: 'Raze', role: 'duelist', aliases: ['raze', 'レイズ'] },
  { id: 'phoenix', label: 'Phoenix', role: 'duelist', aliases: ['phoenix', 'フェニックス'] },
  { id: 'neon', label: 'Neon', role: 'duelist', aliases: ['neon', 'ネオン'] },
  { id: 'iso', label: 'Iso', role: 'duelist', aliases: ['iso', 'アイソ'] },
  { id: 'waylay', label: 'Waylay', role: 'duelist', aliases: ['waylay', 'ウェイレイ'] },
  { id: 'yoru', label: 'Yoru', role: 'duelist', aliases: ['yoru', 'ヨル'] },
  // Initiator
  { id: 'sova', label: 'Sova', role: 'initiator', aliases: ['sova', 'ソーヴァ'] },
  { id: 'breach', label: 'Breach', role: 'initiator', aliases: ['breach', 'ブリーチ'] },
  { id: 'skye', label: 'Skye', role: 'initiator', aliases: ['skye', 'スカイ'] },
  {
    id: 'kayo',
    label: 'KAY/O',
    role: 'initiator',
    aliases: ['kayo', 'kay/o', 'kay o', 'ケイオー'],
  },
  { id: 'fade', label: 'Fade', role: 'initiator', aliases: ['fade', 'フェイド'] },
  { id: 'gekko', label: 'Gekko', role: 'initiator', aliases: ['gekko', 'ゲッコ'] },
  { id: 'tejo', label: 'Tejo', role: 'initiator', aliases: ['tejo', 'テホ'] },
  // Controller
  {
    id: 'brimstone',
    label: 'Brimstone',
    role: 'controller',
    aliases: ['brimstone', 'brim', 'ブリムストーン', 'ブリム'],
  },
  { id: 'viper', label: 'Viper', role: 'controller', aliases: ['viper', 'ヴァイパー'] },
  { id: 'omen', label: 'Omen', role: 'controller', aliases: ['omen', 'オーメン'] },
  { id: 'astra', label: 'Astra', role: 'controller', aliases: ['astra', 'アストラ'] },
  { id: 'harbor', label: 'Harbor', role: 'controller', aliases: ['harbor', 'ハーバー'] },
  { id: 'clove', label: 'Clove', role: 'controller', aliases: ['clove', 'クローヴ'] },
  // Sentinel
  { id: 'sage', label: 'Sage', role: 'sentinel', aliases: ['sage', 'セージ'] },
  { id: 'cypher', label: 'Cypher', role: 'sentinel', aliases: ['cypher', 'サイファー'] },
  { id: 'killjoy', label: 'Killjoy', role: 'sentinel', aliases: ['killjoy', 'kj', 'キルジョイ'] },
  { id: 'chamber', label: 'Chamber', role: 'sentinel', aliases: ['chamber', 'チェンバー'] },
  { id: 'deadlock', label: 'Deadlock', role: 'sentinel', aliases: ['deadlock', 'デッドロック'] },
  { id: 'vyse', label: 'Vyse', role: 'sentinel', aliases: ['vyse', 'ヴァイス'] },
  { id: 'veto', label: 'Veto', role: 'sentinel', aliases: ['veto', 'ヴェト'] },
];

export interface RankEntry {
  id: string;
  label: string;
  ordinal: number; // Iron=1 ... Radiant=9（範囲クエリ用）
}

export const RANKS: RankEntry[] = [
  { id: 'iron', label: 'Iron', ordinal: 1 },
  { id: 'bronze', label: 'Bronze', ordinal: 2 },
  { id: 'silver', label: 'Silver', ordinal: 3 },
  { id: 'gold', label: 'Gold', ordinal: 4 },
  { id: 'platinum', label: 'Platinum', ordinal: 5 },
  { id: 'diamond', label: 'Diamond', ordinal: 6 },
  { id: 'ascendant', label: 'Ascendant', ordinal: 7 },
  { id: 'immortal', label: 'Immortal', ordinal: 8 },
  { id: 'radiant', label: 'Radiant', ordinal: 9 },
];

// LLMのtool_use enumに渡す文字列配列
export const MAP_LABELS = MAPS.map((m) => m.label);
export const AGENT_LABELS = AGENTS.map((a) => a.label);
export const RANK_LABELS = RANKS.map((r) => r.label);

// ── 静的アイコン URL マップ (valorant-api.com) ──────────────────────────────

export const AGENT_ICONS: Record<string, string> = {
  Jett: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png',
  Reyna:
    'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png',
  Raze: 'https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/displayicon.png',
  Phoenix:
    'https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/displayicon.png',
  Neon: 'https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195d751/displayicon.png',
  Iso: 'https://media.valorant-api.com/agents/0e38b510-41a8-5780-5e8f-568b2a4f2d6c/displayicon.png',
  Waylay:
    'https://media.valorant-api.com/agents/df1cb487-4902-002e-5c17-d28e83e78588/displayicon.png',
  Yoru: 'https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/displayicon.png',
  Sova: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png',
  Breach:
    'https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/displayicon.png',
  Skye: 'https://media.valorant-api.com/agents/6f2a04ca-43e0-be17-7f36-b3908627744d/displayicon.png',
  'KAY/O':
    'https://media.valorant-api.com/agents/601dbbe7-43ce-be57-2a40-4abd24953621/displayicon.png',
  Fade: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png',
  Gekko:
    'https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/displayicon.png',
  Tejo: 'https://media.valorant-api.com/agents/b444168c-4e35-8076-db47-ef9bf368f384/displayicon.png',
  Brimstone:
    'https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/displayicon.png',
  Viper:
    'https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/displayicon.png',
  Omen: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png',
  Astra:
    'https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e96f1bf/displayicon.png',
  Harbor:
    'https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-71ba8c293152/displayicon.png',
  Clove:
    'https://media.valorant-api.com/agents/1dbf2edd-4729-0984-3115-daa5eed44993/displayicon.png',
  Sage: 'https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png',
  Cypher:
    'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/displayicon.png',
  Killjoy:
    'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png',
  Chamber:
    'https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/displayicon.png',
  Deadlock:
    'https://media.valorant-api.com/agents/cc8b64c8-4b25-4ff9-6e7f-37b4da43d235/displayicon.png',
  Vyse: 'https://media.valorant-api.com/agents/efba5359-4016-a1e5-7626-b1ae76895940/displayicon.png',
  Veto: 'https://media.valorant-api.com/agents/92eeef5d-43b5-1d4a-8d03-b3927a09034b/displayicon.png',
};

export const MAP_ICONS: Record<string, string> = {
  Ascent:
    'https://media.valorant-api.com/maps/7eaecc1b-4337-bbf6-6ab9-04b8f06b3319/listviewicon.png',
  Split:
    'https://media.valorant-api.com/maps/d960549e-485c-e861-8d71-aa9d1aed12a2/listviewicon.png',
  Fracture:
    'https://media.valorant-api.com/maps/b529448b-4d60-346e-e89e-00a4c527a405/listviewicon.png',
  Bind: 'https://media.valorant-api.com/maps/2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba/listviewicon.png',
  Breeze:
    'https://media.valorant-api.com/maps/2fb9a4fd-47b8-4e7d-a969-74b4046ebd53/listviewicon.png',
  Abyss:
    'https://media.valorant-api.com/maps/224b0a95-48b9-f703-1bd8-67aca101a61f/listviewicon.png',
  Lotus:
    'https://media.valorant-api.com/maps/2fe4ed3a-450a-948b-6d6b-e89a78e680a9/listviewicon.png',
  Sunset:
    'https://media.valorant-api.com/maps/92584fbe-486a-b1b2-9faa-39b0f486b498/listviewicon.png',
  Pearl:
    'https://media.valorant-api.com/maps/fd267378-4d1d-484f-ff52-77821ed10dc2/listviewicon.png',
  Icebox:
    'https://media.valorant-api.com/maps/e2ad5c54-4114-a870-9641-8ea21279579a/listviewicon.png',
  Haven:
    'https://media.valorant-api.com/maps/2bee0dc9-4ffe-519b-1cbd-7fbe763a6047/listviewicon.png',
  Corrode:
    'https://media.valorant-api.com/maps/1c18ab1f-420d-0d8b-71d0-77ad3c439115/listviewicon.png',
};

const _RANK_TIER_UUID = '03621f52-342b-cf4e-4f86-9350a49c6d04';
const _R = (tier: number) =>
  `https://media.valorant-api.com/competitivetiers/${_RANK_TIER_UUID}/${tier}/smallicon.png`;

export const RANK_ICONS: Record<string, string> = {
  Iron: _R(3),
  Bronze: _R(6),
  Silver: _R(9),
  Gold: _R(12),
  Platinum: _R(15),
  Diamond: _R(18),
  Ascendant: _R(21),
  Immortal: _R(24),
  Radiant: _R(27),
};

/** エイリアスから正規のlabelへの逆引きマップ */
export const MAP_ALIAS_MAP = new Map<string, string>(
  MAPS.flatMap((m) => m.aliases.map((a) => [a.toLowerCase(), m.label])),
);
export const AGENT_ALIAS_MAP = new Map<string, string>(
  AGENTS.flatMap((a) => a.aliases.map((al) => [al.toLowerCase(), a.label])),
);
export const RANK_ALIAS_MAP = new Map<string, string>(
  RANKS.flatMap((r) => [
    [r.id.toLowerCase(), r.label],
    [r.label.toLowerCase(), r.label],
  ]),
);
