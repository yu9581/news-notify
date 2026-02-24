import { parseRssItems } from '../utils/xml-parser.js'
import type { Article, Person, Topic, Settings } from '../utils/types.js'

const BASE_URL = 'https://news.google.com/rss/search'

export async function collectGoogleNews(
  people: readonly Person[],
  topics: readonly Topic[],
  settings: Settings
): Promise<Article[]> {
  const articles: Article[] = []

  for (const person of people) {
    const items = await fetchNewsForKeywords(
      person.keywords,
      person.lang,
      person.name,
      'person',
      settings.maxArticlesPerKeyword,
      settings.fetchDelayMs
    )
    articles.push(...items)
  }

  for (const topic of topics) {
    const items = await fetchNewsForKeywords(
      topic.keywords,
      topic.lang,
      topic.name,
      'topic',
      settings.maxArticlesPerKeyword,
      settings.fetchDelayMs
    )
    articles.push(...items)
  }

  return articles
}

async function fetchNewsForKeywords(
  keywords: readonly string[],
  lang: 'en' | 'ja',
  category: string,
  _type: string,
  maxArticles: number,
  delayMs: number
): Promise<Article[]> {
  const seenUrls = new Set<string>()
  const articles: Article[] = []

  const langParams = lang === 'ja'
    ? 'hl=ja&gl=JP&ceid=JP:ja'
    : 'hl=en&gl=US&ceid=US:en'

  for (const keyword of keywords) {
    try {
      const url = `${BASE_URL}?q=${encodeURIComponent(keyword)}&${langParams}`
      const response = await fetch(url)
      const xml = await response.text()
      const items = parseRssItems(xml)

      for (const item of items) {
        if (!seenUrls.has(item.url)) {
          seenUrls.add(item.url)
          articles.push({
            title: item.title,
            url: item.url,
            pubDate: item.pubDate,
            source: item.source,
            category,
            keyword,
          })
        }
        if (articles.length >= maxArticles * 2) break
      }

      await sleep(delayMs)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  キーワード「${keyword}」の取得に失敗: ${message}`)
    }
  }

  return articles
    .sort((a, b) => b.pubDate.getTime() - a.pubDate.getTime())
    .slice(0, maxArticles)
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
