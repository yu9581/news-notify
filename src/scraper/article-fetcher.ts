import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'
import { GoogleDecoder } from 'google-news-url-decoder'

const FETCH_TIMEOUT_MS = 10_000

export interface ArticleContent {
  readonly title: string
  readonly textContent: string
}

export async function fetchArticleContent(url: string): Promise<ArticleContent> {
  const resolvedUrl = await resolveGoogleNewsUrl(url)

  const parsed = new URL(resolvedUrl)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`許可されていないプロトコルです: ${parsed.protocol}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(resolvedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'text/html',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${resolvedUrl}`)
    }

    const html = await response.text()
    return extractContent(html, resolvedUrl)
  } finally {
    clearTimeout(timeout)
  }
}

export async function resolveGoogleNewsUrl(url: string): Promise<string> {
  if (!url.includes('news.google.com/rss/articles/')) {
    return url
  }

  try {
    const decoder = new GoogleDecoder()
    const result = await decoder.decode(url)
    if (result.status && result.decoded_url) {
      return result.decoded_url
    }
  } catch {
    // デコード失敗時は元のURLを返す
  }

  return url
}

export function extractContent(html: string, url: string): ArticleContent {
  const { document } = parseHTML(html)
  const reader = new Readability(document as unknown as Document, { charThreshold: 100 })
  const article = reader.parse()

  if (!article || !article.textContent || article.textContent.trim().length === 0) {
    throw new Error(`記事本文を抽出できません: ${url}`)
  }

  return {
    title: article.title || '',
    textContent: article.textContent.trim(),
  }
}
