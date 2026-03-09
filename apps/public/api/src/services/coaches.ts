/** コーチングチャンネルレジストリ — 動画取得対象のチャンネルを登録する */

/**
 * 監視対象のYouTubeチャンネルID一覧。
 * チャンネル表示名は YouTube API の snippet.channelTitle から自動取得する。
 *
 * チャンネルIDの確認方法:
 *   - チャンネルページ右クリック→ソース→"channelId" で UC... の文字列を確認
 *   - 例: https://www.youtube.com/@ChannelName → ページソース内 channelId
 */
export const COACH_CHANNEL_IDS: string[] = [
  'UC1eCIyuRC6llpr46tL5LS8w',  // tonbo
  'UCYX2lGNvaS9LN2vkwJn7lEA',  // みっちー
  `UCXEW13qpntV7pacu0Kz-9yA"`, // マザー
];
