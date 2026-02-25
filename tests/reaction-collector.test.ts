import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FeedbackStore } from '../src/feedback/feedback-store.js'

vi.mock('../src/utils/config-loader.js', () => ({
  getRootDir: () => '/mock/root',
}))

vi.mock('../src/scraper/article-fetcher.js', () => ({
  fetchArticleContent: vi.fn().mockResolvedValue({
    title: 'Test Article',
    textContent: 'This is test content.',
  }),
}))

vi.mock('../src/ai/translator.js', () => ({
  createTranslator: vi.fn().mockReturnValue({
    translateArticle: vi.fn().mockResolvedValue('これはテストコンテンツです。'),
  }),
  splitIntoChunks: vi.fn().mockReturnValue(['これはテストコンテンツです。']),
}))

vi.mock('../src/discord/thread-poster.js', () => ({
  postTranslationToThread: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockImplementation(() => { throw new Error('File not found') }),
  writeFileSync: vi.fn(),
}))

function createMockClient(reactions: Map<string, { count: number }>) {
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        messages: {
          fetch: vi.fn().mockResolvedValue({
            reactions: {
              cache: {
                find: (fn: (r: { count: number }, key: string) => boolean) => {
                  for (const [key, value] of reactions.entries()) {
                    if (fn(value, key)) return value
                  }
                  return undefined
                },
              },
            },
          }),
        },
      }),
    },
  }
}

describe('collectReactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('フィードバック待ちの記事がない場合は何もしない', async () => {
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = { articles: [], lastUpdated: '' }
    const client = createMockClient(new Map())

    const result = await collectReactions(client as any, 'ch-id', store)

    expect(result.articles).toHaveLength(0)
  })

  it('👀リアクションでpositiveフィードバックを記録する', async () => {
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const reactions = new Map([
      ['👀', { count: 1 }],
    ])
    const client = createMockClient(reactions)

    const result = await collectReactions(client as any, 'ch-id', store)

    expect(result.articles[0].feedback).toBe('positive')
  })

  it('❌リアクションでnegativeフィードバックを記録する', async () => {
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const reactions = new Map([
      ['❌', { count: 1 }],
    ])
    const client = createMockClient(reactions)

    const result = await collectReactions(client as any, 'ch-id', store)

    expect(result.articles[0].feedback).toBe('negative')
  })

  it('リアクションがない場合はフィードバック未取得のまま', async () => {
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const reactions = new Map<string, { count: number }>()
    const client = createMockClient(reactions)

    const result = await collectReactions(client as any, 'ch-id', store)

    expect(result.articles[0].feedback).toBeUndefined()
  })

  it('既にフィードバック済みの記事はスキップする', async () => {
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
        feedback: 'positive',
      }],
      lastUpdated: '',
    }

    const client = createMockClient(new Map())

    const result = await collectReactions(client as any, 'ch-id', store)

    // フィードバック済みなので変更なし
    expect(result.articles[0].feedback).toBe('positive')
  })

  it('👀リアクション + geminiApiKeyで翻訳フローが実行される', async () => {
    const { postTranslationToThread } = await import('../src/discord/thread-poster.js')
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const reactions = new Map([
      ['👀', { count: 1 }],
    ])
    const client = createMockClient(reactions)

    await collectReactions(client as any, 'ch-id', store, { geminiApiKey: 'test-key' })

    expect(postTranslationToThread).toHaveBeenCalledWith(
      client,
      'ch-id',
      'msg-1',
      'これはテストコンテンツです。'
    )
  })

  it('geminiApiKeyが未設定なら翻訳はスキップされる', async () => {
    const { postTranslationToThread } = await import('../src/discord/thread-poster.js')
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const reactions = new Map([
      ['👀', { count: 1 }],
    ])
    const client = createMockClient(reactions)

    await collectReactions(client as any, 'ch-id', store)

    expect(postTranslationToThread).not.toHaveBeenCalled()
  })

  it('翻訳が失敗してもフィードバック記録は正常に行われる', async () => {
    const { fetchArticleContent } = await import('../src/scraper/article-fetcher.js')
    vi.mocked(fetchArticleContent).mockRejectedValueOnce(new Error('Network error'))

    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const reactions = new Map([
      ['👀', { count: 1 }],
    ])
    const client = createMockClient(reactions)

    const result = await collectReactions(client as any, 'ch-id', store, { geminiApiKey: 'test-key' })

    // 翻訳は失敗したが、フィードバックはpositiveとして記録されている
    expect(result.articles[0].feedback).toBe('positive')
  })

  it('メッセージ取得でエラーが出てもスキップして続行する', async () => {
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    const store: FeedbackStore = {
      articles: [{
        messageId: 'msg-deleted',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }

    const client = {
      channels: {
        fetch: vi.fn().mockRejectedValue(new Error('Unknown Message')),
      },
    }

    const result = await collectReactions(client as any, 'ch-id', store)

    expect(result.articles[0].feedback).toBeUndefined()
  })
})
