import { describe, it, expect, vi, beforeEach } from 'vitest'
import { extractContent } from '../src/scraper/article-fetcher.js'

describe('extractContent', () => {
  it('HTML本文からテキストを抽出する', () => {
    const html = `
      <html>
        <head><title>Test Article</title></head>
        <body>
          <nav>Navigation</nav>
          <article>
            <h1>Test Article Title</h1>
            <p>This is the first paragraph of the article. It contains important information about the topic being discussed.</p>
            <p>This is the second paragraph with more details. The article continues with additional context and analysis of the situation.</p>
            <p>The third paragraph wraps up the main points. In conclusion, this article has covered the key aspects of the topic.</p>
          </article>
          <footer>Footer content</footer>
        </body>
      </html>
    `

    const result = extractContent(html, 'https://example.com/article')

    // Readabilityは<title>タグからタイトルを取得する
    expect(result.title).toBe('Test Article')
    expect(result.textContent).toContain('first paragraph')
    expect(result.textContent).toContain('second paragraph')
  })

  it('本文が空のHTMLではエラーを投げる', () => {
    const html = `
      <html>
        <head><title>Empty</title></head>
        <body></body>
      </html>
    `

    expect(() => extractContent(html, 'https://example.com/empty'))
      .toThrow('記事本文を抽出できません')
  })

  it('十分な本文があれば抽出できる', () => {
    const longText = 'This is a sentence. '.repeat(50)
    const html = `
      <html>
        <head><title>Long Article</title></head>
        <body>
          <article>
            <h1>Long Article</h1>
            <p>${longText}</p>
          </article>
        </body>
      </html>
    `

    const result = extractContent(html, 'https://example.com/long')

    expect(result.textContent.length).toBeGreaterThan(100)
  })
})

describe('fetchArticleContent', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('HTTP エラーで例外を投げる', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    }))

    const { fetchArticleContent } = await import('../src/scraper/article-fetcher.js')

    await expect(fetchArticleContent('https://example.com/404'))
      .rejects.toThrow('HTTP 404')

    vi.unstubAllGlobals()
  })

  it('正常なHTMLからコンテンツを抽出する', async () => {
    const longText = 'This is an important news article about technology. '.repeat(20)
    const html = `
      <html>
        <head><title>Tech News</title></head>
        <body>
          <article>
            <h1>Tech News Title</h1>
            <p>${longText}</p>
          </article>
        </body>
      </html>
    `

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(html),
    }))

    const { fetchArticleContent } = await import('../src/scraper/article-fetcher.js')
    const result = await fetchArticleContent('https://example.com/tech')

    expect(result.title).toBe('Tech News')
    expect(result.textContent).toContain('technology')

    vi.unstubAllGlobals()
  })
})
