import type { Client, MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js'
import { loadFeedbackStore, saveFeedbackStore } from '../feedback/feedback-store.js'
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

  // メッセージのEmbedからURLを取得
  const embeds = reaction.message.embeds ?? []
  const articleUrl = embeds[0]?.url ?? null

  if (!articleUrl) {
    console.debug(`Embedに記事URLなし (messageId: ${messageId})`)
    return
  }

  // feedback.json で翻訳済みかチェック（あれば参照）
  const store = loadFeedbackStore()
  const existingArticle = store.articles.find(a => a.messageId === messageId)

  if (existingArticle?.translated === true) {
    console.debug(`翻訳済みのためスキップ: ${articleUrl} (messageId: ${messageId})`)
    return
  }

  const env = getEnv()

  console.log(`即時翻訳開始: ${articleUrl} (messageId: ${messageId})`)

  const success = await translateAndPost(
    client,
    channelId,
    messageId,
    articleUrl,
    env.geminiApiKey
  )

  // 翻訳結果を feedback.json に記録
  if (existingArticle) {
    // 既存エントリを更新
    const finalStore = {
      ...store,
      articles: store.articles.map(a =>
        a.messageId === messageId
          ? { ...a, translated: success, feedback: 'positive' as const }
          : a
      ),
      lastUpdated: new Date().toISOString(),
    }
    saveFeedbackStore(finalStore)
  } else {
    // feedback.json にエントリがない場合は新規追加
    const newArticle = {
      messageId,
      articleUrl,
      category: '',
      keyword: '',
      relevance: 0,
      notifiedAt: new Date().toISOString(),
      feedback: 'positive' as const,
      translated: success,
    }
    const finalStore = {
      articles: [...store.articles, newArticle],
      lastUpdated: new Date().toISOString(),
    }
    saveFeedbackStore(finalStore)
  }

  if (success) {
    console.log(`即時翻訳完了: ${articleUrl}`)
  } else {
    console.log(`即時翻訳失敗: ${articleUrl}`)
  }
}
