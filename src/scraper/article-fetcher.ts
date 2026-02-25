import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

const FETCH_TIMEOUT_MS = 10_000

export interface ArticleContent {
  readonly title: string
  readonly textContent: string
}

export async function fetchArticleContent(url: string): Promise<ArticleContent> {
  const parsed = new URL(url)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(`許可されていないプロトコルです: ${parsed.protocol}`)
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)',
        'Accept': 'text/html',
      },
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${url}`)
    }

    const html = await response.text()
    return extractContent(html, url)
  } finally {
    clearTimeout(timeout)
  }
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
