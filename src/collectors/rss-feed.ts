import { parseRssItems } from '../utils/xml-parser.js'
import type { Article, Feed, Settings } from '../utils/types.js'

export async function collectRssFeeds(
  feeds: readonly Feed[],
  settings: Settings
): Promise<Article[]> {
  const articles: Article[] = []

  for (const feed of feeds) {
    try {
      console.log(`[RSS] ${feed.name} を取得中...`)
      const response = await fetch(feed.url)
      const xml = await response.text()
      const items = parseRssItems(xml)

      const filtered = feed.filterKeywords
        ? items.filter(item =>
            feed.filterKeywords!.some(kw =>
              item.title.toLowerCase().includes(kw.toLowerCase())
            )
          )
        : items

      for (const item of filtered.slice(0, settings.maxArticlesPerKeyword)) {
        articles.push({
          title: item.title,
          url: item.url,
          pubDate: item.pubDate,
          source: feed.name,
          category: feed.name,
          keyword: feed.filterKeywords?.join(', ') ?? feed.name,
        })
      }

      await sleep(settings.fetchDelayMs)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`  フィード「${feed.name}」の取得に失敗: ${message}`)
    }
  }

  return articles
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
