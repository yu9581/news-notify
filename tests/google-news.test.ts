import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectGoogleNews } from '../src/collectors/google-news.js'
import type { Person, Topic, Settings } from '../src/utils/types.js'

const mockSettings: Settings = {
  maxArticlesPerKeyword: 3,
  maxTotalArticles: 10,
  fetchDelayMs: 0,
  summaryMaxTokens: 2048,
  deduplicationDays: 7,
}

const rssResponse = `
<rss>
  <channel>
    <item>
      <title>Sam Altman announces new project</title>
      <link>https://example.com/article1</link>
      <pubDate>Mon, 24 Feb 2026 10:00:00 GMT</pubDate>
      <description><a href="https://tc.com">TechCrunch</a></description>
    </item>
    <item>
      <title>OpenAI updates policy</title>
      <link>https://example.com/article2</link>
      <pubDate>Mon, 24 Feb 2026 09:00:00 GMT</pubDate>
      <description><a href="https://verge.com">The Verge</a></description>
    </item>
  </channel>
</rss>
`

beforeEach(() => {
  vi.restoreAllMocks()
  vi.spyOn(global, 'fetch').mockResolvedValue({
    text: () => Promise.resolve(rssResponse),
  } as Response)
})

describe('collectGoogleNews', () => {
  it('人物のニュースを収集できる', async () => {
    const people: Person[] = [
      { name: 'Sam Altman', keywords: ['Sam Altman'], lang: 'en' },
    ]

    const articles = await collectGoogleNews(people, [], mockSettings)

    expect(articles.length).toBeGreaterThan(0)
    expect(articles[0].category).toBe('Sam Altman')
    expect(articles[0].keyword).toBe('Sam Altman')
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('hl=en&gl=US&ceid=US:en')
    )
  })

  it('トピックのニュースを収集できる', async () => {
    const topics: Topic[] = [
      { name: 'AI', keywords: ['AI news'], lang: 'en' },
    ]

    const articles = await collectGoogleNews([], topics, mockSettings)

    expect(articles.length).toBeGreaterThan(0)
    expect(articles[0].category).toBe('AI')
  })

  it('日本語キーワードはjpパラメータを使う', async () => {
    const people: Person[] = [
      { name: '深津貴之', keywords: ['深津貴之'], lang: 'ja' },
    ]

    await collectGoogleNews(people, [], mockSettings)

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('hl=ja&gl=JP&ceid=JP:ja')
    )
  })

  it('URL重複を除外する', async () => {
    const people: Person[] = [
      { name: 'Test', keywords: ['keyword1', 'keyword2'], lang: 'en' },
    ]

    const articles = await collectGoogleNews(people, [], mockSettings)

    const urls = articles.map(a => a.url)
    const uniqueUrls = [...new Set(urls)]
    expect(urls.length).toBe(uniqueUrls.length)
  })

  it('maxArticlesPerKeywordで結果を制限する', async () => {
    const manyItemsXml = Array.from({ length: 20 }, (_, i) => `
      <item>
        <title>Article ${i}</title>
        <link>https://example.com/article-${i}</link>
        <pubDate>Mon, 24 Feb 2026 ${String(i).padStart(2, '0')}:00:00 GMT</pubDate>
        <description></description>
      </item>
    `).join('')

    vi.spyOn(global, 'fetch').mockResolvedValue({
      text: () => Promise.resolve(`<rss><channel>${manyItemsXml}</channel></rss>`),
    } as Response)

    const settings = { ...mockSettings, maxArticlesPerKeyword: 3 }
    const people: Person[] = [
      { name: 'Test', keywords: ['test'], lang: 'en' },
    ]

    const articles = await collectGoogleNews(people, [], settings)
    expect(articles.length).toBeLessThanOrEqual(3)
  })

  it('fetch失敗時はエラーログを出して続行する', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const people: Person[] = [
      { name: 'Test', keywords: ['test'], lang: 'en' },
    ]

    const articles = await collectGoogleNews(people, [], mockSettings)
    expect(articles).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalled()
  })
})
