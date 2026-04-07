const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787';
const ADMIN_TOKEN = import.meta.env.VITE_ADMIN_TOKEN ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Token': ADMIN_TOKEN,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError((err as { error?: string }).error ?? res.statusText, res.status);
  }
  return res.json() as Promise<T>;
}

// ── 型定義 ────────────────────────────────────────────────────────────

export interface Video {
  id: string;
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnailUrl: string;
  duration?: string;
  viewCount?: number;
  map: string | null;
  agent: string | null;
  rank: string | null;
  mapConfidence: number;
  agentConfidence: number;
  rankConfidence: number;
  mapSource: string | null;
  agentSource: string | null;
  rankSource: string | null;
  coachingType: string;
  aiTaggingStatus: string;
  reviewNeeded: number;
  isValorantCoaching: number;
  aiTaggedAt?: string | null;
  llmReasoning?: string | null;
}

export interface VideoListResponse {
  total: number;
  page: number;
  limit: number;
  videos: Video[];
}

export interface StatsResponse {
  total: number;
  rejected: number;
  reviewNeeded: number;
  byStatus: {
    pending: number;
    in_progress: number;
    complete: number;
    skipped: number;
    failed: number;
  };
}

export interface Channel {
  id: string;
  placeholder: boolean;
}

export interface TagCorrectionRequest {
  id: number;
  videoId: string;
  suggestedMap: string | null;
  suggestedAgent: string | null;
  suggestedRank: string | null;
  note: string | null;
  status: string;
  createdAt: string;
}

export interface TagPendingVideoRow {
  id: string;
  title: string;
}

export interface TagSingleResult {
  status: 'tagged' | 'failed';
  videoId: string;
  map?: string | null;
  agent?: string | null;
  rank?: string | null;
  failReason?: string;
}

// ── corrections ───────────────────────────────────────────────────────

export async function fetchVideoCorrections(videoId: string): Promise<TagCorrectionRequest[]> {
  const res = await apiFetch<{ corrections: TagCorrectionRequest[] }>(
    `/api/admin/corrections?videoId=${encodeURIComponent(videoId)}`,
  );
  return res.corrections;
}

export async function resolveVideoCorrections(
  videoId: string,
  status: 'resolved' | 'dismissed',
): Promise<void> {
  await apiFetch(`/api/admin/corrections/resolve-by-video/${encodeURIComponent(videoId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
