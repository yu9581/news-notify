import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SummarizedArticle } from '../src/utils/types.js'

const mockThreadSend = vi.fn().mockResolvedValue(undefined)
const mockStartThread = vi.fn().mockResolvedValue({ send: mockThreadSend })
const mockChannelSend = vi.fn().mockResolvedValue({ startThread: mockStartThread })
const mockDestroy = vi.fn()
const mockLogin = vi.fn().mockResolvedValue(undefined)
let mockOnceCallback: Function

vi.mock('discord.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    login: mockLogin,
    once: vi.fn().mockImplementation((_event: string, cb: Function) => {
      mockOnceCallback = cb
      cb()
    }),
    channels: {
      fetch: vi.fn().mockResolvedValue({
        send: mockChannelSend,
      }),
    },
    user: { tag: 'TestBot#1234' },
    destroy: mockDestroy,
  })),
  GatewayIntentBits: { Guilds: 1 },
}))

const mockArticle: SummarizedArticle = {
  title: 'Test News Article',
  titleJa: 'テストニュース記事',
  url: 'https://example.com/test',
  pubDate: new Date(),
  source: 'TestSource',
  category: 'AI',
  keyword: 'AI',
  summary: 'テストの要約です。',
  importance: '高',
}

describe('createNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChannelSend.mockResolvedValue({ startThread: mockStartThread })
    mockStartThread.mockResolvedValue({ send: mockThreadSend })
  })

  it('接続と切断ができる', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')

    await notifier.connect()
    expect(mockLogin).toHaveBeenCalledWith('fake-token')

    await notifier.disconnect()
    expect(mockDestroy).toHaveBeenCalled()
  })

  it('記事を通知できる（メッセージに要約、スレッドにURL）', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    await notifier.notifyArticle(mockArticle)

    expect(mockChannelSend).toHaveBeenCalledWith(
      expect.stringContaining('テストニュース記事')
    )
    expect(mockChannelSend).toHaveBeenCalledWith(
      expect.stringContaining('テストの要約です。')
    )
    expect(mockChannelSend).toHaveBeenCalledWith(
      expect.stringContaining('📌 出典: TestSource | 重要度: 🔴 高')
    )
    expect(mockStartThread).toHaveBeenCalledWith({
      name: 'Test News Article',
      autoArchiveDuration: 1440,
    })
    expect(mockThreadSend).toHaveBeenCalledWith(
      '🔗 https://example.com/test'
    )
  })

  it('重要度に応じた絵文字を使う', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    await notifier.notifyArticle(mockArticle)
    expect(mockChannelSend).toHaveBeenCalledWith(expect.stringContaining('🔴'))

    await notifier.notifyArticle({ ...mockArticle, importance: '中' })
    expect(mockChannelSend).toHaveBeenCalledWith(expect.stringContaining('🟡'))

    await notifier.notifyArticle({ ...mockArticle, importance: '低' })
    expect(mockChannelSend).toHaveBeenCalledWith(expect.stringContaining('🟢'))
  })

  it('カテゴリに応じた絵文字を使う', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    await notifier.notifyArticle({ ...mockArticle, category: 'AI' })
    expect(mockChannelSend).toHaveBeenCalledWith(expect.stringContaining('🤖'))

    await notifier.notifyArticle({ ...mockArticle, category: 'LLM' })
    expect(mockChannelSend).toHaveBeenCalledWith(expect.stringContaining('🧠'))

    await notifier.notifyArticle({ ...mockArticle, category: 'Unknown' })
    expect(mockChannelSend).toHaveBeenCalledWith(expect.stringContaining('📌'))
  })

  it('複数記事を通知し送信数を返す', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    const articles = [
      mockArticle,
      { ...mockArticle, title: 'Article 2' },
    ]

    const count = await notifier.notifyArticles(articles)
    expect(count).toBe(2)
  })

  it('通知失敗時もカウントせず続行する', async () => {
    mockChannelSend.mockRejectedValueOnce(new Error('Send failed'))

    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const articles = [
      mockArticle,
      { ...mockArticle, title: 'Article 2' },
    ]

    const count = await notifier.notifyArticles(articles)
    expect(count).toBe(1)
    expect(consoleSpy).toHaveBeenCalled()
  })

  it('チャンネルがnullの場合はエラーを投げる', async () => {
    const { Client } = await import('discord.js')
    vi.mocked(Client).mockImplementation(() => ({
      login: mockLogin,
      once: vi.fn().mockImplementation((_: string, cb: Function) => cb()),
      channels: {
        fetch: vi.fn().mockResolvedValue(null),
      },
      user: { tag: 'TestBot#1234' },
      destroy: mockDestroy,
    }) as any)

    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    await expect(notifier.notifyArticle(mockArticle)).rejects.toThrow('チャンネル')
  })
})
