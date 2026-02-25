import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getRootDir } from '../utils/config-loader.js'
import type { NotificationResult } from '../discord/notifier.js'

export interface NotifiedArticle {
  readonly messageId: string
  readonly articleUrl: string
  readonly category: string
  readonly keyword: string
  readonly relevance: number
  readonly notifiedAt: string
  readonly feedback?: 'positive' | 'negative'
}

export interface FeedbackStore {
  readonly articles: readonly NotifiedArticle[]
  readonly lastUpdated: string
}

const STORE_PATH = join(getRootDir(), 'data', 'feedback.json')

export function loadFeedbackStore(): FeedbackStore {
  try {
    const raw = readFileSync(STORE_PATH, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return { articles: [], lastUpdated: '' }
  }
}

export function saveFeedbackStore(store: FeedbackStore): void {
  writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf-8')
}

export function addNotifiedArticles(
  store: FeedbackStore,
  results: readonly NotificationResult[]
): FeedbackStore {
  const now = new Date().toISOString()
  const newEntries: NotifiedArticle[] = results.map(r => ({
    messageId: r.messageId,
    articleUrl: r.article.url,
    category: r.article.category,
    keyword: r.article.keyword,
    relevance: r.article.relevance,
    notifiedAt: now,
  }))

  return {
    articles: [...store.articles, ...newEntries],
    lastUpdated: now,
  }
}

export function updateArticleFeedback(
  store: FeedbackStore,
  messageId: string,
  feedback: 'positive' | 'negative'
): FeedbackStore {
  return {
    ...store,
    articles: store.articles.map(a =>
      a.messageId === messageId ? { ...a, feedback } : a
    ),
    lastUpdated: new Date().toISOString(),
  }
}

export function getArticlesWithFeedback(store: FeedbackStore, category: string): readonly NotifiedArticle[] {
  return store.articles.filter(a => a.category === category && a.feedback !== undefined)
}

export function cleanOldArticles(store: FeedbackStore, days: number): FeedbackStore {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  return {
    articles: store.articles.filter(a => new Date(a.notifiedAt) > cutoff),
    lastUpdated: store.lastUpdated,
  }
}
