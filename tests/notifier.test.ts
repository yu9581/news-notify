import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { SummarizedArticle } from '../src/utils/types.js'

const mockThreadSend = vi.fn().mockResolvedValue(undefined)
const mockStartThread = vi.fn().mockResolvedValue({ send: mockThreadSend })
const mockChannelSend = vi.fn().mockResolvedValue({ id: 'msg-123', startThread: mockStartThread })
const mockDestroy = vi.fn()
const mockLogin = vi.fn().mockResolvedValue(undefined)

vi.mock('discord.js', () => {
  class MockEmbedBuilder {
    data: Record<string, unknown> = {}

    setColor(color: number) { this.data.color = color; return this }
    setTitle(title: string) { this.data.title = title; return this }
    setURL(url: string) { this.data.url = url; return this }
    setDescription(desc: string) { this.data.description = desc; return this }
    addFields(...fields: unknown[]) {
      this.data.fields = [...((this.data.fields as unknown[]) || []), ...(fields as unknown[]).flat()]
      return this
    }
    setImage(url: string) { this.data.image = { url }; return this }
  }

  return {
    Client: vi.fn().mockImplementation(() => ({
      login: mockLogin,
      once: vi.fn().mockImplementation((_event: string, cb: Function) => {
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
    GatewayIntentBits: { Guilds: 1, GuildMessageReactions: 2 },
    EmbedBuilder: MockEmbedBuilder,
  }
})

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
  relevance: 85,
  relevanceReason: 'テスト理由',
}

function getLastEmbed() {
  const lastCall = mockChannelSend.mock.calls[mockChannelSend.mock.calls.length - 1]
  return lastCall[0].embeds[0]
}

describe('createNotifier', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChannelSend.mockResolvedValue({ id: 'msg-123', startThread: mockStartThread })
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

  it('記事をEmbed形式で通知できる', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    const result = await notifier.notifyArticle(mockArticle)

    expect(result.messageId).toBe('msg-123')
    expect(result.article).toBe(mockArticle)

    const embed = getLastEmbed()
    expect(embed.data.title).toContain('テストニュース記事')
    expect(embed.data.title).toContain('🤖')
    expect(embed.data.url).toBe('https://example.com/test')
    expect(embed.data.description).toContain('テストの要約です。')

    const fields = embed.data.fields as { name: string; value: string }[]
    expect(fields.find((f: { name: string }) => f.name === '出典')?.value).toBe('TestSource')
    expect(fields.find((f: { name: string }) => f.name === '重要度')?.value).toContain('🔴')
    expect(fields.find((f: { name: string }) => f.name === '関連度')?.value).toBe('85%')

    expect(mockStartThread).toHaveBeenCalledWith({
      name: 'Test News Article',
      autoArchiveDuration: 1440,
    })
    expect(mockThreadSend).toHaveBeenCalledWith('🔗 https://example.com/test')
  })

  it('要約の句点で改行される', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    const article = {
      ...mockArticle,
      summary: '1文目です。2文目です。3文目です。',
    }
    await notifier.notifyArticle(article)

    const embed = getLastEmbed()
    expect(embed.data.description).toBe('1文目です。\n2文目です。\n3文目です。')
  })

  it('重要度に応じた色と絵文字を使う', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    await notifier.notifyArticle(mockArticle)
    let embed = getLastEmbed()
    expect(embed.data.color).toBe(0xED4245)
    let fields = embed.data.fields as { name: string; value: string }[]
    expect(fields.find((f: { name: string }) => f.name === '重要度')?.value).toContain('🔴')

    await notifier.notifyArticle({ ...mockArticle, importance: '中' })
    embed = getLastEmbed()
    expect(embed.data.color).toBe(0xFEE75C)
    fields = embed.data.fields as { name: string; value: string }[]
    expect(fields.find((f: { name: string }) => f.name === '重要度')?.value).toContain('🟡')

    await notifier.notifyArticle({ ...mockArticle, importance: '低' })
    embed = getLastEmbed()
    expect(embed.data.color).toBe(0x57F287)
    fields = embed.data.fields as { name: string; value: string }[]
    expect(fields.find((f: { name: string }) => f.name === '重要度')?.value).toContain('🟢')
  })

  it('カテゴリに応じた絵文字をタイトルに使う', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    await notifier.notifyArticle({ ...mockArticle, category: 'AI' })
    expect(getLastEmbed().data.title).toContain('🤖')

    await notifier.notifyArticle({ ...mockArticle, category: 'LLM' })
    expect(getLastEmbed().data.title).toContain('🧠')

    await notifier.notifyArticle({ ...mockArticle, category: 'Unknown' })
    expect(getLastEmbed().data.title).toContain('📌')
  })

  it('OGP画像がある場合はEmbedに画像を設定する', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    const articleWithImage = {
      ...mockArticle,
      ogImage: 'https://example.com/og-image.jpg',
    }
    await notifier.notifyArticle(articleWithImage)

    const embed = getLastEmbed()
    expect(embed.data.image).toEqual({ url: 'https://example.com/og-image.jpg' })
  })

  it('OGP画像がない場合は画像なしで通知する', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    await notifier.notifyArticle(mockArticle)

    const embed = getLastEmbed()
    expect(embed.data.image).toBeUndefined()
  })

  it('複数記事を通知し送信数と結果を返す', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const notifier = createNotifier('fake-token', 'fake-channel')
    await notifier.connect()

    const articles = [
      mockArticle,
      { ...mockArticle, title: 'Article 2' },
    ]

    const { sent, results } = await notifier.notifyArticles(articles)
    expect(sent).toBe(2)
    expect(results).toHaveLength(2)
    expect(results[0].messageId).toBe('msg-123')
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

    const { sent, results } = await notifier.notifyArticles(articles)
    expect(sent).toBe(1)
    expect(results).toHaveLength(1)
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
