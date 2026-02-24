import { Client, GatewayIntentBits } from 'discord.js'
import type { SummarizedArticle } from '../utils/types.js'

interface TextSendable {
  send(content: string): Promise<{ startThread(opts: { name: string; autoArchiveDuration: number }): Promise<{ send(content: string): Promise<unknown> }> }>
}

export function createNotifier(botToken: string, channelId: string) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  })

  async function connect(): Promise<void> {
    await client.login(botToken)
    await new Promise<void>((resolve) => {
      client.once('ready', () => {
        console.log(`Discord Bot 接続完了: ${client.user?.tag}`)
        resolve()
      })
    })
  }

  async function notifyArticle(article: SummarizedArticle): Promise<void> {
    const channel = await client.channels.fetch(channelId)

    if (!channel || !('send' in channel)) {
      throw new Error(`チャンネル ${channelId} が見つからないか、テキストチャンネルではありません`)
    }

    const textChannel = channel as unknown as TextSendable

    const categoryEmoji = getCategoryEmoji(article.category)
    const importanceEmoji = article.importance === '高' ? '🔴' : article.importance === '中' ? '🟡' : '🟢'

    const messageContent = `${categoryEmoji} **[${article.category}]** ${article.title}\n${article.summary}\n📌 出典: ${article.source} | 重要度: ${importanceEmoji} ${article.importance}`

    const message = await textChannel.send(messageContent)

    const thread = await message.startThread({
      name: article.title.slice(0, 100),
      autoArchiveDuration: 1440,
    })

    await thread.send(`🔗 ${article.url}`)
  }

  async function notifyArticles(articles: readonly SummarizedArticle[]): Promise<number> {
    let sent = 0
    for (const article of articles) {
      try {
        await notifyArticle(article)
        sent++
        await sleep(1000)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`  通知失敗: ${article.title} - ${message}`)
      }
    }
    return sent
  }

  async function disconnect(): Promise<void> {
    client.destroy()
    console.log('Discord Bot 切断完了')
  }

  return { connect, notifyArticle, notifyArticles, disconnect }
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
