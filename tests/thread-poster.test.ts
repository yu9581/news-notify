import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postTranslationToThread } from '../src/discord/thread-poster.js'

function createMockClient(thread: { send: ReturnType<typeof vi.fn> } | null) {
  return {
    channels: {
      fetch: vi.fn().mockResolvedValue({
        messages: {
          fetch: vi.fn().mockResolvedValue({
            thread,
            hasThread: thread !== null,
          }),
        },
      }),
    },
  }
}

describe('postTranslationToThread', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('スレッドに翻訳ヘッダー付きで投稿する', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const client = createMockClient({ send })

    await postTranslationToThread(
      client as any,
      'ch-1',
      'msg-1',
      'これは翻訳テキストです。'
    )

    expect(send).toHaveBeenCalledTimes(1)
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('📖 **全文翻訳**')
    )
    expect(send).toHaveBeenCalledWith(
      expect.stringContaining('これは翻訳テキストです。')
    )
  })

  it('長いテキストは複数メッセージに分割して投稿する', async () => {
    const send = vi.fn().mockResolvedValue(undefined)
    const client = createMockClient({ send })
    const longText = 'あ'.repeat(3000)

    await postTranslationToThread(
      client as any,
      'ch-1',
      'msg-1',
      longText
    )

    expect(send.mock.calls.length).toBeGreaterThan(1)
    // 最初のチャンクにヘッダーが含まれる
    expect(send.mock.calls[0][0]).toContain('📖 **全文翻訳**')
  })

  it('スレッドが存在しない場合はエラーを投げる', async () => {
    const client = createMockClient(null)

    await expect(
      postTranslationToThread(client as any, 'ch-1', 'msg-1', 'text')
    ).rejects.toThrow('スレッドが見つかりません')
  })

  it('チャンネルが見つからない場合はエラーを投げる', async () => {
    const client = {
      channels: {
        fetch: vi.fn().mockResolvedValue(null),
      },
    }

    await expect(
      postTranslationToThread(client as any, 'ch-bad', 'msg-1', 'text')
    ).rejects.toThrow('チャンネル ch-bad が見つかりません')
  })
})
