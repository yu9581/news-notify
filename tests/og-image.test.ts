import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchOgImage } from '../src/utils/og-image.js'

describe('fetchOgImage', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('og:image メタタグから画像URLを取得する', async () => {
    const html = '<html><head><meta property="og:image" content="https://example.com/image.jpg"></head></html>'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response)

    const result = await fetchOgImage('https://example.com/article')
    expect(result).toBe('https://example.com/image.jpg')
  })

  it('content属性が先にくるパターンでも取得できる', async () => {
    const html = '<html><head><meta content="https://example.com/image.jpg" property="og:image"></head></html>'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response)

    const result = await fetchOgImage('https://example.com/article')
    expect(result).toBe('https://example.com/image.jpg')
  })

  it('og:image がない場合は null を返す', async () => {
    const html = '<html><head><title>No OG</title></head></html>'
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    } as Response)

    const result = await fetchOgImage('https://example.com/article')
    expect(result).toBeNull()
  })

  it('fetch失敗時は null を返す', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('Network error'))

    const result = await fetchOgImage('https://example.com/article')
    expect(result).toBeNull()
  })

  it('HTTPエラー時は null を返す', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 404,
    } as Response)

    const result = await fetchOgImage('https://example.com/article')
    expect(result).toBeNull()
  })
})
