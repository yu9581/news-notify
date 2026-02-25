import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/utils/config-loader.js', () => ({
  getRootDir: () => '/mock/root',
  getEnv: () => ({
    geminiApiKey: 'test-key',
    discordBotToken: 'test-token',
    discordChannelId: 'ch-123',
  }),
  loadWatchlist: () => ({
    people: [],
    topics: [],
    feeds: [],
    settings: {
      maxArticlesPerKeyword: 5,
      maxTotalArticles: 10,
      fetchDelayMs: 0,
      summaryMaxTokens: 1024,
      deduplicationDays: 7,
      relevanceThreshold: 30,
    },
  }),
}))

vi.mock('../src/collectors/google-news.js', () => ({
  collectGoogleNews: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/collectors/rss-feed.js', () => ({
  collectRssFeeds: vi.fn().mockResolvedValue([]),
}))

vi.mock('../src/ai/summarizer.js', () => ({
  createSummarizer: vi.fn().mockReturnValue({
    summarizeArticles: vi.fn().mockResolvedValue([]),
  }),
}))

vi.mock('../src/ai/relevance-filter.js', () => ({
  filterByRelevance: vi.fn().mockReturnValue({ passed: [], filtered: [] }),
}))

vi.mock('../src/discord/notifier.js', () => ({
  createNotifier: vi.fn().mockReturnValue({
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    getClient: vi.fn().mockReturnValue({ mock: true }),
    notifyArticles: vi.fn().mockResolvedValue({ sent: 0, results: [] }),
  }),
}))

vi.mock('../src/dedup/store.js', () => ({
  loadSeenStore: vi.fn().mockReturnValue({ articles: [], lastUpdated: '' }),
  saveSeenStore: vi.fn(),
  filterNewArticles: vi.fn().mockReturnValue([]),
  markAsSeen: vi.fn().mockReturnValue({ articles: [], lastUpdated: '' }),
}))

vi.mock('../src/feedback/reaction-collector.js', () => ({
  collectReactions: vi.fn().mockResolvedValue({ articles: [], lastUpdated: '' }),
}))

vi.mock('../src/feedback/feedback-store.js', () => ({
  loadFeedbackStore: vi.fn().mockReturnValue({ articles: [], lastUpdated: '' }),
  saveFeedbackStore: vi.fn(),
  addNotifiedArticles: vi.fn().mockReturnValue({ articles: [], lastUpdated: '' }),
}))

vi.mock('../src/feedback/profile-updater.js', () => ({
  updateProfileIfNeeded: vi.fn().mockResolvedValue(undefined),
  loadLearningProfile: vi.fn().mockReturnValue({}),
}))

describe('runNewsJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('バッチモード: notifierを自前で作成して接続・切断する', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const { runNewsJob } = await import('../src/jobs/news-job.js')

    await runNewsJob()

    const notifier = vi.mocked(createNotifier).mock.results[0].value
    expect(notifier.connect).toHaveBeenCalled()
    expect(notifier.disconnect).toHaveBeenCalled()
  })

  it('常時起動モード: 外部clientを渡すとnotifierに転送される', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const { runNewsJob } = await import('../src/jobs/news-job.js')
    const externalClient = { external: true } as any

    await runNewsJob({ client: externalClient, channelId: 'ch-ext' })

    expect(createNotifier).toHaveBeenCalledWith(
      'test-token',
      'ch-ext',
      { client: externalClient }
    )
  })

  it('新着記事がない場合は通知フェーズをスキップする', async () => {
    const { createNotifier } = await import('../src/discord/notifier.js')
    const { runNewsJob } = await import('../src/jobs/news-job.js')

    await runNewsJob()

    const notifier = vi.mocked(createNotifier).mock.results[0].value
    expect(notifier.notifyArticles).not.toHaveBeenCalled()
  })

  it('エラーが発生してもdisconnectは呼ばれる', async () => {
    const { collectReactions } = await import('../src/feedback/reaction-collector.js')
    vi.mocked(collectReactions).mockRejectedValueOnce(new Error('Connection error'))

    const { createNotifier } = await import('../src/discord/notifier.js')
    const { runNewsJob } = await import('../src/jobs/news-job.js')

    await expect(runNewsJob()).rejects.toThrow('Connection error')

    const notifier = vi.mocked(createNotifier).mock.results[0].value
    expect(notifier.disconnect).toHaveBeenCalled()
  })
})
