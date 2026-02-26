import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/utils/config-loader.js', () => ({
  getRootDir: () => '/mock/root',
  getEnv: () => ({
    geminiApiKey: 'test-key',
    discordBotToken: 'test-token',
    discordChannelId: 'ch-123',
  }),
}))

vi.mock('../src/services/translate-service.js', () => ({
  translateAndPost: vi.fn().mockResolvedValue(true),
}))

vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}))

function createReaction(overrides: Record<string, unknown> = {}) {
  return {
    emoji: { name: '👀' },
    partial: false,
    message: {
      channelId: 'ch-123',
      id: 'msg-1',
      embeds: [{ url: 'https://example.com' }],
    },
    ...overrides,
  }
}

describe('registerReactionHandler', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { resetProcessingQueue } = await import('../src/events/reaction-handler.js')
    resetProcessingQueue()
  })

  it('clientにmessageReactionAddイベントを登録する', async () => {
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')
    const onMock = vi.fn()
    const client = { on: onMock } as any

    registerReactionHandler(client, 'ch-123')

    expect(onMock).toHaveBeenCalledWith('messageReactionAdd', expect.any(Function))
  })

  it('Bot自身のリアクションは無視する', async () => {
    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    await handler(createReaction(), { bot: true })

    expect(translateAndPost).not.toHaveBeenCalled()
  })

  it('👀以外のリアクションは無視する', async () => {
    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    await handler(createReaction({ emoji: { name: '❌' } }), { bot: false })

    expect(translateAndPost).not.toHaveBeenCalled()
  })

  it('対象チャンネル以外のリアクションは無視する', async () => {
    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    await handler(
      createReaction({ message: { channelId: 'ch-other', id: 'msg-1', embeds: [{ url: 'https://example.com' }] } }),
      { bot: false }
    )

    expect(translateAndPost).not.toHaveBeenCalled()
  })

  it('EmbedにURLがない場合は無視する', async () => {
    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    await handler(
      createReaction({ message: { channelId: 'ch-123', id: 'msg-1', embeds: [] } }),
      { bot: false }
    )

    expect(translateAndPost).not.toHaveBeenCalled()
  })

  it('翻訳済みの記事は無視する', async () => {
    const { readFileSync } = await import('fs')
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
        feedback: 'positive',
        translated: true,
      }],
      lastUpdated: '',
    }))

    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    await handler(createReaction(), { bot: false })

    expect(translateAndPost).not.toHaveBeenCalled()
  })

  it('feedback.jsonに記事があれば既存エントリを更新して翻訳実行', async () => {
    const { readFileSync, writeFileSync } = await import('fs')
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      articles: [{
        messageId: 'msg-1',
        articleUrl: 'https://example.com',
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: new Date().toISOString(),
      }],
      lastUpdated: '',
    }))

    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    await handler(createReaction(), { bot: false })

    expect(translateAndPost).toHaveBeenCalledWith(
      client,
      'ch-123',
      'msg-1',
      'https://example.com',
      'test-key'
    )
    expect(writeFileSync).toHaveBeenCalled()

    // 保存されたデータに translated: true と feedback: 'positive' が含まれる
    const savedData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string)
    const savedArticle = savedData.articles.find((a: any) => a.messageId === 'msg-1')
    expect(savedArticle.translated).toBe(true)
    expect(savedArticle.feedback).toBe('positive')
  })

  it('feedback.jsonに記事がなくてもEmbedのURLで翻訳実行・新規追加', async () => {
    const { readFileSync, writeFileSync } = await import('fs')
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      articles: [],
      lastUpdated: '',
    }))

    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    await handler(createReaction(), { bot: false })

    expect(translateAndPost).toHaveBeenCalledWith(
      client,
      'ch-123',
      'msg-1',
      'https://example.com',
      'test-key'
    )
    expect(writeFileSync).toHaveBeenCalled()

    // 新規エントリとして追加される
    const savedData = JSON.parse(vi.mocked(writeFileSync).mock.calls[0][1] as string)
    expect(savedData.articles).toHaveLength(1)
    expect(savedData.articles[0].messageId).toBe('msg-1')
    expect(savedData.articles[0].articleUrl).toBe('https://example.com')
    expect(savedData.articles[0].translated).toBe(true)
    expect(savedData.articles[0].feedback).toBe('positive')
  })

  it('Partialリアクションの場合はfetchしてからprocessする', async () => {
    const { readFileSync } = await import('fs')
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      articles: [],
      lastUpdated: '',
    }))

    const { translateAndPost } = await import('../src/services/translate-service.js')
    const { registerReactionHandler } = await import('../src/events/reaction-handler.js')

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    const fullReaction = createReaction()
    const partialReaction = {
      emoji: { name: '👀' },
      partial: true,
      fetch: vi.fn().mockResolvedValue(fullReaction),
      message: { channelId: 'ch-123', id: 'msg-1', embeds: [{ url: 'https://example.com' }] },
    }

    await handler(partialReaction, { bot: false })

    expect(partialReaction.fetch).toHaveBeenCalled()
    expect(translateAndPost).toHaveBeenCalled()
  })

  it('同時リアクションが直列化されて処理される', async () => {
    const { readFileSync, writeFileSync } = await import('fs')
    const callOrder: string[] = []

    vi.mocked(readFileSync).mockReturnValue(JSON.stringify({
      articles: [],
      lastUpdated: '',
    }))

    const { translateAndPost } = await import('../src/services/translate-service.js')
    vi.mocked(translateAndPost).mockImplementation(async (_client, _ch, msgId) => {
      callOrder.push(`start-${msgId}`)
      await new Promise(resolve => setTimeout(resolve, 50))
      callOrder.push(`end-${msgId}`)
      return true
    })

    const { registerReactionHandler, resetProcessingQueue } = await import('../src/events/reaction-handler.js')
    resetProcessingQueue()

    let handler: Function = () => {}
    const client = {
      on: (_event: string, fn: Function) => { handler = fn },
    } as any

    registerReactionHandler(client, 'ch-123')

    const reaction1 = createReaction({ message: { channelId: 'ch-123', id: 'msg-1', embeds: [{ url: 'https://example.com/1' }] } })
    const reaction2 = createReaction({ message: { channelId: 'ch-123', id: 'msg-2', embeds: [{ url: 'https://example.com/2' }] } })
    const user = { bot: false }

    // 同時にリアクションを発火
    const p1 = handler(reaction1, user)
    const p2 = handler(reaction2, user)
    await Promise.all([p1, p2])

    // 直列化されていることを確認: start-1 → end-1 → start-2 → end-2
    expect(callOrder).toEqual(['start-msg-1', 'end-msg-1', 'start-msg-2', 'end-msg-2'])
    expect(writeFileSync).toHaveBeenCalledTimes(2)
  })
})
