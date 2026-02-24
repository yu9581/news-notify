import { readFileSync, writeFileSync } from 'fs'
import { createHash } from 'crypto'
import { join } from 'path'
import type { Article, SeenStore } from '../utils/types.js'
import { getRootDir } from '../utils/config-loader.js'

const STORE_PATH = join(getRootDir(), 'data', 'seen-articles.json')

export function loadSeenStore(): SeenStore {
  try {
    const raw = readFileSync(STORE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { articles: [], lastUpdated: '' }
  }
}

export function saveSeenStore(store: SeenStore): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

export function hashUrl(url: string): string {
  return createHash('sha256').update(url).digest('hex').slice(0, 16)
}

export function filterNewArticles(
  articles: readonly Article[],
  store: SeenStore
): Article[] {
  const seenHashes = new Set(store.articles.map(a => a.urlHash))
  return articles.filter(article => !seenHashes.has(hashUrl(article.url)))
}

export function markAsSeen(
  store: SeenStore,
  articles: readonly Article[],
  deduplicationDays: number
): SeenStore {
  const now = new Date()
  const cutoff = new Date(now.getTime() - deduplicationDays * 24 * 60 * 60 * 1000)

  const existingArticles = store.articles.filter(
    a => new Date(a.seenAt) > cutoff
  )

  const newEntries = articles.map(article => ({
    urlHash: hashUrl(article.url),
    title: article.title,
    seenAt: now.toISOString(),
  }))

  return {
    articles: [...existingArticles, ...newEntries],
    lastUpdated: now.toISOString(),
  }
}
