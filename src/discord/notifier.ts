import { Client, GatewayIntentBits } from 'discord.js'
import type { SummarizedArticle } from '../utils/types.js'

export interface NotificationResult {
  readonly messageId: string
  readonly article: SummarizedArticle
}

interface TextSendable {
  send(content: string): Promise<{ id: string; startThread(opts: { name: string; autoArchiveDuration: number }): Promise<{ send(content: string): Promise<unknown> }> }>
}

export function createNotifier(botToken: string, channelId: string) {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessageReactions,
    ],
  })

  function getClient() {
    return client
  }

  async function connect(): Promise<void> {
    await client.login(botToken)
    await new Promise<void>((resolve) => {
      client.once('ready', () => {
        console.log(`Discord Bot 接続完了: ${client.user?.tag}`)
        resolve()
      })
    })
  }

  async function notifyArticle(article: SummarizedArticle): Promise<NotificationResult> {
    const channel = await client.channels.fetch(channelId)

    if (!channel || !('send' in channel)) {
      throw new Error(`チャンネル ${channelId} が見つからないか、テキストチャンネルではありません`)
    }

    const textChannel = channel as unknown as TextSendable

    const categoryEmoji = getCategoryEmoji(article.category)
    const importanceEmoji = article.importance === '高' ? '🔴' : article.importance === '中' ? '🟡' : '🟢'

    const displayTitle = article.titleJa ?? article.title
    const relevanceDisplay = `関連度: ${article.relevance}%`
    const messageContent = `${categoryEmoji} **[${article.category}]**\n**${displayTitle}**\n📝 要約: ${article.summary}\n📌 出典: ${article.source} | 重要度: ${importanceEmoji} ${article.importance} | ${relevanceDisplay}`

    const message = await textChannel.send(messageContent)

    const thread = await message.startThread({
      name: article.title.slice(0, 100),
      autoArchiveDuration: 1440,
    })

    await thread.send(`🔗 ${article.url}`)

    return { messageId: message.id, article }
  }

  async function notifyArticles(articles: readonly SummarizedArticle[]): Promise<{ sent: number; results: NotificationResult[] }> {
    let sent = 0
    const results: NotificationResult[] = []
    for (const article of articles) {
      try {
        const result = await notifyArticle(article)
        results.push(result)
        sent++
        await sleep(1000)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`  通知失敗: ${article.title} - ${message}`)
      }
    }
    return { sent, results }
  }

  async function disconnect(): Promise<void> {
    client.destroy()
    console.log('Discord Bot 切断完了')
  }

  return { connect, notifyArticle, notifyArticles, disconnect, getClient }
}

function getCategoryEmoji(category: string): string {
  const emojiMap: Record<string, string> = {
    'AI': '🤖',
    'LLM': '🧠',
    'TechCrunch': '📰',
    'The Verge AI': '📡',
    'Hacker News AI': '💻',
  }
  return emojiMap[category] ?? '📌'
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
