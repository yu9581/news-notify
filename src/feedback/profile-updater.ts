import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getRootDir } from '../utils/config-loader.js'
import { extractJSON } from '../utils/json-parser.js'
import type { FeedbackStore } from './feedback-store.js'
import { getArticlesWithFeedback } from './feedback-store.js'
import type { LearningProfile } from '../ai/summarizer.js'

const PROFILE_PATH = join(getRootDir(), 'data', 'learning-profile.json')
const MIN_FEEDBACK_COUNT = 5

const PROFILE_PROMPT = `以下は、あるカテゴリ「{category}」のニュース記事に対するユーザーのフィードバックです。

👀（関連あり・興味あり）と判定された記事:
{positiveArticles}

❌（関連なし・興味なし）と判定された記事:
{negativeArticles}

このフィードバックから、以下を分析してJSON形式で返してください:
{
  "profile": "このカテゴリでユーザーが求めている記事の傾向と、不要と判断された記事の傾向を3〜5文で記述"
}

ルール:
- 「profile」には、今後の関連度評価に使える具体的な判定基準を含める
- 例: 「このカテゴリでは、〇〇氏本人の発言や活動に関する記事が求められており、〇〇氏が所属する企業の一般的な事業ニュース（〇〇氏への言及なし）は不要と判断されている」`

export function loadLearningProfile(): LearningProfile {
  try {
    const raw = readFileSync(PROFILE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function saveLearningProfile(profile: LearningProfile): void {
  writeFileSync(PROFILE_PATH, JSON.stringify(profile, null, 2), 'utf-8')
}

function getCategoriesNeedingUpdate(store: FeedbackStore): string[] {
  const categoryFeedbackCounts = new Map<string, number>()

  for (const article of store.articles) {
    if (article.feedback !== undefined) {
      const count = categoryFeedbackCounts.get(article.category) ?? 0
      categoryFeedbackCounts.set(article.category, count + 1)
    }
  }

  return Array.from(categoryFeedbackCounts.entries())
    .filter(([, count]) => count >= MIN_FEEDBACK_COUNT)
    .map(([category]) => category)
}

export async function updateProfileIfNeeded(
  store: FeedbackStore,
  apiKey: string
): Promise<void> {
  const categories = getCategoriesNeedingUpdate(store)

  if (categories.length === 0) {
    console.log('  プロファイル更新不要（フィードバック不足）')
    return
  }

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: {
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  })

  const currentProfile = loadLearningProfile()
  let updatedProfile = { ...currentProfile }

  for (const category of categories) {
    try {
      console.log(`  プロファイル更新中: ${category}`)
      const articles = getArticlesWithFeedback(store, category)

      const positiveArticles = articles
        .filter(a => a.feedback === 'positive')
        .map(a => `- URL: ${a.articleUrl}, キーワード: ${a.keyword}, 関連度: ${a.relevance}%`)
        .join('\n')

      const negativeArticles = articles
        .filter(a => a.feedback === 'negative')
        .map(a => `- URL: ${a.articleUrl}, キーワード: ${a.keyword}, 関連度: ${a.relevance}%`)
        .join('\n')

      const prompt = PROFILE_PROMPT
        .replace('{category}', category)
        .replace('{positiveArticles}', positiveArticles || 'なし')
        .replace('{negativeArticles}', negativeArticles || 'なし')

      const result = await model.generateContent(prompt)
      const text = result.response.text()
      const parsed = extractJSON(text)

      if (parsed?.profile) {
        updatedProfile = { ...updatedProfile, [category]: String(parsed.profile) }
        console.log(`  プロファイル更新完了: ${category}`)
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      console.error(`  プロファイル更新失敗: ${category} - ${msg}`)
    }
  }

  saveLearningProfile(updatedProfile)
}
