import { getEnv } from '../src/utils/config-loader.js'
import { createNotifier } from '../src/discord/notifier.js'
import { loadFeedbackStore, addNotifiedArticles, saveFeedbackStore } from '../src/feedback/feedback-store.js'
import type { SummarizedArticle } from '../src/utils/types.js'

const testArticle: SummarizedArticle = {
  title: 'What is artificial intelligence (AI)?',
  titleJa: '人工知能（AI）とは何か？',
  url: 'https://www.bbc.com/news/technology-65855333',
  pubDate: new Date(),
  source: 'BBC News',
  category: 'AI',
  keyword: 'AI',
  summary: 'BBCによるAI技術の解説記事。AIの基本的な仕組みや社会への影響について説明しています。',
  importance: '中' as const,
  relevance: 75,
  relevanceReason: 'AI技術の基礎解説',
}

async function main() {
  const env = getEnv()
  const notifier = createNotifier(env.discordBotToken, env.discordChannelId)

  console.log('Discord に接続中...')
  await notifier.connect()

  console.log('テスト記事を投稿中...')
  const result = await notifier.notifyArticle(testArticle)
  console.log(`投稿完了: messageId=${result.messageId}`)

  // feedback-store に登録（👀リアクションで翻訳対象として認識させるため）
  const store = loadFeedbackStore()
  const updated = addNotifiedArticles(store, [result])
  saveFeedbackStore(updated)
  console.log('feedback-store に記録しました')

  await notifier.disconnect()
  console.log('完了')
}

main().catch((error) => {
  console.error('エラー:', error)
  process.exit(1)
})
