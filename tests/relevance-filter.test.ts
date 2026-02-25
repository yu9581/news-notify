import { describe, it, expect } from 'vitest'
import { filterByRelevance } from '../src/ai/relevance-filter.js'
import type { SummarizedArticle } from '../src/utils/types.js'

const makeArticle = (relevance: number, title: string = 'Test'): SummarizedArticle => ({
  title,
  titleJa: title,
  url: `https://example.com/${title}`,
  pubDate: new Date(),
  source: 'Test',
  category: 'AI',
  keyword: 'AI',
  summary: 'テスト要約',
  importance: '中',
  relevance,
  relevanceReason: 'テスト理由',
})

describe('filterByRelevance', () => {
  it('閾値以上の記事のみ通過する', () => {
    const articles = [
      makeArticle(80, 'high'),
      makeArticle(30, 'low'),
      makeArticle(50, 'border'),
    ]

    const { passed, filtered } = filterByRelevance(articles, 50)

    expect(passed).toHaveLength(2)
    expect(filtered).toHaveLength(1)
    expect(passed.map(a => a.title)).toEqual(['high', 'border'])
    expect(filtered[0].title).toBe('low')
  })

  it('すべて通過する場合', () => {
    const articles = [makeArticle(90), makeArticle(70)]
    const { passed, filtered } = filterByRelevance(articles, 50)

    expect(passed).toHaveLength(2)
    expect(filtered).toHaveLength(0)
  })

  it('すべて除外される場合', () => {
    const articles = [makeArticle(10), makeArticle(20)]
    const { passed, filtered } = filterByRelevance(articles, 50)

    expect(passed).toHaveLength(0)
    expect(filtered).toHaveLength(2)
  })

  it('空配列を渡した場合', () => {
    const { passed, filtered } = filterByRelevance([], 50)

    expect(passed).toHaveLength(0)
    expect(filtered).toHaveLength(0)
  })

  it('閾値0ですべて通過する', () => {
    const articles = [makeArticle(0), makeArticle(100)]
    const { passed, filtered } = filterByRelevance(articles, 0)

    expect(passed).toHaveLength(2)
    expect(filtered).toHaveLength(0)
  })

  it('閾値ちょうどの記事は通過する', () => {
    const articles = [makeArticle(50)]
    const { passed } = filterByRelevance(articles, 50)

    expect(passed).toHaveLength(1)
  })
})
