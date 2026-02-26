import type { Client, MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js'
import { loadFeedbackStore, saveFeedbackStore, updateArticleFeedback } from '../feedback/feedback-store.js'
import { translateAndPost } from '../services/translate-service.js'
import { getEnv } from '../utils/config-loader.js'

const POSITIVE_EMOJI = '👀'

// 処理キュー: feedback.json の読み書き競合を防ぐ
let processingQueue: Promise<void> = Promise.resolve()

export function registerReactionHandler(client: Client, channelId: string): void {
  client.on('messageReactionAdd', async (reaction: MessageReaction | PartialMessageReaction, user: User | PartialUser) => {
    // キューに追加して直列化
    processingQueue = processingQueue.then(async () => {
      try {
        await handleReactionAdd(client, reaction, user, channelId)
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error(`リアクション処理エラー: ${msg}`)
      }
    })
    await processingQueue
  })

  console.log('リアクションハンドラー登録完了')
}

// テスト用: キューをリセット
export function resetProcessingQueue(): void {
  processingQueue = Promise.resolve()
}

async function handleReactionAdd(
  client: Client,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
  channelId: string
): Promise<void> {
  // Bot自身のリアクションは無視
  if (user.bot) return

  // 👀以外は無視
  if (reaction.emoji.name !== POSITIVE_EMOJI) return

  // Partialの場合はフルデータを取得
  if (reaction.partial) {
    reaction = await reaction.fetch()
  }

  // 対象チャンネル以外は無視
  if (reaction.message.channelId !== channelId) return

  const messageId = reaction.message.id

  // feedback.json から対象記事を検索
  const store = loadFeedbackStore()
  const article = store.articles.find(a => a.messageId === messageId)

  // 記事がない場合は無視
  if (!article) return

  // 既に翻訳済みなら無視
  if (article.translated === true) return

  // 既にpositive済みで翻訳未完了の場合は翻訳だけ実行
  const env = getEnv()
  const needsFeedbackUpdate = article.feedback !== 'positive'

  const updatedStore = needsFeedbackUpdate
    ? updateArticleFeedback(store, messageId, 'positive')
    : store

  console.log(`即時翻訳開始: ${article.articleUrl} (messageId: ${messageId})`)

  const success = await translateAndPost(
    client,
    channelId,
    messageId,
    article.articleUrl,
    env.geminiApiKey
  )

  // 翻訳結果を反映して保存
  const finalStore = {
    ...updatedStore,
    articles: updatedStore.articles.map(a =>
      a.messageId === messageId
        ? { ...a, translated: success, feedback: 'positive' as const }
        : a
    ),
    lastUpdated: new Date().toISOString(),
  }
  saveFeedbackStore(finalStore)

  if (success) {
    console.log(`即時翻訳完了: ${article.articleUrl}`)
  } else {
    console.log(`即時翻訳失敗: ${article.articleUrl}`)
  }
}
