import { describe, it, expect } from 'vitest'
import { hashUrl, filterNewArticles, markAsSeen } from '../src/dedup/store.js'
import type { Article, SeenStore } from '../src/utils/types.js'

const makeArticle = (url: string, title: string = 'Test'): Article => ({
  title,
  url,
  pubDate: new Date(),
  source: 'Test',
  category: 'Test',
  keyword: 'test',
})

describe('hashUrl', () => {
  it('同じURLは同じハッシュを返す', () => {
    const hash1 = hashUrl('https://example.com/article1')
    const hash2 = hashUrl('https://example.com/article1')
    expect(hash1).toBe(hash2)
  })

  it('異なるURLは異なるハッシュを返す', () => {
    const hash1 = hashUrl('https://example.com/article1')
    const hash2 = hashUrl('https://example.com/article2')
    expect(hash1).not.toBe(hash2)
  })

  it('16文字のハッシュを返す', () => {
    const hash = hashUrl('https://example.com')
    expect(hash).toHaveLength(16)
  })
})

describe('filterNewArticles', () => {
  it('既知の記事を除外する', () => {
    const articles = [
      makeArticle('https://example.com/1'),
      makeArticle('https://example.com/2'),
      makeArticle('https://example.com/3'),
    ]

    const store: SeenStore = {
      articles: [
        { urlHash: hashUrl('https://example.com/1'), title: 'Old', seenAt: new Date().toISOString() },
        { urlHash: hashUrl('https://example.com/3'), title: 'Old', seenAt: new Date().toISOString() },
      ],
      lastUpdated: new Date().toISOString(),
    }

    const newArticles = filterNewArticles(articles, store)
    expect(newArticles).toHaveLength(1)
    expect(newArticles[0].url).toBe('https://example.com/2')
  })

  it('ストアが空なら全記事を返す', () => {
    const articles = [
      makeArticle('https://example.com/1'),
      makeArticle('https://example.com/2'),
    ]

    const store: SeenStore = { articles: [], lastUpdated: '' }
    const newArticles = filterNewArticles(articles, store)
    expect(newArticles).toHaveLength(2)
  })
})

describe('markAsSeen', () => {
  it('新しい記事を既読に追加する', () => {
    const store: SeenStore = { articles: [], lastUpdated: '' }
    const articles = [
      makeArticle('https://example.com/new1'),
      makeArticle('https://example.com/new2'),
    ]

    const updated = markAsSeen(store, articles, 7)
    expect(updated.articles).toHaveLength(2)
    expect(updated.lastUpdated).toBeTruthy()
  })

  it('期限切れの記事を削除する', () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const store: SeenStore = {
      articles: [
        { urlHash: 'old-hash', title: 'Old Article', seenAt: oldDate },
      ],
      lastUpdated: oldDate,
    }

    const updated = markAsSeen(store, [], 7)
    expect(updated.articles).toHaveLength(0)
  })

  it('期限内の記事は保持する', () => {
    const recentDate = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    const store: SeenStore = {
      articles: [
        { urlHash: 'recent-hash', title: 'Recent Article', seenAt: recentDate },
      ],
      lastUpdated: recentDate,
    }

    const newArticles = [makeArticle('https://example.com/new')]
    const updated = markAsSeen(store, newArticles, 7)
    expect(updated.articles).toHaveLength(2)
  })
})
