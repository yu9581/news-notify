import { describe, it, expect, vi } from 'vitest'
import { createSummarizer } from '../src/ai/summarizer.js'
import type { Article } from '../src/utils/types.js'

const mockArticle: Article = {
  title: 'OpenAI releases new model',
  url: 'https://example.com/openai-news',
  pubDate: new Date(),
  source: 'TechCrunch',
  category: 'AI',
  keyword: 'AI news',
}

vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              summary: 'OpenAIが新しいモデルを発表しました。',
              importance: '高',
            }),
          },
        }),
      }),
    })),
  }
})

describe('createSummarizer', () => {
  it('記事を要約できる', async () => {
    const summarizer = createSummarizer('fake-api-key')
    const result = await summarizer.summarizeArticle(mockArticle)

    expect(result.summary).toBe('OpenAIが新しいモデルを発表しました。')
    expect(result.importance).toBe('高')
    expect(result.title).toBe(mockArticle.title)
    expect(result.url).toBe(mockArticle.url)
  })

  it('複数記事を要約できる', async () => {
    const summarizer = createSummarizer('fake-api-key')
    const articles = [mockArticle, { ...mockArticle, title: 'Another article' }]
    const results = await summarizer.summarizeArticles(articles, 0)

    expect(results).toHaveLength(2)
    expect(results[0].summary).toBeTruthy()
    expect(results[1].summary).toBeTruthy()
  })
})

describe('extractJSON (via summarizer)', () => {
  it('コードブロック付きJSONを処理できる', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => '```json\n{"summary": "テスト要約", "importance": "中"}\n```',
          },
        }),
      }),
    }) as any)

    const summarizer = createSummarizer('fake-api-key')
    const result = await summarizer.summarizeArticle(mockArticle)
    expect(result.summary).toBe('テスト要約')
  })

  it('パース失敗時はフォールバックを返す', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockResolvedValue({
          response: {
            text: () => 'invalid response with no json',
          },
        }),
      }),
    }) as any)

    const summarizer = createSummarizer('fake-api-key')
    const result = await summarizer.summarizeArticle(mockArticle)
    expect(result.summary).toBe('要約の取得に失敗しました')
    expect(result.importance).toBe('中')
  })
})
