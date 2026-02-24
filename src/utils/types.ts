export interface Person {
  readonly name: string
  readonly keywords: readonly string[]
  readonly lang: 'en' | 'ja'
}

export interface Topic {
  readonly name: string
  readonly keywords: readonly string[]
  readonly lang: 'en' | 'ja'
}

export interface Feed {
  readonly name: string
  readonly url: string
  readonly filterKeywords?: readonly string[]
}

export interface Settings {
  readonly maxArticlesPerKeyword: number
  readonly maxTotalArticles: number
  readonly fetchDelayMs: number
  readonly summaryMaxTokens: number
  readonly deduplicationDays: number
}

export interface Watchlist {
  readonly people: readonly Person[]
  readonly topics: readonly Topic[]
  readonly feeds: readonly Feed[]
  readonly settings: Settings
}

export interface Article {
  readonly title: string
  readonly url: string
  readonly pubDate: Date
  readonly source: string
  readonly category: string
  readonly keyword: string
}

export interface SummarizedArticle extends Article {
  readonly titleJa: string
  readonly summary: string
  readonly importance: '高' | '中' | '低'
}

export interface SeenArticle {
  readonly urlHash: string
  readonly title: string
  readonly seenAt: string
}

export interface SeenStore {
  articles: SeenArticle[]
  lastUpdated: string
}
