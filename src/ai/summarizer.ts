import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Article, SummarizedArticle } from '../utils/types.js'
import { extractJSON } from '../utils/json-parser.js'

const SUMMARY_PROMPT = `以下のニュース記事を日本語で簡潔に要約し、指定されたカテゴリ/キーワードとの関連度を評価してください。

タイトル: {title}
出典: {source}
URL: {url}
カテゴリ: {category}
検索キーワード: {keyword}
{learningProfile}

以下のJSON形式のみで返してください（JSON以外のテキストは絶対に含めないでください）:
{
  "titleJa": "タイトルの日本語訳",
  "summary": "3〜5文の日本語要約",
  "importance": "高/中/低",
  "relevance": 0〜100の数値,
  "relevanceReason": "関連度の判定理由"
}

ルール:
- titleJaはタイトルが英語の場合は自然な日本語に翻訳する。すでに日本語の場合はそのまま返す
- 要約は日本語で3〜5文
- 重要度は「高」「中」「低」のいずれか
- AI業界への影響が大きいものは「高」
- 一般的なニュースは「中」
- 軽微な更新は「低」

関連度評価ルール:
- relevanceは0〜100の整数で、カテゴリ/キーワードとの関連度を示す
- 100: カテゴリの人物/トピックが記事の主題である
- 70-99: カテゴリの人物/トピックに直接言及がある
- 40-69: 間接的に関連がある（同じ業界・分野のニュース）
- 0-39: ほぼ無関係（キーワードが偶然一致しただけ）
- 例: カテゴリ「家入一真」でキーワード「CAMPFIRE」の場合、CAMPFIRE社のニュースでも家入一真氏への言及がなければ関連度は低い（20〜40程度）
- relevanceReasonには判定理由を1文で記載する`

export interface LearningProfile {
  readonly [category: string]: string
}

export function createSummarizer(apiKey: string, learningProfile: LearningProfile = {}) {
  const genAI = new GoogleGenerativeAI(apiKey)

  async function summarizeArticle(article: Article): Promise<SummarizedArticle> {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 2048,
      },
    })

    const profileText = learningProfile[article.category]
      ? `\n学習済みの傾向:\n${learningProfile[article.category]}`
      : ''

    const prompt = SUMMARY_PROMPT
      .replace('{title}', article.title)
      .replace('{source}', article.source)
      .replace('{url}', article.url)
      .replace('{category}', article.category)
      .replace('{keyword}', article.keyword)
      .replace('{learningProfile}', profileText)

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const parsed = extractJSON(text)

    if (!parsed) {
      return {
        ...article,
        titleJa: article.title,
        summary: '要約の取得に失敗しました',
        importance: '中',
        relevance: 50,
        relevanceReason: '関連度の評価に失敗しました',
      }
    }

    const rawImportance = String(parsed.importance ?? '中')
    const importance = (['高', '中', '低'].includes(rawImportance) ? rawImportance : '中') as '高' | '中' | '低'
    const relevance = Math.min(100, Math.max(0, Number(parsed.relevance) || 50))

    return {
      ...article,
      titleJa: String(parsed.titleJa ?? article.title),
      summary: String(parsed.summary ?? '要約の取得に失敗しました'),
      importance,
      relevance,
      relevanceReason: String(parsed.relevanceReason ?? '判定理由なし'),
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
          relevance: 50,
          relevanceReason: '要約処理でエラーが発生',
        })
      }
    }

    return results
  }

  return { summarizeArticle, summarizeArticles }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
