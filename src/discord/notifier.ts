import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js'
import type { SummarizedArticle } from '../utils/types.js'

export interface NotificationResult {
  readonly messageId: string
  readonly article: SummarizedArticle
}

interface EmbedSendable {
  send(options: { embeds: EmbedBuilder[] }): Promise<{
    id: string
    startThread(opts: { name: string; autoArchiveDuration: number }): Promise<{
      send(content: string): Promise<unknown>
    }>
  }>
}

export interface CreateNotifierOptions {
  readonly client?: Client
}

export function createNotifier(botToken: string, channelId: string, options: CreateNotifierOptions = {}) {
  const externalClient = options.client
  const client = externalClient ?? new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessageReactions,
    ],
  })

  function getClient() {
    return client
  }

  async function connect(): Promise<void> {
    if (externalClient) {
      // 外部clientは既に接続済み
      return
    }
    const readyPromise = new Promise<void>((resolve) => {
      client.once('ready', () => {
        console.log(`Discord Bot 接続完了: ${client.user?.tag}`)
        resolve()
      })
    })
    await client.login(botToken)
    await readyPromise
  }

  async function notifyArticle(article: SummarizedArticle): Promise<NotificationResult> {
    const channel = await client.channels.fetch(channelId)

    if (!channel || !('send' in channel)) {
      throw new Error(`チャンネル ${channelId} が見つからないか、テキストチャンネルではありません`)
    }

    const textChannel = channel as unknown as EmbedSendable

    const categoryEmoji = getCategoryEmoji(article.category)
    const importanceEmoji = article.importance === '高' ? '🔴' : article.importance === '中' ? '🟡' : '🟢'
    const importanceColor = article.importance === '高' ? 0xED4245 : article.importance === '中' ? 0xFEE75C : 0x57F287

    const displayTitle = article.titleJa ?? article.title
    const formattedSummary = article.summary.replace(/。(?!$)/g, '。\n')

    const embed = new EmbedBuilder()
      .setColor(importanceColor)
      .setTitle(`${categoryEmoji} [${article.category}] ${displayTitle}`)
      .setURL(article.url)
      .setDescription(formattedSummary)
      .addFields(
        { name: '出典', value: article.source, inline: true },
        { name: '重要度', value: `${importanceEmoji} ${article.importance}`, inline: true },
        { name: '関連度', value: `${article.relevance}%`, inline: true },
      )

    const message = await textChannel.send({ embeds: [embed] })

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
    if (externalClient) {
      // 外部clientのライフサイクルは呼び出し元が管理する
      return
    }
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
