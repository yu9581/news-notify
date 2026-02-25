import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { NotificationResult } from '../src/discord/notifier.js'
import type { SummarizedArticle } from '../src/utils/types.js'

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockImplementation(() => {
    throw new Error('File not found')
  }),
  writeFileSync: vi.fn(),
}))

vi.mock('../src/utils/config-loader.js', () => ({
  getRootDir: () => '/mock/root',
}))

const mockArticle: SummarizedArticle = {
  title: 'Test Article',
  titleJa: 'テスト記事',
  url: 'https://example.com/test',
  pubDate: new Date(),
  source: 'Test',
  category: '家入一真',
  keyword: 'CAMPFIRE',
  summary: 'テスト要約',
  importance: '中',
  relevance: 75,
  relevanceReason: 'テスト理由',
}

describe('feedback-store', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ファイルが存在しない場合は空のストアを返す', async () => {
    const { loadFeedbackStore } = await import('../src/feedback/feedback-store.js')
    const store = loadFeedbackStore()

    expect(store.articles).toEqual([])
    expect(store.lastUpdated).toBe('')
  })

  it('通知済み記事を追加できる', async () => {
    const { addNotifiedArticles } = await import('../src/feedback/feedback-store.js')
    const store = { articles: [], lastUpdated: '' }
    const results: NotificationResult[] = [
      { messageId: '123', article: mockArticle },
    ]

    const updated = addNotifiedArticles(store, results)

    expect(updated.articles).toHaveLength(1)
    expect(updated.articles[0].messageId).toBe('123')
    expect(updated.articles[0].articleUrl).toBe('https://example.com/test')
    expect(updated.articles[0].category).toBe('家入一真')
    expect(updated.articles[0].keyword).toBe('CAMPFIRE')
    expect(updated.articles[0].relevance).toBe(75)
  })

  it('フィードバックを更新できる', async () => {
    const { updateArticleFeedback } = await import('../src/feedback/feedback-store.js')
    const store = {
      articles: [{
        messageId: '123',
        articleUrl: 'https://example.com/test',
        category: '家入一真',
        keyword: 'CAMPFIRE',
        relevance: 75,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const updated = updateArticleFeedback(store, '123', 'negative')

    expect(updated.articles[0].feedback).toBe('negative')
  })

  it('存在しないメッセージIDのフィードバック更新はスキップされる', async () => {
    const { updateArticleFeedback } = await import('../src/feedback/feedback-store.js')
    const store = {
      articles: [{
        messageId: '123',
        articleUrl: 'https://example.com/test',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const updated = updateArticleFeedback(store, '999', 'positive')

    expect(updated.articles[0].feedback).toBeUndefined()
  })

  it('カテゴリ別のフィードバック付き記事を取得できる', async () => {
    const { getArticlesWithFeedback } = await import('../src/feedback/feedback-store.js')
    const store = {
      articles: [
        { messageId: '1', articleUrl: 'url1', category: 'AI', keyword: 'AI', relevance: 80, notifiedAt: '', feedback: 'positive' as const },
        { messageId: '2', articleUrl: 'url2', category: 'AI', keyword: 'AI', relevance: 30, notifiedAt: '', feedback: 'negative' as const },
        { messageId: '3', articleUrl: 'url3', category: 'LLM', keyword: 'LLM', relevance: 90, notifiedAt: '', feedback: 'positive' as const },
        { messageId: '4', articleUrl: 'url4', category: 'AI', keyword: 'AI', relevance: 50, notifiedAt: '' },
      ],
      lastUpdated: '',
    }

    const aiArticles = getArticlesWithFeedback(store, 'AI')
    expect(aiArticles).toHaveLength(2)

    const llmArticles = getArticlesWithFeedback(store, 'LLM')
    expect(llmArticles).toHaveLength(1)
  })

  it('古い記事をクリーンアップできる', async () => {
    const { cleanOldArticles } = await import('../src/feedback/feedback-store.js')
    const now = new Date()
    const oldDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
    const recentDate = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)

    const store = {
      articles: [
        { messageId: '1', articleUrl: 'url1', category: 'AI', keyword: 'AI', relevance: 80, notifiedAt: oldDate.toISOString() },
        { messageId: '2', articleUrl: 'url2', category: 'AI', keyword: 'AI', relevance: 90, notifiedAt: recentDate.toISOString() },
      ],
      lastUpdated: '',
    }

    const cleaned = cleanOldArticles(store, 30)
    expect(cleaned.articles).toHaveLength(1)
    expect(cleaned.articles[0].messageId).toBe('2')
  })

  it('translated: true を記録できる', async () => {
    const { updateArticleTranslated } = await import('../src/feedback/feedback-store.js')
    const store = {
      articles: [{
        messageId: '123',
        articleUrl: 'https://example.com/test',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
        feedback: 'positive' as const,
      }],
      lastUpdated: '',
    }

    const updated = updateArticleTranslated(store, '123', true)

    expect(updated.articles[0].translated).toBe(true)
  })

  it('translated: false を記録できる', async () => {
    const { updateArticleTranslated } = await import('../src/feedback/feedback-store.js')
    const store = {
      articles: [{
        messageId: '123',
        articleUrl: 'https://example.com/test',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
        feedback: 'positive' as const,
      }],
      lastUpdated: '',
    }

    const updated = updateArticleTranslated(store, '123', false)

    expect(updated.articles[0].translated).toBe(false)
  })

  it('既存の記事にimmutableに追加される', async () => {
    const { addNotifiedArticles } = await import('../src/feedback/feedback-store.js')
    const existing = {
      articles: [{
        messageId: '1',
        articleUrl: 'url1',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: new Date().toISOString(),
    }
    const results: NotificationResult[] = [
      { messageId: '2', article: mockArticle },
    ]

    const updated = addNotifiedArticles(existing, results)

    expect(updated.articles).toHaveLength(2)
    expect(existing.articles).toHaveLength(1) // 元は変更されない
  })
})
