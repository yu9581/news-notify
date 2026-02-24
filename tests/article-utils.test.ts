import { describe, it, expect } from 'vitest'
import { filterRecent, interleave } from '../src/utils/article-utils.js'
import type { Article } from '../src/utils/types.js'

const makeArticle = (hoursAgo: number, source: string = 'Test'): Article => ({
  title: `Article from ${hoursAgo}h ago`,
  url: `https://example.com/${hoursAgo}-${source}`,
  pubDate: new Date(Date.now() - hoursAgo * 60 * 60 * 1000),
  source,
  category: source,
  keyword: 'test',
})

describe('filterRecent', () => {
  it('指定時間以内の記事のみ返す', () => {
    const articles = [
      makeArticle(1),
      makeArticle(12),
      makeArticle(23),
      makeArticle(25),
      makeArticle(48),
    ]

    const recent = filterRecent(articles, 24)
    expect(recent).toHaveLength(3)
  })

  it('すべて古い場合は空配列を返す', () => {
    const articles = [makeArticle(30), makeArticle(48)]
    const recent = filterRecent(articles, 24)
    expect(recent).toHaveLength(0)
  })

  it('すべて新しい場合は全件返す', () => {
    const articles = [makeArticle(1), makeArticle(2), makeArticle(3)]
    const recent = filterRecent(articles, 24)
    expect(recent).toHaveLength(3)
  })
})

describe('interleave', () => {
  it('2つのグループを交互に並べる', () => {
    const google = [makeArticle(1, 'Google'), makeArticle(2, 'Google')]
    const rss = [makeArticle(1, 'RSS'), makeArticle(2, 'RSS')]

    const result = interleave(google, rss)
    expect(result).toHaveLength(4)
    expect(result[0].source).toBe('Google')
    expect(result[1].source).toBe('RSS')
    expect(result[2].source).toBe('Google')
    expect(result[3].source).toBe('RSS')
  })

  it('片方が多い場合も全件含む', () => {
    const google = [makeArticle(1, 'Google'), makeArticle(2, 'Google'), makeArticle(3, 'Google')]
    const rss = [makeArticle(1, 'RSS')]

    const result = interleave(google, rss)
    expect(result).toHaveLength(4)
    expect(result[0].source).toBe('Google')
    expect(result[1].source).toBe('RSS')
    expect(result[2].source).toBe('Google')
    expect(result[3].source).toBe('Google')
  })

  it('片方が空でも動く', () => {
    const google = [makeArticle(1, 'Google')]
    const result = interleave(google, [])
    expect(result).toHaveLength(1)
  })

  it('両方空なら空配列を返す', () => {
    const result = interleave([], [])
    expect(result).toHaveLength(0)
  })
})
