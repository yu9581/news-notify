import { loadWatchlist, getEnv } from './utils/config-loader.js'
import { collectGoogleNews } from './collectors/google-news.js'
import { collectRssFeeds } from './collectors/rss-feed.js'
import { createSummarizer } from './ai/summarizer.js'
import { createNotifier } from './discord/notifier.js'
import {
  loadSeenStore,
  saveSeenStore,
  filterNewArticles,
  markAsSeen,
} from './dedup/store.js'
import { filterRecent, interleave } from './utils/article-utils.js'

async function main(): Promise<void> {
  console.log('=== ニュース自動通知 開始 ===')
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`)

  const env = getEnv()
  const watchlist = loadWatchlist()
  const store = loadSeenStore()

  // 記事収集
  console.log('\n--- 記事収集 ---')
  const googleArticles = await collectGoogleNews(
    watchlist.people,
    watchlist.topics,
    watchlist.settings
  )
  console.log(`Google News: ${googleArticles.length}件`)

  const rssArticles = await collectRssFeeds(
    watchlist.feeds,
    watchlist.settings
  )
  console.log(`RSS: ${rssArticles.length}件`)

  // 直近24時間以内の記事のみ
  const recentGoogle = filterRecent(googleArticles, 24)
  const recentRss = filterRecent(rssArticles, 24)
  console.log(`24時間以内: Google News ${recentGoogle.length}件, RSS ${recentRss.length}件`)

  // ソースをバランスよく混ぜる
  const allArticles = interleave(recentGoogle, recentRss)
  console.log(`合計: ${allArticles.length}件`)

  // 重複除外
  console.log('\n--- 重複チェック ---')
  const newArticles = filterNewArticles(allArticles, store)
  console.log(`新着: ${newArticles.length}件（既知: ${allArticles.length - newArticles.length}件）`)

  if (newArticles.length === 0) {
    console.log('新着記事なし。終了します。')
    return
  }

  // 上限適用
  const limited = newArticles.slice(0, watchlist.settings.maxTotalArticles)
  console.log(`通知対象: ${limited.length}件`)

  // AI要約
  console.log('\n--- AI要約 ---')
  const summarizer = createSummarizer(env.geminiApiKey)
  const summarized = await summarizer.summarizeArticles(limited)
  console.log(`要約完了: ${summarized.length}件`)

  // Discord通知
  console.log('\n--- Discord通知 ---')
  const notifier = createNotifier(env.discordBotToken, env.discordChannelId)
  await notifier.connect()

  const sentCount = await notifier.notifyArticles(summarized)
  console.log(`通知完了: ${sentCount}件`)

  await notifier.disconnect()

  // 既読更新
  const updatedStore = markAsSeen(store, limited, watchlist.settings.deduplicationDays)
  saveSeenStore(updatedStore)
  console.log(`既読データ更新: ${updatedStore.articles.length}件`)

  console.log('\n=== ニュース自動通知 完了 ===')
}

main().catch(error => {
  console.error('実行エラー:', error)
  process.exit(1)
})
