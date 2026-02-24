import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectRssFeeds } from '../src/collectors/rss-feed.js'
import type { Feed, Settings } from '../src/utils/types.js'

const mockSettings: Settings = {
  maxArticlesPerKeyword: 5,
  maxTotalArticles: 30,
  fetchDelayMs: 0,
  summaryMaxTokens: 2048,
  deduplicationDays: 7,
}

const rssResponse = `
<rss>
  <channel>
    <item>
      <title>AI breakthrough at OpenAI</title>
      <link>https://example.com/ai-news</link>
      <pubDate>Mon, 24 Feb 2026 10:00:00 GMT</pubDate>
      <description>AI related content</description>
    </item>
    <item>
      <title>New smartphone release</title>
      <link>https://example.com/phone-news</link>
      <pubDate>Mon, 24 Feb 2026 09:00:00 GMT</pubDate>
      <description>Phone content</description>
    </item>
    <item>
      <title>OpenAI partnership announced</title>
      <link>https://example.com/openai-partner</link>
      <pubDate>Mon, 24 Feb 2026 08:00:00 GMT</pubDate>
      <description>OpenAI content</description>
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

describe('collectRssFeeds', () => {
  it('RSSフィードから記事を取得できる', async () => {
    const feeds: Feed[] = [
      { name: 'TestFeed', url: 'https://example.com/feed' },
    ]

    const articles = await collectRssFeeds(feeds, mockSettings)
    expect(articles.length).toBe(3)
    expect(articles[0].source).toBe('TestFeed')
    expect(articles[0].category).toBe('TestFeed')
  })

  it('filterKeywordsでフィルタリングする', async () => {
    const feeds: Feed[] = [
      { name: 'TechCrunch', url: 'https://example.com/feed', filterKeywords: ['AI', 'OpenAI'] },
    ]

    const articles = await collectRssFeeds(feeds, mockSettings)
    expect(articles.length).toBe(2)
    expect(articles.every(a =>
      a.title.toLowerCase().includes('ai') || a.title.toLowerCase().includes('openai')
    )).toBe(true)
  })

  it('filterKeywordsがない場合は全記事を返す', async () => {
    const feeds: Feed[] = [
      { name: 'AllNews', url: 'https://example.com/feed' },
    ]

    const articles = await collectRssFeeds(feeds, mockSettings)
    expect(articles.length).toBe(3)
  })

  it('fetch失敗時はエラーログを出して続行する', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const feeds: Feed[] = [
      { name: 'BadFeed', url: 'https://bad.example.com/feed' },
    ]

    const articles = await collectRssFeeds(feeds, mockSettings)
    expect(articles).toHaveLength(0)
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('複数フィードから記事を収集できる', async () => {
    const feeds: Feed[] = [
      { name: 'Feed1', url: 'https://example.com/feed1' },
      { name: 'Feed2', url: 'https://example.com/feed2' },
    ]

    const articles = await collectRssFeeds(feeds, mockSettings)
    expect(articles.length).toBe(6)
    expect(articles.filter(a => a.source === 'Feed1').length).toBe(3)
    expect(articles.filter(a => a.source === 'Feed2').length).toBe(3)
  })
})
