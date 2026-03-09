const BASE = 'http://localhost:3001';

// Workers API（リモート）への fetch — corrections の読み書きに使用
const WORKERS_URL  = import.meta.env.VITE_WORKERS_URL  ?? 'http://localhost:8787';
const ADMIN_TOKEN  = import.meta.env.VITE_ADMIN_TOKEN  ?? '';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, init);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

// --- 型定義 ---

export interface Video {
  id:              string;
  title:           string;
  channelTitle:    string;
  publishedAt:     string;
  thumbnailUrl:    string;
  duration?:       string;
  viewCount?:      number;
  map:             string | null;
  agent:           string | null;
  rank:            string | null;
  mapConfidence:   number;
  agentConfidence: number;
  rankConfidence:  number;
  mapSource:       string | null;
  agentSource:     string | null;
  rankSource:      string | null;
  aiTaggingStatus: string;
  reviewNeeded:    number;
  isValorantCoaching: number;
  aiTaggedAt?:     string | null;
  llmReasoning?:   string | null;
}

export interface VideoListResponse {
  total:  number;
  page:   number;
  limit:  number;
  videos: Video[];
}

export interface StatsResponse {
  total:        number;
  rejected:     number;
  reviewNeeded: number;
  byStatus: {
    pending:     number;
    in_progress: number;
    complete:    number;
    skipped:     number;
    failed:      number;
  };
}

export interface Channel {
  id:          string;
  placeholder: boolean;
}

// ── Workers API (corrections) ─────────────────────────────────────

export interface TagCorrectionRequest {
  id:             number;
  videoId:        string;
  suggestedMap:   string | null;
  suggestedAgent: string | null;
  suggestedRank:  string | null;
  note:           string | null;
  status:         string;
  createdAt:      string;
}

async function workersFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WORKERS_URL}${path}`, {
    ...init,
    headers: {
      'X-Admin-Token': ADMIN_TOKEN,
      'Content-Type':  'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function fetchVideoCorrections(videoId: string): Promise<TagCorrectionRequest[]> {
  const res = await workersFetch<{ corrections: TagCorrectionRequest[] }>(
    `/api/admin/corrections?videoId=${encodeURIComponent(videoId)}`,
  );
  return res.corrections;
}

export async function resolveVideoCorrections(
  videoId: string,
  status: 'resolved' | 'dismissed',
): Promise<void> {
  await workersFetch(`/api/admin/corrections/resolve-by-video/${encodeURIComponent(videoId)}`, {
    method: 'PATCH',
    body:   JSON.stringify({ status }),
  });
}
