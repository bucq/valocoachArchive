/**
 * get-channel-id.ts
 *
 * YouTubeチャンネルホーム画面URLからチャンネルIDを取得するスクリプト。
 *
 * 対応URL形式:
 *   https://www.youtube.com/channel/UCxxxxxx   → URLから直接抽出
 *   https://www.youtube.com/@handle            → ページHTMLから抽出
 *   https://www.youtube.com/c/customname       → ページHTMLから抽出
 *   https://www.youtube.com/user/username      → ページHTMLから抽出
 *
 * 使い方:
 *   npx tsx scripts/get-channel-id.ts <URL> [URL2] [URL3] ...
 */

const urls = process.argv.slice(2);

if (urls.length === 0) {
  console.error('使い方: npx tsx scripts/get-channel-id.ts <YouTube channel URL> [...]');
  process.exit(1);
}

async function getChannelId(url: string): Promise<string> {
  // /channel/UC... 形式は直接抽出
  const directMatch = url.match(/youtube\.com\/channel\/(UC[\w-]+)/);
  if (directMatch) return directMatch[1];

  // それ以外はHTMLを取得してchannelIdを探す
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'ja,en;q=0.9',
    },
  });

  if (!res.ok) {
    throw new Error(`HTTPエラー: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();

  // "channelId":"UCxxxx" の形式で埋め込まれている
  const match = html.match(/"channelId":"(UC[\w-]+)"/);
  if (match) return match[1];

  // externalId でも試す
  const externalMatch = html.match(/"externalId":"(UC[\w-]+)"/);
  if (externalMatch) return externalMatch[1];

  throw new Error('チャンネルIDが見つかりませんでした（ページ構造が変わった可能性があります）');
}

for (const url of urls) {
  try {
    const channelId = await getChannelId(url);
    console.log(`${channelId}  # ${url}`);
  } catch (err) {
    console.error(`ERROR [${url}]: ${err instanceof Error ? err.message : err}`);
  }
}
