import type { Client } from 'discord.js'
import type { FeedbackStore } from './feedback-store.js'
import { updateArticleFeedback, cleanOldArticles } from './feedback-store.js'
import { translateAndPost } from '../services/translate-service.js'

const POSITIVE_EMOJI = '👀'
const NEGATIVE_EMOJI = '❌'

export interface CollectReactionsOptions {
  readonly geminiApiKey?: string
}

export async function collectReactions(
  client: Client,
  channelId: string,
  store: FeedbackStore,
  options: CollectReactionsOptions = {}
): Promise<FeedbackStore> {
  // フィードバック未取得の記事のみ対象
  const pendingArticles = store.articles.filter(a => a.feedback === undefined)

  if (pendingArticles.length === 0) {
    console.log('  フィードバック待ちの記事なし')
    return cleanOldArticles(store, 30)
  }

  console.log(`  フィードバック待ち: ${pendingArticles.length}件`)

  let updatedStore = store
  let collectedCount = 0

  for (const article of pendingArticles) {
    try {
      const channel = await client.channels.fetch(channelId)
      if (!channel || !('messages' in channel)) continue

      const textChannel = channel as { messages: { fetch(id: string): Promise<{ reactions: { cache: Map<string, { count: number }> } }> } }
      const message = await textChannel.messages.fetch(article.messageId)

      const positiveReaction = message.reactions.cache.find(
        (_r: { count: number }, key: string) => key === POSITIVE_EMOJI
      )
      const negativeReaction = message.reactions.cache.find(
        (_r: { count: number }, key: string) => key === NEGATIVE_EMOJI
      )

      const positiveCount = positiveReaction ? positiveReaction.count : 0
      const negativeCount = negativeReaction ? negativeReaction.count : 0

      if (positiveCount > 0 && positiveCount >= negativeCount) {
        updatedStore = updateArticleFeedback(updatedStore, article.messageId, 'positive')
        collectedCount++

        // 👀の記事を翻訳してスレッドに投稿
        if (options.geminiApiKey) {
          await translateAndPost(client, channelId, article.messageId, article.articleUrl, options.geminiApiKey)
        }
      } else if (negativeCount > 0) {
        updatedStore = updateArticleFeedback(updatedStore, article.messageId, 'negative')
        collectedCount++
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      // メッセージが削除済みなどの場合はスキップ
      console.log(`  リアクション取得スキップ (${article.messageId}): ${msg}`)
    }
  }

  console.log(`  フィードバック取得: ${collectedCount}件`)

  // 30日以上前の記事はクリーンアップ
  return cleanOldArticles(updatedStore, 30)
}
