import type { Client } from 'discord.js'
import { fetchArticleContent } from '../scraper/article-fetcher.js'
import { createTranslator } from '../ai/translator.js'
import { sendPendingMessage, postTranslationToThread } from '../discord/thread-poster.js'

export async function translateAndPost(
  client: Client,
  channelId: string,
  messageId: string,
  articleUrl: string,
  geminiApiKey: string
): Promise<boolean> {
  try {
    console.log(`  翻訳開始: ${articleUrl}`)

    // 先に「翻訳しています...」を投稿
    const pendingMessage = await sendPendingMessage(client, channelId, messageId)

    const { textContent } = await fetchArticleContent(articleUrl)
    const translator = createTranslator(geminiApiKey)
    const translated = await translator.translateArticle(textContent)

    // 「翻訳しています...」を翻訳結果で上書き
    await postTranslationToThread(client, channelId, messageId, translated, pendingMessage)
    console.log(`  翻訳投稿完了: ${articleUrl}`)
    return true
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.log(`  翻訳スキップ (${articleUrl}): ${msg}`)
    return false
  }
}
