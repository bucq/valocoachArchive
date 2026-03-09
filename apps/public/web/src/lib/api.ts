/** Hono API クライアント */

export interface VideoItem {
  id:           string;
  title:        string;
  channelTitle: string;
  publishedAt:  string;
  thumbnailUrl: string;
  duration:     string;
  viewCount:    number;
  map:          string | null;
  agent:        string | null;
  rank:         string | null;
  mapConfidence:   number;
  agentConfidence: number;
  rankConfidence:  number;
}

export interface VideosResponse {
  videos: VideoItem[];
  total:  number;
  page:   number;
  limit:  number;
}

export interface FiltersResponse {
  maps:    string[];
  agents:  string[];
  ranks:   string[];
  coaches: string[];
}

export interface VideoFilters {
  map?:   string;
  agent?: string;
  rank?:  string;
  coach?: string;
  page?:  number;
  limit?: number;
}

export async function fetchVideos(
  apiBase: string,
  filters: VideoFilters,
): Promise<VideosResponse> {
  const params = new URLSearchParams();
  if (filters.map)   params.set('map',   filters.map);
  if (filters.agent) params.set('agent', filters.agent);
  if (filters.rank)  params.set('rank',  filters.rank);
  if (filters.coach) params.set('coach', filters.coach);
  if (filters.page)  params.set('page',  String(filters.page));
  if (filters.limit) params.set('limit', String(filters.limit));

  const res = await fetch(`${apiBase}/api/videos?${params}`);
  if (!res.ok) throw new Error(`fetchVideos failed: ${res.status}`);
  return res.json() as Promise<VideosResponse>;
}

export async function fetchFilters(apiBase: string): Promise<FiltersResponse> {
  const res = await fetch(`${apiBase}/api/videos/filters`);
  if (!res.ok) throw new Error(`fetchFilters failed: ${res.status}`);
  return res.json() as Promise<FiltersResponse>;
}

export interface CorrectionPayload {
  suggestedMap?:   string;
  suggestedAgent?: string;
  suggestedRank?:  string;
  note?:           string;
}

export interface CorrectionResponse {
  ok: boolean;
  alreadyPending?: boolean;
  message?: string;
}

export async function submitCorrection(
  apiBase: string,
  videoId: string,
  payload: CorrectionPayload,
): Promise<CorrectionResponse> {
  const res = await fetch(`${apiBase}/api/videos/${videoId}/correction`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`submitCorrection failed: ${res.status}`);
  return res.json() as Promise<CorrectionResponse>;
}

/** ISO 8601 duration を "12:30" 形式に変換 */
export function formatDuration(iso: string): string {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return '';
  const h = parseInt(match[1] ?? '0', 10);
  const m = parseInt(match[2] ?? '0', 10);
  const s = parseInt(match[3] ?? '0', 10);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
