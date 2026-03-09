/** YouTube Data API v3 ラッパー */

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

export interface YouTubeSnippet {
  title:        string;
  description:  string;
  channelId:    string;
  channelTitle: string;
  publishedAt:  string;  // ISO 8601
  tags?:        string[];
  thumbnails: {
    maxres?: { url: string };
    high?:   { url: string };
    medium?: { url: string };
    default?: { url: string };
  };
}

export interface YouTubeContentDetails {
  duration: string;  // ISO 8601 e.g. PT12M30S
}

export interface YouTubeStatistics {
  viewCount?: string;
}

export interface YouTubeVideoItem {
  id:             string;
  snippet:        YouTubeSnippet;
  contentDetails: YouTubeContentDetails;
  statistics:     YouTubeStatistics;
}

interface SearchItem {
  id: { videoId: string };
}

interface SearchResponse {
  items:         SearchItem[];
  nextPageToken?: string;
}

interface PlaylistItemsResponse {
  items: Array<{ snippet: { resourceId: { videoId: string } } }>;
  nextPageToken?: string;
}

interface ChannelsResponse {
  items: Array<{ contentDetails: { relatedPlaylists: { uploads: string } } }>;
}

interface VideosResponse {
  items: YouTubeVideoItem[];
}

/**
 * チャンネルの動画を uploads プレイリスト経由で全件取得する。
 * cost: channels.list(1 unit) + playlistItems.list(1 unit/50本) + videos.list(1 unit/50本)
 * search.list(100 units/req)より大幅に安く、全件取得が保証される。
 */
export async function fetchChannelVideos(
  channelId: string,
  apiKey: string,
  maxResults = 9999,
): Promise<YouTubeVideoItem[]> {
  // Step 1: uploads プレイリスト ID を取得（1 unit）
  const chRes = await fetch(
    `${YT_BASE}/channels?${new URLSearchParams({ part: 'contentDetails', id: channelId, key: apiKey })}`,
  );
  if (!chRes.ok) throw new Error(`YouTube channels.list failed (${chRes.status}): ${await chRes.text()}`);
  const chData = await chRes.json() as ChannelsResponse;
  const uploadsPlaylistId = chData.items[0]?.contentDetails.relatedPlaylists.uploads;
  if (!uploadsPlaylistId) throw new Error(`uploads playlist not found for channel: ${channelId}`);

  // Step 2: playlistItems.list でビデオIDを全件取得（1 unit/req）
  const videoIds: string[] = [];
  let pageToken: string | undefined;

  while (videoIds.length < maxResults) {
    const params = new URLSearchParams({
      part:       'snippet',
      playlistId: uploadsPlaylistId,
      maxResults: '50',
      key:        apiKey,
      ...(pageToken ? { pageToken } : {}),
    });
    const res = await fetch(`${YT_BASE}/playlistItems?${params}`);
    if (!res.ok) throw new Error(`YouTube playlistItems.list failed (${res.status}): ${await res.text()}`);
    const data = await res.json() as PlaylistItemsResponse;
    videoIds.push(...data.items.map(i => i.snippet.resourceId.videoId));
    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  if (videoIds.length === 0) return [];

  // Step 3: videos.list でスニペット + 詳細を取得（1 unit/50本）
  const chunks = chunkArray(videoIds.slice(0, maxResults), 50);
  const allItems: YouTubeVideoItem[] = [];

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      part: 'snippet,contentDetails,statistics',
      id:   chunk.join(','),
      key:  apiKey,
    });
    const res = await fetch(`${YT_BASE}/videos?${params}`);
    if (!res.ok) throw new Error(`YouTube videos.list failed (${res.status}): ${await res.text()}`);
    const data = await res.json() as VideosResponse;
    allItems.push(...data.items);
  }

  return allItems;
}

/**
 * キーワード検索で動画を取得する（チャンネル不明の場合）。
 * cost: search.list(100 units/req)
 */
export async function searchVideos(
  query: string,
  apiKey: string,
  maxResults = 50,
): Promise<YouTubeVideoItem[]> {
  const params = new URLSearchParams({
    part:      'id',
    q:         query,
    type:      'video',
    maxResults: String(Math.min(50, maxResults)),
    order:     'relevance',
    key:       apiKey,
  });

  const res = await fetch(`${YT_BASE}/search?${params}`);
  if (!res.ok) throw new Error(`YouTube search failed (${res.status})`);
  const data = await res.json() as SearchResponse;

  if (data.items.length === 0) return [];

  const ids = data.items.map(i => i.id.videoId).join(',');
  const vRes = await fetch(
    `${YT_BASE}/videos?part=snippet,contentDetails,statistics&id=${ids}&key=${apiKey}`,
  );
  if (!vRes.ok) throw new Error(`YouTube videos.list failed (${vRes.status})`);
  const vData = await vRes.json() as VideosResponse;
  return vData.items;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
