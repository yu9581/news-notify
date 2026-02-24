import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Article, SummarizedArticle } from '../utils/types.js'

const SUMMARY_PROMPT = `以下のニュース記事を日本語で簡潔に要約してください。

タイトル: {title}
出典: {source}
URL: {url}

以下のJSON形式のみで返してください（JSON以外のテキストは絶対に含めないでください）:
{
  "titleJa": "タイトルの日本語訳",
  "summary": "3〜5文の日本語要約",
  "importance": "高/中/低"
}

ルール:
- titleJaはタイトルが英語の場合は自然な日本語に翻訳する。すでに日本語の場合はそのまま返す
- 要約は日本語で3〜5文
- 重要度は「高」「中」「低」のいずれか
- AI業界への影響が大きいものは「高」
- 一般的なニュースは「中」
- 軽微な更新は「低」`

export function createSummarizer(apiKey: string) {
  const genAI = new GoogleGenerativeAI(apiKey)

  async function summarizeArticle(article: Article): Promise<SummarizedArticle> {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    })

    const prompt = SUMMARY_PROMPT
      .replace('{title}', article.title)
      .replace('{source}', article.source)
      .replace('{url}', article.url)

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = extractJSON(text)

    if (!parsed) {
      return {
        ...article,
        titleJa: article.title,
        summary: '要約の取得に失敗しました',
        importance: '中',
      }
    }

    return {
      ...article,
      titleJa: parsed.titleJa ?? article.title,
      summary: parsed.summary ?? '要約の取得に失敗しました',
      importance: parsed.importance ?? '中',
    }
  }

  async function summarizeArticles(
    articles: readonly Article[],
    delayMs: number = 500
  ): Promise<SummarizedArticle[]> {
    const results: SummarizedArticle[] = []

    for (const article of articles) {
      try {
        console.log(`  要約中: ${article.title.slice(0, 50)}...`)
        const summarized = await summarizeArticle(article)
        results.push(summarized)
        await sleep(delayMs)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`  要約失敗: ${article.title} - ${message}`)
        results.push({
          ...article,
          titleJa: article.title,
          summary: '要約の取得に失敗しました',
          importance: '中',
        })
      }
    }

    return results
  }

  return { summarizeArticle, summarizeArticles }
}

function extractJSON(text: string): Record<string, string> | null {
  try {
    return JSON.parse(text)
  } catch { /* empty */ }

  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim())
    } catch { /* empty */ }
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0])
    } catch { /* empty */ }
  }

  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
