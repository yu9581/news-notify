import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { FeedbackStore } from '../src/feedback/feedback-store.js'

vi.mock('fs', () => ({
  readFileSync: vi.fn().mockImplementation(() => { throw new Error('File not found') }),
  writeFileSync: vi.fn(),
}))

vi.mock('../src/utils/config-loader.js', () => ({
  getRootDir: () => '/mock/root',
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => JSON.stringify({
            profile: 'このカテゴリでは人物本人の発言や活動に関する記事が求められている',
          }),
        },
      }),
    }),
  })),
}))

describe('profile-updater', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('フィードバックが5件未満の場合はプロファイル更新しない', async () => {
    const { updateProfileIfNeeded } = await import('../src/feedback/profile-updater.js')
    const store: FeedbackStore = {
      articles: [
        { messageId: '1', articleUrl: 'url1', category: 'AI', keyword: 'AI', relevance: 80, notifiedAt: '', feedback: 'positive' },
        { messageId: '2', articleUrl: 'url2', category: 'AI', keyword: 'AI', relevance: 30, notifiedAt: '', feedback: 'negative' },
      ],
      lastUpdated: '',
    }

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await updateProfileIfNeeded(store, 'fake-key')

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('プロファイル更新不要'))
  })

  it('フィードバックが5件以上あるカテゴリのプロファイルを更新する', async () => {
    const { writeFileSync } = await import('fs')
    const { updateProfileIfNeeded } = await import('../src/feedback/profile-updater.js')

    const store: FeedbackStore = {
      articles: Array.from({ length: 5 }, (_, i) => ({
        messageId: String(i),
        articleUrl: `url${i}`,
        category: '家入一真',
        keyword: 'CAMPFIRE',
        relevance: 60 + i * 5,
        notifiedAt: '',
        feedback: i < 3 ? 'positive' as const : 'negative' as const,
      })),
      lastUpdated: '',
    }

    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    await updateProfileIfNeeded(store, 'fake-key')

    expect(writeFileSync).toHaveBeenCalled()
    const writeCall = vi.mocked(writeFileSync).mock.calls[0]
    const savedProfile = JSON.parse(writeCall[1] as string)
    expect(savedProfile['家入一真']).toBeTruthy()
  })

  it('プロファイルファイルが存在しない場合は空のプロファイルを返す', async () => {
    const { loadLearningProfile } = await import('../src/feedback/profile-updater.js')
    const profile = loadLearningProfile()

    expect(profile).toEqual({})
  })

  it('Gemini API エラー時はスキップして続行する', async () => {
    const { GoogleGenerativeAI } = await import('@google/generative-ai')
    vi.mocked(GoogleGenerativeAI).mockImplementation(() => ({
      getGenerativeModel: vi.fn().mockReturnValue({
        generateContent: vi.fn().mockRejectedValue(new Error('API Error')),
      }),
    }) as any)

    const { updateProfileIfNeeded } = await import('../src/feedback/profile-updater.js')

    const store: FeedbackStore = {
      articles: Array.from({ length: 5 }, (_, i) => ({
        messageId: String(i),
        articleUrl: `url${i}`,
        category: 'AI',
        keyword: 'AI',
        relevance: 80,
        notifiedAt: '',
        feedback: 'positive' as const,
      })),
      lastUpdated: '',
    }

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    await expect(updateProfileIfNeeded(store, 'fake-key')).resolves.not.toThrow()
    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('プロファイル更新失敗'))
  })
})
