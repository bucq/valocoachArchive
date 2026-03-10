import { describe, expect, it } from 'vitest';
import { AGENT_ALIAS_MAP, AGENTS, MAP_ALIAS_MAP, MAPS, RANK_ALIAS_MAP, RANKS } from '../index';

describe('MAP_ALIAS_MAP', () => {
  it('ascent → Ascent', () => {
    expect(MAP_ALIAS_MAP.get('ascent')).toBe('Ascent');
  });
  it('frac → Fracture', () => {
    expect(MAP_ALIAS_MAP.get('frac')).toBe('Fracture');
  });
  it('ice box → Icebox', () => {
    expect(MAP_ALIAS_MAP.get('ice box')).toBe('Icebox');
  });
  it('全mapがaliasMapに含まれる', () => {
    for (const map of MAPS) {
      for (const alias of map.aliases) {
        expect(MAP_ALIAS_MAP.get(alias.toLowerCase())).toBe(map.label);
      }
    }
  });
  it('存在しないエイリアス → undefined', () => {
    expect(MAP_ALIAS_MAP.get('nonexistent')).toBeUndefined();
  });
});

describe('AGENT_ALIAS_MAP', () => {
  it('jett → Jett', () => {
    expect(AGENT_ALIAS_MAP.get('jett')).toBe('Jett');
  });
  it('kj → Killjoy', () => {
    expect(AGENT_ALIAS_MAP.get('kj')).toBe('Killjoy');
  });
  it('kayo → KAY/O', () => {
    expect(AGENT_ALIAS_MAP.get('kayo')).toBe('KAY/O');
  });
  it('kay/o → KAY/O', () => {
    expect(AGENT_ALIAS_MAP.get('kay/o')).toBe('KAY/O');
  });
  it('brim → Brimstone', () => {
    expect(AGENT_ALIAS_MAP.get('brim')).toBe('Brimstone');
  });
  it('全agentがaliasMapに含まれる', () => {
    for (const agent of AGENTS) {
      for (const alias of agent.aliases) {
        expect(AGENT_ALIAS_MAP.get(alias.toLowerCase())).toBe(agent.label);
      }
    }
  });
});

describe('RANK_ALIAS_MAP', () => {
  it('iron → Iron', () => {
    expect(RANK_ALIAS_MAP.get('iron')).toBe('Iron');
  });
  it('radiant → Radiant', () => {
    expect(RANK_ALIAS_MAP.get('radiant')).toBe('Radiant');
  });
  it('大文字ラベルも引ける', () => {
    expect(RANK_ALIAS_MAP.get('diamond')).toBe('Diamond');
  });
  it('全rankがaliasMapに含まれる', () => {
    for (const rank of RANKS) {
      expect(RANK_ALIAS_MAP.get(rank.id.toLowerCase())).toBe(rank.label);
      expect(RANK_ALIAS_MAP.get(rank.label.toLowerCase())).toBe(rank.label);
    }
  });
});

describe('RANKS ordinal 順序', () => {
  it('Iron=1 ... Radiant=9', () => {
    const sorted = [...RANKS].sort((a, b) => a.ordinal - b.ordinal);
    expect(sorted[0]?.id).toBe('iron');
    expect(sorted[sorted.length - 1]?.id).toBe('radiant');
  });
  it('ordinal が連続している', () => {
    const ordinals = RANKS.map((r) => r.ordinal).sort((a, b) => a - b);
    for (let i = 0; i < ordinals.length - 1; i++) {
      expect(ordinals[i + 1]! - ordinals[i]!).toBe(1);
    }
  });
  it('ordinal が重複しない', () => {
    const ordinals = RANKS.map((r) => r.ordinal);
    const unique = new Set(ordinals);
    expect(unique.size).toBe(ordinals.length);
  });
});
