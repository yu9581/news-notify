import { loadWatchlist, getEnv } from './utils/config-loader.js'
import { collectGoogleNews } from './collectors/google-news.js'
import { collectRssFeeds } from './collectors/rss-feed.js'
import { createSummarizer } from './ai/summarizer.js'
import { filterByRelevance } from './ai/relevance-filter.js'
import { createNotifier } from './discord/notifier.js'
import {
  loadSeenStore,
  saveSeenStore,
  filterNewArticles,
  markAsSeen,
} from './dedup/store.js'
import { filterRecent, interleave } from './utils/article-utils.js'
import { collectReactions } from './feedback/reaction-collector.js'
import { loadFeedbackStore, saveFeedbackStore, addNotifiedArticles } from './feedback/feedback-store.js'
import { updateProfileIfNeeded, loadLearningProfile } from './feedback/profile-updater.js'

async function main(): Promise<void> {
  console.log('=== ニュース自動通知 開始 ===')
  console.log(`実行時刻: ${new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`)

  const env = getEnv()
  const watchlist = loadWatchlist()
  const store = loadSeenStore()

  // フィードバック収集（Phase 2）
  console.log('\n--- フィードバック収集 ---')
  const feedbackStore = loadFeedbackStore()
  const notifier = createNotifier(env.discordBotToken, env.discordChannelId)
  await notifier.connect()

  try {
    const updatedFeedbackStore = await collectReactions(
      notifier.getClient(),
      env.discordChannelId,
      feedbackStore,
      { geminiApiKey: env.geminiApiKey }
    )
    saveFeedbackStore(updatedFeedbackStore)
    console.log(`フィードバック収集完了`)

    // 学習プロファイル更新（Phase 3）
    console.log('\n--- 学習プロファイル更新 ---')
    await updateProfileIfNeeded(updatedFeedbackStore, env.geminiApiKey)
    const learningProfile = loadLearningProfile()
    console.log(`学習プロファイル: ${Object.keys(learningProfile).length}カテゴリ`)

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

    // AI要約（関連度評価付き）
    console.log('\n--- AI要約 + 関連度評価 ---')
    const summarizer = createSummarizer(env.geminiApiKey, learningProfile)
    const summarized = await summarizer.summarizeArticles(limited)
    console.log(`要約完了: ${summarized.length}件`)

    // 関連度フィルタ（Phase 1）
    console.log('\n--- 関連度フィルタ ---')
    const { passed, filtered } = filterByRelevance(summarized, watchlist.settings.relevanceThreshold)
    console.log(`通過: ${passed.length}件, 除外: ${filtered.length}件`)
    for (const article of filtered) {
      console.log(`  除外: [${article.category}] ${article.titleJa} (関連度: ${article.relevance}%, 理由: ${article.relevanceReason})`)
    }

    // Discord通知
    console.log('\n--- Discord通知 ---')
    const { sent: sentCount, results: notificationResults } = await notifier.notifyArticles(passed)
    console.log(`通知完了: ${sentCount}件`)

    // フィードバックストアに通知済み記事を追加（Phase 2）
    const finalFeedbackStore = addNotifiedArticles(updatedFeedbackStore, notificationResults)
    saveFeedbackStore(finalFeedbackStore)

    // 既読更新
    const updatedStore = markAsSeen(store, limited, watchlist.settings.deduplicationDays)
    saveSeenStore(updatedStore)
    console.log(`既読データ更新: ${updatedStore.articles.length}件`)
  } finally {
    await notifier.disconnect()
  }

  console.log('\n=== ニュース自動通知 完了 ===')
}

main().catch(error => {
  console.error('実行エラー:', error)
  process.exit(1)
})
