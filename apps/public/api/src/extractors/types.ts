export type ExtractionSource = 'regex' | 'caption_llm' | 'thumbnail_llm' | 'manual';

/** LLMプロバイダー切り替え */
export type LLMProvider = 'anthropic' | 'gemini' | 'gemma';

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'none';

export const SOURCE_WEIGHT: Record<ExtractionSource, number> = {
  manual: 100,
  regex: 80,
  caption_llm: 65,
  thumbnail_llm: 45,
};

export const CONFIDENCE_FLOAT: Record<ConfidenceLevel, number> = {
  high: 0.9,
  medium: 0.65,
  low: 0.35,
  none: 0.0,
};

export interface FieldExtraction {
  value: string | null;
  confidence: ConfidenceLevel;
  source: ExtractionSource;
}

export interface VideoMetadataExtraction {
  map: FieldExtraction;
  agent: FieldExtraction;
  rank: FieldExtraction;
}

export interface LLMExtractionResult {
  map: string | null;
  agent: string | null;
  rank: string | null;
  coaching_type: 'individual' | 'team';
  map_confidence: 'high' | 'medium' | 'low';
  agent_confidence: 'high' | 'medium' | 'low';
  rank_confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}
