import type { Article } from './types.js'

export function filterRecent(articles: readonly Article[], hours: number): Article[] {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000)
  return articles.filter(article => article.pubDate > cutoff)
}

export function interleave(groupA: readonly Article[], groupB: readonly Article[]): Article[] {
  const result: Article[] = []
  const maxLen = Math.max(groupA.length, groupB.length)

  for (let i = 0; i < maxLen; i++) {
    if (i < groupA.length) result.push(groupA[i])
    if (i < groupB.length) result.push(groupB[i])
  }

  return result
}
