import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadWatchlist, getEnv, getRootDir } from '../src/utils/config-loader.js'

describe('loadWatchlist', () => {
  it('watchlist.jsonを正しく読み込める', () => {
    const watchlist = loadWatchlist()

    expect(watchlist.people).toBeDefined()
    expect(watchlist.topics).toBeDefined()
    expect(watchlist.feeds).toBeDefined()
    expect(watchlist.settings).toBeDefined()
  })

  it('peopleに必要なフィールドがある', () => {
    const watchlist = loadWatchlist()

    for (const person of watchlist.people) {
      expect(person.name).toBeTruthy()
      expect(person.keywords.length).toBeGreaterThan(0)
      expect(['en', 'ja']).toContain(person.lang)
    }
  })

  it('topicsに必要なフィールドがある', () => {
    const watchlist = loadWatchlist()

    for (const topic of watchlist.topics) {
      expect(topic.name).toBeTruthy()
      expect(topic.keywords.length).toBeGreaterThan(0)
      expect(['en', 'ja']).toContain(topic.lang)
    }
  })

  it('feedsに必要なフィールドがある', () => {
    const watchlist = loadWatchlist()

    for (const feed of watchlist.feeds) {
      expect(feed.name).toBeTruthy()
      expect(feed.url).toMatch(/^https?:\/\//)
    }
  })

  it('settingsに必要なフィールドがある', () => {
    const watchlist = loadWatchlist()
    const { settings } = watchlist

    expect(settings.maxArticlesPerKeyword).toBeGreaterThan(0)
    expect(settings.maxTotalArticles).toBeGreaterThan(0)
    expect(settings.fetchDelayMs).toBeGreaterThanOrEqual(0)
    expect(settings.summaryMaxTokens).toBeGreaterThan(0)
    expect(settings.deduplicationDays).toBeGreaterThan(0)
  })
})

describe('getEnv', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('必要な環境変数がすべてあれば値を返す', () => {
    process.env.GEMINI_API_KEY = 'test-gemini-key'
    process.env.DISCORD_BOT_TOKEN = 'test-bot-token'
    process.env.DISCORD_CHANNEL_ID = 'test-channel-id'

    const env = getEnv()
    expect(env.geminiApiKey).toBe('test-gemini-key')
    expect(env.discordBotToken).toBe('test-bot-token')
    expect(env.discordChannelId).toBe('test-channel-id')
  })

  it('環境変数が欠けていればエラーを投げる', () => {
    delete process.env.GEMINI_API_KEY
    delete process.env.DISCORD_BOT_TOKEN
    delete process.env.DISCORD_CHANNEL_ID

    expect(() => getEnv()).toThrow('環境変数が未設定です')
  })

  it('一部だけ欠けていても欠落分をエラーメッセージに含む', () => {
    process.env.GEMINI_API_KEY = 'test'
    delete process.env.DISCORD_BOT_TOKEN
    delete process.env.DISCORD_CHANNEL_ID

    expect(() => getEnv()).toThrow('DISCORD_BOT_TOKEN')
    expect(() => getEnv()).toThrow('DISCORD_CHANNEL_ID')
  })
})

describe('getRootDir', () => {
  it('ルートディレクトリのパスを返す', () => {
    const rootDir = getRootDir()
    expect(rootDir).toBeTruthy()
    expect(rootDir).toContain('news-notify')
  })
})
