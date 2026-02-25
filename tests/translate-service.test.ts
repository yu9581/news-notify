import { describe, it, expect, vi, beforeEach } from 'vitest'

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
}))

vi.mock('../src/discord/thread-poster.js', () => ({
  postTranslationToThread: vi.fn().mockResolvedValue(undefined),
}))

describe('translateAndPost', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('翻訳成功時にtrueを返す', async () => {
    const { translateAndPost } = await import('../src/services/translate-service.js')
    const client = {} as any

    const result = await translateAndPost(client, 'ch-1', 'msg-1', 'https://example.com', 'api-key')

    expect(result).toBe(true)
  })

  it('記事を取得して翻訳しスレッドに投稿する', async () => {
    const { postTranslationToThread } = await import('../src/discord/thread-poster.js')
    const { translateAndPost } = await import('../src/services/translate-service.js')
    const client = {} as any

    await translateAndPost(client, 'ch-1', 'msg-1', 'https://example.com', 'api-key')

    expect(postTranslationToThread).toHaveBeenCalledWith(
      client,
      'ch-1',
      'msg-1',
      'これはテストコンテンツです。'
    )
  })

  it('記事取得失敗時にfalseを返す', async () => {
    const { fetchArticleContent } = await import('../src/scraper/article-fetcher.js')
    vi.mocked(fetchArticleContent).mockRejectedValueOnce(new Error('Network error'))

    const { translateAndPost } = await import('../src/services/translate-service.js')
    const client = {} as any

    const result = await translateAndPost(client, 'ch-1', 'msg-1', 'https://example.com', 'api-key')

    expect(result).toBe(false)
  })

  it('翻訳失敗時にfalseを返す', async () => {
    const { createTranslator } = await import('../src/ai/translator.js')
    vi.mocked(createTranslator).mockReturnValueOnce({
      translateArticle: vi.fn().mockRejectedValueOnce(new Error('Translation error')),
    })

    const { translateAndPost } = await import('../src/services/translate-service.js')
    const client = {} as any

    const result = await translateAndPost(client, 'ch-1', 'msg-1', 'https://example.com', 'api-key')

    expect(result).toBe(false)
  })

  it('スレッド投稿失敗時にfalseを返す', async () => {
    const { postTranslationToThread } = await import('../src/discord/thread-poster.js')
    vi.mocked(postTranslationToThread).mockRejectedValueOnce(new Error('Thread not found'))

    const { translateAndPost } = await import('../src/services/translate-service.js')
    const client = {} as any

    const result = await translateAndPost(client, 'ch-1', 'msg-1', 'https://example.com', 'api-key')

    expect(result).toBe(false)
  })
})
